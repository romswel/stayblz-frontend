import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { api, ApiError } from "../../api";

/**
 * `kind` "embed" means `url` is a YouTube embed, shown in YouTube's own player. A track's stream can
 * have `embeddable: false` (the track allows it on YouTube only); then `watchUrl` opens it there.
 */
type Playback = { url: string; title: string | null; kind?: "hls" | "embed"; embeddable?: boolean; watchUrl?: string };
type Phase = "connecting" | "playing" | "buffering" | "error" | "unsupported" | "youtube_only";

/** How many times a dropped stream reconnects by itself before asking the viewer. */
const AUTO_RETRIES = 3;

/**
 * The live player. Asks the server for the stream address (GET /api/tv/playback, the step the
 * paywall will guard), then plays the HLS stream: natively where the browser can (Safari, iOS),
 * otherwise through hls.js, loaded only when a broadcast is actually live.
 *
 * Starts muted because browsers block autoplay with sound; a button turns the sound on.
 * `onOffAir` tells the page the broadcast ended so it can refresh what's on.
 *
 * When playback says `kind: "embed"`, the server-built YouTube embed address is shown in an iframe
 * instead (YouTube's player, controls and sound button). The site CSP allows only YouTube frames.
 *
 * `channel`: a track's YouTube channel id, to play that track's live stream
 * (GET /api/tv/playback?channel=…, free). Without it: the featured broadcast (behind the TV Pass).
 */
export default function TvPlayer({ channel, onOffAir }: { channel?: string; onOffAir: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [message, setMessage] = useState("");
  const [muted, setMuted] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [embed, setEmbed] = useState<{ url: string; title: string | null } | null>(null);
  const [external, setExternal] = useState("");
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
    setEmbed(null);
    setExternal("");

    (async () => {
      let playback: Playback;
      try {
        const path = channel ? `/api/tv/playback?channel=${encodeURIComponent(channel)}` : "/api/tv/playback";
        playback = await api.get<Playback>(path, { signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) return;
        // Off air, or the TV Pass is needed (paid access just switched on): the page re-checks what to show.
        if (error instanceof ApiError && (error.code === "off_air" || error.code === "subscription_required")) return onOffAir();
        return fail(error instanceof ApiError ? error.message : "The broadcast couldn't be opened.");
      }
      if (stopped) return;

      if (playback.kind === "embed" && playback.embeddable === false) {
        setExternal(playback.watchUrl ?? "");
        setPhase("youtube_only");
        return;
      }
      if (playback.kind === "embed") {
        // "connecting" stays up until the iframe loads (onLoad below).
        setEmbed({ url: playback.url, title: playback.title });
        return;
      }

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
  }, [attempt, channel, onOffAir]);

  const unmute = () => {
    const element = video.current;
    if (!element) return;
    element.muted = false;
    element.play().catch(() => undefined);
  };

  return (
    <div className="tv-player" data-phase={phase}>
      {embed && (
        <iframe
          className="tv-video tv-embed"
          src={embed.url}
          title={embed.title ? `Live race telecast: ${embed.title}` : "Live race telecast"}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          // The site sends no referrer; YouTube's player refuses to start without one.
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setPhase("playing")}
        />
      )}
      <video
        ref={video}
        hidden={!!embed}
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
      {phase === "youtube_only" && (
        <div className="tv-overlay" role="status">
          <p>This track only allows its live stream to play on YouTube.</p>
          {external && (
            <a className="tv-action" href={external} target="_blank" rel="noopener noreferrer">
              Watch on YouTube
            </a>
          )}
        </div>
      )}
      {phase === "unsupported" && (
        <div className="tv-overlay" role="alert">
          <p>This browser can't play live video. Try an up-to-date Chrome, Edge, Firefox or Safari.</p>
        </div>
      )}
      {phase === "playing" && muted && !embed && (
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
