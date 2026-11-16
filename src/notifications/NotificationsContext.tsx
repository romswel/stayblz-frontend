import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { beforeLogout } from "../logoutHooks";
import { firstName } from "../components/messenger/format";
import { chime } from "./chime";
import { notifyApi, type IncomingChat, type NotificationSettings, type PushInfo, type SettingsChange, type UnreadAnswer } from "./notifyApi";
import { viewingChat } from "./viewing";

/**
 * Notifications for the whole site. Stayblz Chat is the first thing that notifies; later features add their own
 * kinds here. Three ways an alert reaches you, all behind the account's "Notifications" switch:
 *  1. Stayblz open and in front: a small card in the corner (+ a soft chime).
 *  2. Stayblz open in a background tab or window: a system notification from the browser.
 *  3. Stayblz closed: Web Push (only on devices that turned it on, and only once the server has its keys).
 * One poll (/api/messages/unread?since=) feeds the menu badges and 1–2; the backend sends 3.
 */
export interface AppAlert {
  id: string;
  kind: "chat";
  title: string;
  body: string;
  url: string;
  fromId: string | null;
  group: boolean;
  at: number;
}
export type Permission = NotificationPermission | "unsupported";
export type PushState = "unsupported" | "unavailable" | "off" | "on";
export interface UnreadCounts {
  personal: number;
  requests: number;
  team: number;
}

interface Ctx {
  counts: UnreadCounts;
  settings: NotificationSettings | null;
  push: PushInfo | null;
  loadError: string;
  permission: Permission;
  pushState: PushState;
  /** The pop-up asking to turn notifications on should show. */
  shouldPrompt: boolean;
  save: (changes: SettingsChange) => Promise<void>;
  /** "Turn on": asks the browser, saves the account choice, and switches on push for this device when possible. */
  enable: () => Promise<Permission>;
  dismissPrompt: () => void;
  setPush: (on: boolean) => Promise<void>;
  test: () => Promise<string>;
  toasts: AppAlert[];
  recent: AppAlert[];
  dismiss: (id: string) => void;
  openAlert: (alert: AppAlert) => void;
  reload: () => void;
}
const Context = createContext<Ctx | null>(null);
const EMPTY: UnreadCounts = { personal: 0, requests: 0, team: 0 };
const VISIBLE_MS = 30_000;
const HIDDEN_MS = 60_000;
const PROMPT_KEY = "stayblz.notify.prompt";
const PROMPT_AGAIN_DAYS = 7;

