import { useEffect, useState, useSyncExternalStore } from "react";
import type { PaddockCall } from "./engine/call";
import type { LocalMedia } from "./engine/media";

export const useCallView = (call: PaddockCall) => useSyncExternalStore(call.subscribe, call.getView);

/** Re-render when this browser's camera/mic/devices change. */
export function useMedia(media: LocalMedia | null) {
  useSyncExternalStore(
    (listener) => (media ? media.subscribe(listener) : () => undefined),
    () => (media ? media.version() : 0),
  );
  return media;
}

/** A clock for timers ("12:04 in the call"). */
export function useNow(everyMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(timer);
  }, [everyMs]);
  return now;
}

export function duration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export const newPeerId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
  ).slice(0, 24);

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?";

export const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = () => (isMac() ? "⌘" : "Ctrl");
