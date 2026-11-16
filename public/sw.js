/* Stayblz service worker: app shell + built assets only. Never caches /api/ (private or live data).
   Also shows Web Push alerts (Stayblz Chat) and opens the right page when one is tapped. */
const VERSION = "stayblz-v2";
const MAX_ASSETS = 80;
const SHELL = ["/", "/startup.css", "/favicon.svg", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png"];

/* A push from the server (backend lib/push.ts). If a Stayblz window is in front, it shows its own card instead. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Stayblz", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const front = windows.filter((w) => w.visibilityState === "visible" && w.focused);
      if (front.length && data.kind !== "test") {
        front.forEach((w) => w.postMessage({ type: "stayblz:push", data }));
        return undefined;
      }
      return self.registration.showNotification(data.title || "Stayblz", {
        body: data.body || "",
        tag: data.tag || "stayblz",
        renotify: true,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        data: { url: data.url || "/messages" },
      });
    }),
  );
});

/* Tapping an alert: bring Stayblz forward on that page (or open it). */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/messages", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const mine = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (mine) {
        mine.postMessage({ type: "stayblz:open", url });
        return mine.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/* Each release adds new hashed files; keep only the newest ones so old builds don't pile up. */
function trimAssets(cache) {
  return cache.keys().then((keys) => {
    const assets = keys.filter((key) => new URL(key.url).pathname.startsWith("/assets/"));
    return Promise.all(assets.slice(0, Math.max(0, assets.length - MAX_ASSETS)).map((key) => cache.delete(key)));
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: always try the network first so a new release shows straight away.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || Response.error())),
    );
    return;
  }

  // Built files have a content hash in their name, so a cached copy is always right.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy).then(() => trimAssets(cache)));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Other public files (icons, images): use the cache, refresh it in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    }),
  );
});
