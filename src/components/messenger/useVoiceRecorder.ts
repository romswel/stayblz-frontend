import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_VOICE_SECONDS } from "./types";

/** Recorder formats in order of preference (Chrome/Edge/Firefox: WebM/Ogg Opus; Safari: MP4/AAC). */
const FORMATS = [
  { mime: "audio/webm;codecs=opus", ext: "webm" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  { mime: "audio/webm", ext: "webm" },
  { mime: "audio/mp4", ext: "m4a" },
];
export const canRecord = () =>
  typeof window !== "undefined" && typeof window.MediaRecorder === "function" && !!navigator.mediaDevices?.getUserMedia;

export type RecorderState = "idle" | "starting" | "recording";

/**
 * Voice clips: records from the microphone at a small bitrate (~32 kbit/s, about 240 KB a minute), shows the
 * live level, stops by itself after 2 minutes. `stop(true)` hands back the clip; `stop(false)` throws it away.
 * The microphone light goes off as soon as recording stops.
 */
export function useVoiceRecorder(onLimit?: () => void) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const parts = useRef<Blob[]>([]);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const started = useRef(0);
  const frame = useRef(0);
  const interval = useRef(0);
  const format = useRef(FORMATS[0]);
  const finish = useRef<((blob: Blob | null) => void) | null>(null);
  const limitRef = useRef(onLimit);
  limitRef.current = onLimit;

  const cleanup = useCallback(() => {
    cancelAnimationFrame(frame.current);
    window.clearInterval(interval.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    rec.current = null;
    setState("idle");
    setLevels([]);
  }, []);
  useEffect(() => () => {
    finish.current = null;
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    cleanup();
  }, [cleanup]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    if (!canRecord()) throw new Error("This browser can't record voice clips.");
    setState("starting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = media;
      format.current = FORMATS.find((f) => MediaRecorder.isTypeSupported?.(f.mime)) ?? FORMATS[FORMATS.length - 1];
      const recorder = new MediaRecorder(media, { mimeType: format.current.mime, audioBitsPerSecond: 32_000 });
      parts.current = [];
      recorder.ondataavailable = (e) => e.data.size && parts.current.push(e.data);
      recorder.onstop = () => {
        const type = (recorder.mimeType || format.current.mime).split(";")[0];
        const blob = parts.current.length ? new Blob(parts.current, { type }) : null;
        finish.current?.(blob);
        finish.current = null;
      };
      recorder.start(250);
      rec.current = recorder;
      started.current = performance.now();
      setElapsed(0);
      setState("recording");
      // Live level meter (also keeps the elapsed clock moving).
      try {
        const audio = new AudioContext();
        ctx.current = audio;
        const analyser = audio.createAnalyser();
        analyser.fftSize = 256;
        audio.createMediaStreamSource(media).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let lastPush = 0;
        const tick = (now: number) => {
          const secs = (now - started.current) / 1000;
          setElapsed(secs);
          if (secs >= MAX_VOICE_SECONDS) {
            limitRef.current?.();
            return;
          }
          if (now - lastPush > 90) {
            lastPush = now;
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
            setLevels((old) => [...old.slice(-27), Math.min(1, peak / 64)]);
          }
          frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);
      } catch {
        interval.current = window.setInterval(() => {
          const secs = (performance.now() - started.current) / 1000;
          setElapsed(secs);
          if (secs >= MAX_VOICE_SECONDS) limitRef.current?.();
        }, 250);
      }
    } catch (error) {
      cleanup();
      if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError"))
        throw new Error("Allow the microphone for Stayblz to record a voice clip.");
      if (error instanceof DOMException && error.name === "NotFoundError") throw new Error("No microphone was found.");
      throw new Error("The microphone couldn't start. Try again.");
    }
  }, [cleanup, state]);

  /** Stop recording. `keep` = hand back the clip (File + seconds), otherwise discard it. */
  const stop = useCallback(
    (keep: boolean): Promise<{ file: File; duration: number } | null> => {
      const recorder = rec.current;
      const duration = (performance.now() - started.current) / 1000;
      if (!recorder || recorder.state === "inactive") {
        cleanup();
        return Promise.resolve(null);
      }
      return new Promise((resolve) => {
        finish.current = (blob) => {
          cleanup();
          if (!keep || !blob || duration < 0.6) return resolve(null);
          const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
          resolve({ file: new File([blob], `Voice message ${stamp}.${format.current.ext}`, { type: blob.type }), duration: Math.min(duration, MAX_VOICE_SECONDS) });
        };
        recorder.stop();
      });
    },
    [cleanup],
  );

  return { state, elapsed, levels, start, stop };
}