const hasNotification = () => typeof window !== "undefined" && "Notification" in window;
const readPermission = (): Permission => (hasNotification() ? Notification.permission : "unsupported");
const pushCapable = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && hasNotification();

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function registration() {
  try {
    return (await navigator.serviceWorker?.getRegistration?.()) ?? null;
  } catch {
    return null;
  }
}
async function currentSubscription() {
  const reg = pushCapable() ? await registration() : null;
  return reg ? reg.pushManager.getSubscription().catch(() => null) : null;
}
function sameKey(sub: PushSubscription, publicKey: string) {
  const own = sub.options?.applicationServerKey;
  if (!own) return true;
  const a = new Uint8Array(own);
  const b = keyBytes(publicKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** What a chat message says in an alert ("Sent a photo", or the text), respecting "show message text". */
function alertOf(item: IncomingChat, previews: boolean): AppAlert {
  const raw = item.body ?? "";
  const summary =
    raw === "📷 Photo"
      ? "Sent a photo"
      : raw === "🎤 Voice message"
        ? "Sent a voice message"
        : raw === "🎬 Video"
          ? "Sent a video"
          : raw.startsWith("📎 ")
            ? "Sent a file"
            : raw;
  const title = item.group ? (item.title ?? "Group chat") : item.from;
  const body = !previews
    ? item.request
      ? "Wants to send you a message"
      : "New message"
    : item.group
      ? `${firstName(item.from)}: ${summary}`
      : item.request
        ? `Message request: ${summary}`
        : summary;
  const url = item.kind === "team" ? `/team-messages/${item.chatId}${item.stableId ? `?stable=${item.stableId}` : ""}` : `/messages/${item.chatId}`;
  return { id: `${item.kind}:${item.chatId}:${item.at}`, kind: "chat", title, body, url, fromId: item.fromId, group: item.group, at: Date.now() };
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const signedIn = !!user && !user.passwordSetupRequired;
  const [counts, setCounts] = useState<UnreadCounts>(EMPTY);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [push, setPushInfo] = useState<PushInfo | null>(null);
  const [loadError, setLoadError] = useState("");
  const [permission, setPermission] = useState<Permission>(readPermission);
  const [pushOn, setPushOn] = useState(false);
  const [toasts, setToasts] = useState<AppAlert[]>([]);
  const [recent, setRecent] = useState<AppAlert[]>([]);
  const [promptHidden, setPromptHidden] = useState(() => {
    try {
      const at = Number(localStorage.getItem(PROMPT_KEY) ?? 0);
      return Date.now() - at < PROMPT_AGAIN_DAYS * 86_400_000;
    } catch {
      return false;
    }
  });
  const [reloadKey, setReloadKey] = useState(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pushOnRef = useRef(pushOn);
  pushOnRef.current = pushOn;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const pollSoon = useRef<() => void>(() => undefined);

  // Your settings (and whether the server can send push).
  useEffect(() => {
    if (!signedIn) {
      setSettings(null);
      setPushInfo(null);
      return;
    }
    const c = new AbortController();
    setLoadError("");
    notifyApi
      .settings(c.signal)
      .then((d) => {
        if (c.signal.aborted) return;
        setSettings(d.settings);
        setPushInfo(d.push);
      })
      .catch((e) => !c.signal.aborted && setLoadError(e instanceof Error ? e.message : "Notification settings couldn't be loaded."));
    return () => c.abort();
  }, [signedIn, user?.id, reloadKey]);

  // Is this device subscribed to push (with the server's current key)?
  useEffect(() => {
    let live = true;
    if (!push?.available || !push.publicKey) {
      setPushOn(false);
      return;
    }
    void currentSubscription().then((sub) => live && setPushOn(!!sub && sameKey(sub, push.publicKey!)));
    return () => {
      live = false;
    };
  }, [push?.available, push?.publicKey]);

  // The permission can change in the browser's own settings while we're open.
  useEffect(() => {
    const refresh = () => setPermission(readPermission());
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // Logging out: this device stops getting this account's push alerts.
  useEffect(
    () =>
      beforeLogout(async () => {
        const sub = await currentSubscription();
        if (!sub) return;
        await notifyApi.unsubscribe(sub.endpoint).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }),
    [],
  );

  const showSystem = useCallback(async (alert: AppAlert) => {
    const options = {
      body: alert.body,
      tag: alert.id.split(":").slice(0, 2).join("-"),
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: alert.url },
      renotify: true,
      silent: !settingsRef.current?.sound,
    } as NotificationOptions;
    const reg = await registration();
    if (reg) {
      try {
        await reg.showNotification(alert.title, options);
        return;
      } catch {
        /* fall back to a page notification */
      }
    }
    try {
      const n = new Notification(alert.title, options);
      n.onclick = () => {
        window.focus();
        navigateRef.current(alert.url);
        n.close();
      };
    } catch {
      /* This browser can't show it; the badge still counts it. */
    }
  }, []);

  const handleIncoming = useCallback(
    (items: IncomingChat[]) => {
      const s = settingsRef.current;
      if (!s?.enabled) return;
      for (const item of items) {
        if (item.request ? !s.chatRequests : !s.chatMessages) continue;
        const front = document.visibilityState === "visible" && document.hasFocus();
        if (front && viewingChat() === `${item.kind}:${item.chatId}`) continue;
        const alert = alertOf(item, s.previews);
        setRecent((old) => [alert, ...old.filter((a) => a.id !== alert.id)].slice(0, 20));
        if (front) {
          setToasts((old) => [...old.filter((t) => !t.id.startsWith(`${item.kind}:${item.chatId}:`)), alert].slice(-3));
          if (s.sound) chime();
        } else if (readPermission() === "granted" && !pushOnRef.current) {
          void showSystem(alert);
        }
      }
    },
    [showSystem],
  );

  // One poll for menu badges and new-message alerts. Hidden tabs only keep polling when they're the way
  // alerts reach you (notifications on, browser allowed, no push on this device).
  useEffect(() => {
    if (!signedIn) {
      setCounts(EMPTY);
      return;
    }
    let stopped = false;
    let timer = 0;
    let soonTimer = 0;
    let since: string | null = null;
    const seen = new Set<string>();
    const watchHidden = () => !!settingsRef.current?.enabled && readPermission() === "granted" && !pushOnRef.current;
    const schedule = () => {
      window.clearTimeout(timer);
      if (!stopped) timer = window.setTimeout(load, document.hidden ? HIDDEN_MS : VISIBLE_MS);
    };
    async function load() {
      window.clearTimeout(timer);
      if (document.hidden && !watchHidden()) return schedule();
      try {
        const data = await api.get<UnreadAnswer>(`/api/messages/unread?since=${encodeURIComponent(since ?? new Date().toISOString())}`);
        if (stopped || !data || typeof data.personal !== "number") return schedule();
        setCounts({ personal: data.personal, requests: data.requests, team: data.team });
        const fresh = (data.incoming ?? []).filter((i) => !seen.has(`${i.kind}:${i.chatId}:${i.at}`));
        fresh.forEach((i) => seen.add(`${i.kind}:${i.chatId}:${i.at}`));
        if (seen.size > 500) seen.clear();
        // The first answer only sets the starting point: nothing that arrived before you opened Stayblz pops up.
        if (since !== null) handleIncoming(fresh);
        since = data.now ?? since;
      } catch {
        /* The badge is a hint; a failed check keeps the last numbers. */
      }
      schedule();
    }
    const soon = () => {
      window.clearTimeout(soonTimer);
      soonTimer = window.setTimeout(load, 1200);
    };
    pollSoon.current = soon;
    void load();
    const onVisible = () => !document.hidden && soon();
    window.addEventListener("stayblz:chats-changed", soon);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearTimeout(soonTimer);
      window.removeEventListener("stayblz:chats-changed", soon);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, user?.id, handleIncoming]);

  // The service worker: a tapped notification opens its chat here; a push while we're in front just checks now.
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: string } | null;
      if (data?.type === "stayblz:open" && data.url) {
        try {
          const url = new URL(data.url, window.location.origin);
          if (url.origin === window.location.origin) navigateRef.current(url.pathname + url.search);
        } catch {
          /* ignore */
        }
      } else if (data?.type === "stayblz:push") pollSoon.current();
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, []);

  // "(3) Stayblz" in the browser tab when chats are waiting.
  useEffect(() => {
    const total = counts.personal + counts.requests + counts.team;
    const base = document.title.replace(/^\(\d+\+?\) /, "");
    document.title = total ? `(${total > 99 ? "99+" : total}) ${base}` : base;
  }, [counts]);

  const save = useCallback(async (changes: SettingsChange) => {
    const before = settingsRef.current;
    if (before) setSettings({ ...before, ...changes } as NotificationSettings);
    try {
      const d = await notifyApi.save(changes);
      setSettings(d.settings);
      setPushInfo(d.push);
    } catch (reason) {
      if (before) setSettings(before);
      throw reason;
    }
  }, []);

  const subscribePush = useCallback(async () => {
    if (!push?.available || !push.publicKey) throw new Error("Alerts when Stayblz is closed aren't switched on yet.");
    if (!pushCapable()) throw new Error("This browser can't get alerts while Stayblz is closed.");
    const reg = await registration();
    if (!reg) throw new Error("Open Stayblz from stayblz-app.com (or the installed app) to get alerts while it's closed.");
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, push.publicKey)) {
      await sub.unsubscribe().catch(() => undefined);
      sub = null;
    }
    sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(push.publicKey) });
    await notifyApi.subscribe(sub.toJSON());
    setPushOn(true);
  }, [push?.available, push?.publicKey]);

  const setPush = useCallback(
    async (on: boolean) => {
      if (on) {
        if (readPermission() !== "granted") {
          const answer = hasNotification() ? await Notification.requestPermission() : "denied";
          setPermission(answer);
          if (answer !== "granted") throw new Error("Allow notifications for Stayblz in your browser first.");
        }
        return subscribePush();
      }
      const sub = await currentSubscription();
      if (sub) {
        await notifyApi.unsubscribe(sub.endpoint).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }
      setPushOn(false);
    },
    [subscribePush],
  );

  const enable = useCallback(async (): Promise<Permission> => {
    let answer: Permission = readPermission();
    if (answer === "default") answer = await Notification.requestPermission();
    setPermission(answer);
    // The account switch goes on either way: in-page alerts work even where the browser says no.
    await save({ enabled: true, prompted: true });
    if (answer === "granted" && push?.available) await subscribePush().catch(() => undefined);
    return answer;
  }, [push?.available, save, subscribePush]);

  const dismissPrompt = useCallback(() => {
    setPromptHidden(true);
    try {
      localStorage.setItem(PROMPT_KEY, String(Date.now()));
    } catch {
      /* Shown again next visit. */
    }
    void notifyApi.save({ prompted: true }).then((d) => setSettings(d.settings), () => undefined);
  }, []);

  const test = useCallback(async () => {
    if (pushOn) {
      const r = await notifyApi.test();
      return r.sent ? `Sent to ${r.sent} ${r.sent === 1 ? "device" : "devices"}. It should appear in a few seconds.` : "No device answered. Turn alerts off and on again here.";
    }
    const alert: AppAlert = {
      id: `test:${Date.now()}`,
      kind: "chat",
      title: "Stayblz notifications are on",
      body: "This is how a new Stayblz Chat message will look.",
      url: "/account/notifications",
      fromId: null,
      group: false,
      at: Date.now(),
    };
    if (readPermission() === "granted") await showSystem(alert);
    else setToasts((old) => [...old, alert].slice(-3));
    if (settingsRef.current?.sound !== false) chime();
    return readPermission() === "granted" ? "Sent. Look for it in your system notifications." : "Shown here. Allow notifications in your browser to get them in the background too.";
  }, [pushOn, showSystem]);

  const value = useMemo<Ctx>(
    () => ({
      counts,
      settings,
      push,
      loadError,
      permission,
      pushState: !pushCapable() ? "unsupported" : !push?.available ? "unavailable" : pushOn ? "on" : "off",
      shouldPrompt: !!settings && !settings.enabled && !settings.promptedAt && !promptHidden && permission !== "denied",
      save,
      enable,
      dismissPrompt,
      setPush,
      test,
      toasts,
      recent,
      dismiss: (id) => setToasts((old) => old.filter((t) => t.id !== id)),
      openAlert: (alert) => {
        setToasts((old) => old.filter((t) => t.id !== alert.id));
        navigate(alert.url);
      },
      reload: () => setReloadKey((k) => k + 1),
    }),
    [counts, settings, push, loadError, permission, pushOn, promptHidden, save, enable, dismissPrompt, setPush, test, toasts, recent, navigate],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error("NotificationsProvider is required.");
  return context;
}
