import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { api, ApiError } from "../../api";

type Playback = { url: string; title: string | null };
type Phase = "connecting" | "playing" | "buffering" | "error" | "unsupported";

/** How many times a dropped stream reconnects by itself before asking the viewer. */
const AUTO_RETRIES = 3;

/**
 * The live player. Asks the server for the stream address (GET /api/tv/playback, the step the
 * paywall will guard), then plays the HLS stream: natively where the browser can (Safari, iOS),
 * otherwise through hls.js, loaded only when a broadcast is actually live.
 *
 * Starts muted because browsers block autoplay with sound; a button turns the sound on.
 * `onOffAir` tells the page the broadcast ended so it can refresh what's on.
 */
export default function TvPlayer({ onOffAir }: { onOffAir: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const controller = new AbortController();
    let hls: Hls | null = null;
    let retries = 0;
    let stopped = false;
    const fail = (text: string) => {
      if (stopped) return;
      setMessage(text);
      setPhase("error");
    };
    const onWaiting = () => setPhase((p) => (p === "playing" ? "buffering" : p));
    const onPlaying = () => setPhase("playing");
    const onNativeError = () => fail("The broadcast stopped loading.");
    element.addEventListener("waiting", onWaiting);
    element.addEventListener("playing", onPlaying);
    setPhase("connecting");

    (async () => {
      let playback: Playback;
      try {
        playback = await api.get<Playback>("/api/tv/playback", { signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.code === "off_air") return onOffAir();
        return fail(error instanceof ApiError ? error.message : "The broadcast couldn't be opened.");
      }
      if (stopped) return;

      // Safari and iOS play HLS themselves (and iOS has no Media Source Extensions for hls.js).
      if (element.canPlayType("application/vnd.apple.mpegurl")) {
        element.addEventListener("error", onNativeError);
        element.src = playback.url;
        element.play().catch(() => undefined);
        return;
      }
      // The light build (no captions, alternate audio or DRM) is about half the size; switch to "hls.js" if those are needed.
      const { default: HlsPlayer } = await import("hls.js/light");
      if (stopped) return;
      if (!HlsPlayer.isSupported()) {
        setPhase("unsupported");
        return;
      }
      // The site's security policy blocks blob: workers, so hls.js works on the page thread.
      hls = new HlsPlayer({ enableWorker: false, lowLatencyMode: true });
      hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
        if (!data.fatal || !hls) return;
        if (data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR && retries < AUTO_RETRIES) {
          retries += 1;
          hls.recoverMediaError();
        } else if (data.type === HlsPlayer.ErrorTypes.NETWORK_ERROR && retries < AUTO_RETRIES) {
          retries += 1;
          setPhase("buffering");
          hls.startLoad();
        } else {
          hls.destroy();
          hls = null;
          fail("The broadcast stopped loading.");
        }
      });
      hls.on(HlsPlayer.Events.FRAG_LOADED, () => {
        retries = 0;
      });
      hls.loadSource(playback.url);
      hls.attachMedia(element);
      element.play().catch(() => undefined);
    })().catch(() => fail("The broadcast couldn't be opened."));

    return () => {
      stopped = true;
      controller.abort();
      element.removeEventListener("waiting", onWaiting);
      element.removeEventListener("playing", onPlaying);
      element.removeEventListener("error", onNativeError);
      hls?.destroy();
      element.removeAttribute("src");
      element.load();
    };
  }, [attempt, onOffAir]);

  const unmute = () => {
    const element = video.current;
    if (!element) return;
    element.muted = false;
    element.play().catch(() => undefined);
  };

  return (
    <div className="tv-player" data-phase={phase}>
      <video
        ref={video}
        className="tv-video"
        controls={phase === "playing" || phase === "buffering"}
        autoPlay
        muted
        playsInline
        aria-label="Live race telecast"
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
      />
      {(phase === "connecting" || phase === "buffering") && (
        <div className="tv-overlay" role="status">
          <span className="tv-spinner" aria-hidden="true" />
          {phase === "connecting" ? "Connecting to the broadcast…" : "Buffering…"}
        </div>
      )}
      {phase === "error" && (
        <div className="tv-overlay" role="alert">
          <p>{message}</p>
          <button type="button" className="tv-action" onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {phase === "unsupported" && (
        <div className="tv-overlay" role="alert">
          <p>This browser can't play live video. Try an up-to-date Chrome, Edge, Firefox or Safari.</p>
        </div>
      )}
      {phase === "playing" && muted && (
        <button type="button" className="tv-action tv-unmute" onClick={unmute}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H2v6h4l5 4z" />
            <path d="m23 9-6 6M17 9l6 6" />
          </svg>
          Tap for sound
        </button>
      )}
    </div>
  );
}
