/**
 * Installable app (PWA). The service worker only keeps the app shell and built files for
 * fast starts and an offline "you're offline" screen; it never caches /api/ data, so racing
 * records and private data are always fresh from the server.
 * Only registered in production builds (dev and tests run without it).
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* The site still works without it. */
    });
  });
}

/** True when opened from the home screen (no browser bar, so no browser Back button). */
export function isInstalledApp() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
