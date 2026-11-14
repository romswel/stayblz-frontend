import { useEffect, useRef, useState } from "react";
import { canPickSpeaker, type LocalMedia } from "./engine/media";
import { play } from "./engine/sounds";
import { CamIcon, CamOffIcon, MicIcon, MicOffIcon, SpeakerIcon } from "./icons";
import { initials, useMedia } from "./useCall";

/**
 * A <video> for a MediaStream. Always muted: call audio plays separately.
 * fit "auto" fills the box unless the video's shape is very different (a phone held upright on a
 * wide screen), so faces are never cut off but there are no black bars for no reason.
 */
export function StreamVideo({ stream, mirror = false, fit = "cover", label }: { stream: MediaStream; mirror?: boolean; fit?: "cover" | "contain" | "auto"; label?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [autoFit, setAutoFit] = useState<"cover" | "contain">("cover");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [stream]);
  useEffect(() => {
    const el = ref.current;
    if (!el || fit !== "auto") return;
    const decide = () => {
      const { videoWidth: vw, videoHeight: vh, clientWidth: bw, clientHeight: bh } = el;
      if (!vw || !vh || !bw || !bh) return;
      const box = bw / bh;
      setAutoFit(Math.abs(vw / vh - box) / box < 0.3 ? "cover" : "contain");
    };
    el.addEventListener("resize", decide);
    el.addEventListener("loadedmetadata", decide);
    const observer = new ResizeObserver(decide);
    observer.observe(el);
    return () => {
      el.removeEventListener("resize", decide);
      el.removeEventListener("loadedmetadata", decide);
      observer.disconnect();
    };
  }, [fit]);
  const contain = fit === "contain" || (fit === "auto" && autoFit === "contain");
  return (
    <video
      ref={ref}
      className={`pd-video${mirror ? " is-mirror" : ""}${contain ? " is-contain" : ""}`}
      autoPlay
      muted
      playsInline
      aria-label={label}
    />
  );
}

/** Mic level as a row of bars, drawn without re-rendering React. */
export function LevelMeter({ media, label = "Microphone level" }: { media: LocalMedia; label?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const level = media.micOn ? media.level() : 0;
      ref.current?.style.setProperty("--level", String(Math.min(1, level * 1.6)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [media]);
  return (
    <span ref={ref} className="pd-meter" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <i key={i} style={{ ["--i" as string]: i }} />
      ))}
    </span>
  );
}

/** Camera preview with mic/camera switches (green room and settings). */
export function SelfPreview({ media, name }: { media: LocalMedia; name: string }) {
  useMedia(media);
  const blockedCam = media.problems.cam;
  return (
    <div className="pd-preview">
      {media.camOn && media.camStream ? (
        <StreamVideo stream={media.camStream} mirror={media.mirror} label="Your camera" />
      ) : (
        <div className="pd-preview-off">
          <span className="pd-preview-avatar" aria-hidden="true">{initials(name)}</span>
          <span>{blockedCam ? "Camera unavailable" : "Camera is off"}</span>
        </div>
      )}
      <span className="pd-preview-name">{name}</span>
      <div className="pd-preview-controls">
        <button
          type="button"
          className={`pd-round${media.micOn ? "" : " is-off"}`}
          aria-pressed={media.micOn}
          aria-label={media.micOn ? "Turn off microphone" : "Turn on microphone"}
          title={media.micOn ? "Turn off microphone" : "Turn on microphone"}
          onClick={() => void media.setMic(!media.micOn)}
        >
          {media.micOn ? <MicIcon /> : <MicOffIcon />}
        </button>
        <button
          type="button"
          className={`pd-round${media.camOn ? "" : " is-off"}`}
          aria-pressed={media.camOn}
          aria-label={media.camOn ? "Turn off camera" : "Turn on camera"}
          title={media.camOn ? "Turn off camera" : "Turn on camera"}
          onClick={() => void media.setCam(!media.camOn)}
        >
          {media.camOn ? <CamIcon /> : <CamOffIcon />}
        </button>
      </div>
      <span className="pd-preview-level">
        <LevelMeter media={media} />
      </span>
    </div>
  );
}

const deviceName = (d: MediaDeviceInfo, i: number, kind: string) => d.label || `${kind} ${i + 1}`;

/** Camera, microphone and speaker choices. */
export function DevicePickers({ media, onSpeaker }: { media: LocalMedia; onSpeaker?: (id: string) => void }) {
  useMedia(media);
  const { devices, choice } = media;
  const currentCam = media.camTrack?.getSettings?.().deviceId ?? choice.videoinput;
  const currentMic = media.micTrack?.getSettings?.().deviceId ?? choice.audioinput;
  const speakers = canPickSpeaker() && devices.audiooutput.length > 0;
  return (
    <div className="pd-devices">
      <label className="pd-device">
        <span className="ld-label">
          <MicIcon size={15} /> Microphone
        </span>
        <select
          value={devices.audioinput.some((d) => d.deviceId === currentMic) ? currentMic : ""}
          onChange={(e) => void media.choose("audioinput", e.target.value)}
          disabled={!devices.audioinput.length}
        >
          {!devices.audioinput.length && <option value="">No microphone found</option>}
          {devices.audioinput.length > 0 && !devices.audioinput.some((d) => d.deviceId === currentMic) && <option value="">Default microphone</option>}
          {devices.audioinput.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {deviceName(d, i, "Microphone")}
            </option>
          ))}
        </select>
      </label>
      <label className="pd-device">
        <span className="ld-label">
          <CamIcon size={15} /> Camera
        </span>
        <select
          value={devices.videoinput.some((d) => d.deviceId === currentCam) ? currentCam : ""}
          onChange={(e) => void media.choose("videoinput", e.target.value)}
          disabled={!devices.videoinput.length}
        >
          {!devices.videoinput.length && <option value="">No camera found</option>}
          {devices.videoinput.length > 0 && !devices.videoinput.some((d) => d.deviceId === currentCam) && <option value="">Default camera</option>}
          {devices.videoinput.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {deviceName(d, i, "Camera")}
            </option>
          ))}
        </select>
      </label>
      {speakers && (
        <label className="pd-device">
          <span className="ld-label">
            <SpeakerIcon size={15} /> Speaker
          </span>
          <span className="pd-device-row">
            <select
              value={devices.audiooutput.some((d) => d.deviceId === choice.audiooutput) ? choice.audiooutput : ""}
              onChange={(e) => {
                void media.choose("audiooutput", e.target.value);
                onSpeaker?.(e.target.value);
              }}
            >
              <option value="">System default</option>
              {devices.audiooutput
                .filter((d) => d.deviceId !== "default")
                .map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {deviceName(d, i, "Speaker")}
                  </option>
                ))}
            </select>
            <button type="button" className="btn btn-quiet pd-test" onClick={() => play("join", choice.audiooutput, true)}>
              Test
            </button>
          </span>
        </label>
      )}
    </div>
  );
}
