import { useEffect, useState } from "react";
import { isInstalledApp } from "../pwa";

/**
 * Installing Stayblz as an app (PWA). Chrome, Edge, Samsung Internet and Opera fire `beforeinstallprompt`, which we keep
 * so one button can open the browser's own "Install" box. iPhone/iPad, Safari on Mac and Firefox never fire it, so
 * those get step-by-step directions (InstallGuide.tsx). `listenForInstall()` runs before React starts, because the
 * browser can fire the event right away.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Where Stayblz is open: decides which directions to show. */
export type InstallPlatform =
  | "ios-safari"
  | "ios-other" // Chrome, Edge, Firefox… on iPhone/iPad: Share menu too (iOS 16.4+)
  | "android"
  | "desktop" // Chrome, Edge, Opera, Brave on Windows, Mac, Linux, ChromeOS
  | "mac-safari"
  | "firefox-desktop"
  | "other";

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function listenForInstall() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    emit();
  });
}

export function installPlatform(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints ?? 0): InstallPlatform {
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/i.test(ua)) return "android";
  if (/Firefox\//i.test(ua)) return "firefox-desktop";
  if (/Macintosh/i.test(ua) && /Safari\//i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua)) return "mac-safari";
  if (/Chrome|Chromium|Edg\//i.test(ua)) return "desktop";
  return "other";
}

export const isIOS = () => installPlatform().startsWith("ios");

/** Opens the browser's own install box. Resolves true when the person installed. */
export async function promptInstall() {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  emit();
  await event.prompt();
  const choice = await event.userChoice.catch(() => ({ outcome: "dismissed" as const }));
  if (choice.outcome === "accepted") {
    installedNow = true;
    emit();
    return true;
  }
  return false;
}

export function useInstall() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const update = () => setTick((n) => n + 1);
    listeners.add(update);
    const media = window.matchMedia?.("(display-mode: standalone)");
    media?.addEventListener?.("change", update);
    return () => {
      listeners.delete(update);
      media?.removeEventListener?.("change", update);
    };
  }, []);
  const platform = installPlatform();
  return {
    platform,
    /** Opened from the home screen / as an installed app, or just installed in this visit. */
    installed: isInstalledApp() || installedNow,
    /** One button can install (the browser offered it). */
    canPrompt: !!deferred,
    prompt: promptInstall,
  };
}
