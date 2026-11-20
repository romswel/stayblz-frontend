/* Stayblz service worker: app shell + built assets only. Never caches /api/ (private or live data).
   Also shows Web Push alerts (Stayblz Chat: messages, mentions, replies, reactions, requests, friends, groups;
   Stayblz Paddock: calls and meetings), opens the exact chat/message when one is tapped, and keeps this device
   registered when the browser renews its push address. A ringing call stays until answered (Join / Decline). */
const VERSION = "stayblz-v3";
const MAX_ASSETS = 80;
const SHELL = ["/", "/startup.css", "/favicon.svg", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/badge-96.png"];
const PICTURE_MAX_BYTES = 1_500_000;

/* Apple's push service (Safari, iPhone/iPad Home Screen apps) cancels a device's registration when pushes arrive
   without a visible notification, so there every push is shown, even while Stayblz is open. */
async function isApplePush() {
  try {
    const sub = await self.registration.pushManager.getSubscription();
    return !!sub && new URL(sub.endpoint).hostname.endsWith("push.apple.com");
  } catch {
    return false;
  }
}

/* A same-origin picture (profile photo, photo message) loaded with this account's cookie, as a data: address the
   notification can show. Small files only, a few seconds at most; null when it can't. */
async function picture(path, stableId) {
  if (typeof path !== "string" || !path.startsWith("/api/")) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(path, {
      credentials: "include",
      headers: stableId ? { "X-Stayblz-Stable": stableId } : {},
      signal: controller.signal,
    });
    clearTimeout(timer);
    const type = response.headers.get("Content-Type") || "";
    if (!response.ok || !type.startsWith("image/")) return null;
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > PICTURE_MAX_BYTES) return null;
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return `data:${type.split(";")[0]};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

/* A push from the server (backend lib/chatAlerts.ts, lib/push.ts), shown as this device's own notification. Skipped
   only for a chat you're looking at right now, or a call while Stayblz is in front (it rings on the page); never on
   Apple (see above). */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Stayblz", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    (async () => {
      const [windows, apple] = await Promise.all([
        self.clients.matchAll({ type: "window", includeUncontrolled: true }),
        isApplePush(),
      ]);
      const front = windows.filter((w) => w.visibilityState === "visible" && w.focused);
      // Stayblz Chat and racing alerts: a device notification every time, unless you're looking at that very chat.
      // Calls and meetings: an open Stayblz shows its own ringing card instead. Apple: always (see isApplePush).
      let skip = false;
      if (front.length && !apple && data.kind !== "test") {
        if (data.kind === "chat" || data.kind === "racing") {
          const target = new URL(data.url || "/messages", self.location.origin).pathname;
          const inChat = ["message", "request", "mention", "reply"].includes(data.alert);
          skip = inChat && front.some((w) => new URL(w.url).pathname === target);
        } else skip = true;
      }
      if (skip) {
        front.forEach((w) => w.postMessage({ type: "stayblz:push", alertId: data.alertId || null, shown: false }));
        return;
      }
      const call = data.kind === "call";
      // Apple ignores pictures in notifications, so it doesn't wait for them.
      const [icon, image] = apple ? [null, null] : await Promise.all([picture(data.icon), picture(data.image, data.stableId)]);
      await self.registration.showNotification(data.title || "Stayblz", {
        body: data.body || "",
        tag: data.tag || "stayblz",
        renotify: true,
        icon: icon || "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        ...(image ? { image } : {}),
        timestamp: Date.now(),
        data: { url: data.url || "/messages", alertId: data.alertId || null, kind: data.kind || "chat" },
        requireInteraction: call,
        vibrate: call ? [400, 200, 400, 200, 400] : [120, 60, 120],
        actions: call && data.alertId ? [{ action: "join", title: "Join" }, { action: "decline", title: "Decline" }] : [],
      });
      windows.forEach((w) => w.postMessage({ type: "stayblz:push", alertId: data.alertId || null, shown: true }));
      // A dot on the installed app's icon until Stayblz is opened (the page then shows the real count).
      if ((data.kind === "chat" || data.kind === "racing") && !front.length && self.navigator.setAppBadge) await self.navigator.setAppBadge().catch(() => undefined);
    })().catch(() =>
      // Whatever went wrong, still show something: a push must never pass silently.
      self.registration.showNotification(data.title || "Stayblz", {
        body: data.body || "",
        tag: data.tag || "stayblz",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        data: { url: data.url || "/messages" },
      }),
    ),
  );
});

/* Asks an open Stayblz window to go to `url` itself (no reload); true when it answers. */
function askWindow(client, url) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), 1500);
    channel.port1.onmessage = () => {
      clearTimeout(timer);
      resolve(true);
    };
    try {
      client.postMessage({ type: "stayblz:open", url }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
}

/* Tapping an alert: bring Stayblz forward on that exact page (or open it). */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const info = event.notification.data || {};
  // "Decline" on a ringing call answers it without opening Stayblz.
  if (event.action === "decline" && info.alertId) {
    event.waitUntil(
      fetch(`/api/paddock/alerts/${encodeURIComponent(info.alertId)}/decline`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => undefined),
    );
    return;
  }
  let url;
  try {
    url = new URL(info.url || "/messages", self.location.origin);
    if (url.origin !== self.location.origin) url = new URL("/messages", self.location.origin);
  } catch {
    url = new URL("/messages", self.location.origin);
  }
  event.waitUntil(
    (async () => {
      const windows = (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).filter(
        (w) => new URL(w.url).origin === self.location.origin,
      );
      const mine = windows.find((w) => w.focused) || windows.find((w) => w.visibilityState === "visible") || windows[0];
      if (!mine) return self.clients.openWindow(url.href);
      await mine.focus().catch(() => undefined);
      if (await askWindow(mine, url.href)) return;
      // The page didn't answer (still loading, or an old version): load the page there, or open a new one.
      if ("navigate" in mine) {
        const moved = await mine.navigate(url.href).catch(() => null);
        if (moved) return;
      }
      return self.clients.openWindow(url.href);
    })(),
  );
});

/* The browser renewed this device's push address: register the new one so alerts keep arriving. */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      let sub = event.newSubscription;
      const key = old && old.options && old.options.applicationServerKey;
      if (!sub && key) sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      if (!sub) return;
      const save = () =>
        fetch("/api/notifications/push/subscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
      let response = await save();
      if (response.status === 401) {
        // The short sign-in cookie ran out: renew it with the long one, then try again.
        const renewed = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (renewed.ok) response = await save();
      }
      if (old && old.endpoint !== sub.endpoint)
        await fetch("/api/notifications/push/unsubscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: old.endpoint }),
        }).catch(() => undefined);
    })().catch(() => undefined),
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
