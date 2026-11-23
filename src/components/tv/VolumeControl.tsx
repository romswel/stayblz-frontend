import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * STAYBLZ TV volume: a mute button and a slider in the strip above the video, for whatever plays in
 * the screen (a YouTube live stream or replay, or our own HLS stream).
 *
 * YouTube: its player runs in a frame we can't reach into, so we send it commands with postMessage
 * (the embed address gets enablejsapi=1, see `withPlayerApi`). After a "listening" hello, the player
 * also reports its volume back (infoDelivery), so the slider follows YouTube's own volume control too.
 * No YouTube script is loaded, so the site's script policy stays as it is.
 *
 * iPhone/iPad: Apple ignores volume set by a page (hardware buttons only), so only the mute button shows.
 * The chosen level is kept on this device (localStorage) and applied to the next stream or replay.
 */

const KEY = "stayblz.tv.volume";
const YT_ORIGINS = new Set(["https://www.youtube-nocookie.com", "https://www.youtube.com"]);

type Level = { volume: number; muted: boolean };
type Target = { kind: "youtube"; frame: HTMLIFrameElement } | { kind: "video"; video: HTMLVideoElement };

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

function readLevel(): Level | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v.volume === "number" && typeof v.muted === "boolean") return { volume: clamp(v.volume), muted: v.muted };
  } catch {
    // Unreadable: start from the player's own level.
  }
  return null;
}
function saveLevel(level: Level) {
  try {
    localStorage.setItem(KEY, JSON.stringify(level));
  } catch {
    // Private mode or full storage: the level just isn't remembered.
  }
}

let adjustable: boolean | null = null;
/** False where pages can't change volume (iOS/iPadOS: a media element's volume stays 1). */
export function canSetVolume() {
  if (adjustable === null) {
    try {
      const probe = document.createElement("audio");
      probe.volume = 0.5;
      adjustable = probe.volume === 0.5;
    } catch {
      adjustable = false;
    }
  }
  return adjustable;
}

/** A YouTube embed address with YouTube's command switch on; anything else is returned unchanged. */
export function withPlayerApi(url: string) {
  try {
    const u = new URL(url);
    if (!YT_ORIGINS.has(u.origin)) return url;
    u.searchParams.set("enablejsapi", "1");
    u.searchParams.set("origin", window.location.origin);
    return u.toString();
  } catch {
    return url;
  }
}

function frameOrigin(frame: HTMLIFrameElement) {
  try {
    const origin = new URL(frame.src).origin;
    return YT_ORIGINS.has(origin) ? origin : null;
  } catch {
    return null;
  }
}

function post(frame: HTMLIFrameElement, message: object) {
  const origin = frameOrigin(frame);
  if (origin) frame.contentWindow?.postMessage(JSON.stringify({ id: 1, channel: "widget", ...message }), origin);
}

function findTarget(screen: HTMLElement): Target | null {
  const frame = screen.querySelector<HTMLIFrameElement>("iframe");
  if (frame && frameOrigin(frame)) return { kind: "youtube", frame };
  const video = screen.querySelector<HTMLVideoElement>("video:not([hidden])");
  return video ? { kind: "video", video } : null;
}

const SpeakerIcon = ({ muted, low }: { muted: boolean; low: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H2v6h4l5 4z" />
    {muted ? <path d="m23 9-6 6M17 9l6 6" /> : low ? <path d="M15.5 8.5a5 5 0 0 1 0 7" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
  </svg>
);

export default function VolumeControl({ screen }: { screen: RefObject<HTMLElement> }) {
  const [level, setLevel] = useState<Level>(() => readLevel() ?? { volume: 100, muted: false });
  const target = useRef<Target | null>(null);
  const showSlider = canSetVolume();

  function command(func: "setVolume" | "mute" | "unMute", volume?: number) {
    const t = target.current;
    if (!t) return;
    if (t.kind === "video") {
      if (func === "setVolume" && volume !== undefined) t.video.volume = volume / 100;
      if (func === "mute") t.video.muted = true;
      if (func === "unMute") t.video.muted = false;
      return;
    }
    post(t.frame, { event: "command", func, args: volume === undefined ? [] : [volume] });
  }

  // Follow the screen: the stream's frame or video appears (and changes) after this mounts.
  useEffect(() => {
    const root = screen.current;
    if (!root) return;
    let detach = () => {};

    const attach = (t: Target) => {
      target.current = t;
      if (t.kind === "video") {
        const v = t.video;
        const saved = readLevel();
        if (saved) {
          v.volume = saved.volume / 100;
          if (saved.muted) v.muted = true;
        }
        const sync = () => setLevel({ volume: clamp(v.volume * 100), muted: v.muted });
        sync();
        v.addEventListener("volumechange", sync);
        return () => v.removeEventListener("volumechange", sync);
      }

      const frame = t.frame;
      let ready = false;
      let timers: number[] = [];
      const hello = () => {
        if (!ready) post(frame, { event: "listening" });
      };
      const onLoad = () => {
        ready = false;
        timers.forEach(window.clearTimeout);
        // The player answers once it's ready; say hello a few times in case the first is too early.
        timers = [0, 400, 1200, 3000].map((ms) => window.setTimeout(hello, ms));
      };
      const onMessage = (e: MessageEvent) => {
        if (e.source !== frame.contentWindow || !YT_ORIGINS.has(e.origin)) return;
        let data: { event?: string; info?: { volume?: unknown; muted?: unknown } } | null = null;
        try {
          data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        } catch {
          return;
        }
        if (!data || typeof data !== "object") return;
        if (!ready) {
          ready = true;
          // Apply the remembered level. Never unmute by ourselves: browsers may block sound without a click.
          const saved = readLevel();
          if (saved) {
            post(frame, { event: "command", func: "setVolume", args: [saved.volume] });
            if (saved.muted) post(frame, { event: "command", func: "mute", args: [] });
          }
        }
        const info = data.info;
        if (info && typeof info === "object" && (typeof info.volume === "number" || typeof info.muted === "boolean"))
          setLevel((l) => ({
            volume: typeof info.volume === "number" ? clamp(info.volume) : l.volume,
            muted: typeof info.muted === "boolean" ? info.muted : l.muted,
          }));
      };
      frame.addEventListener("load", onLoad);
      window.addEventListener("message", onMessage);
      onLoad();
      return () => {
        timers.forEach(window.clearTimeout);
        frame.removeEventListener("load", onLoad);
        window.removeEventListener("message", onMessage);
      };
    };

    const refresh = () => {
      const next = findTarget(root);
      const same =
        next && target.current && (next.kind === "youtube" ? target.current.kind === "youtube" && target.current.frame === next.frame : target.current.kind === "video" && target.current.video === next.video);
      if (same) return;
      detach();
      detach = () => {};
      target.current = null;
      if (next) detach = attach(next);
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "hidden"] });
    return () => {
      observer.disconnect();
      detach();
      target.current = null;
    };
  }, [screen]);

  const change = (volume: number) => {
    const next = { volume: clamp(volume), muted: volume <= 0 };
    setLevel(next);
    saveLevel(next);
    command("setVolume", next.volume);
    command(next.muted ? "mute" : "unMute");
  };
  const toggle = () => {
    const muted = !level.muted;
    // Unmuting at 0 would stay silent: come back at half volume.
    const next = { volume: !muted && level.volume === 0 ? 50 : level.volume, muted };
    setLevel(next);
    saveLevel(next);
    if (next.volume !== level.volume) command("setVolume", next.volume);
    command(muted ? "mute" : "unMute");
  };

  const silent = level.muted || level.volume === 0;
  return (
    <div className="tvg-volume" role="group" aria-label="Volume">
      <button type="button" className="tvg-volume-btn" onClick={toggle} aria-label={silent ? "Unmute" : "Mute"} title={silent ? "Unmute" : "Mute"}>
        <SpeakerIcon muted={silent} low={level.volume < 50} />
      </button>
      {showSlider && (
        <input
          type="range"
          className="tvg-volume-range"
          min={0}
          max={100}
          step={1}
          value={silent ? 0 : level.volume}
          onChange={(e) => change(Number(e.target.value))}
          aria-label="Volume"
          aria-valuetext={silent ? "Muted" : `${level.volume}%`}
          style={{ ["--tvg-vol" as string]: `${silent ? 0 : level.volume}%` }}
        />
      )}
    </div>
  );
}
