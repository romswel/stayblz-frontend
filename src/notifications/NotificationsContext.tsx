import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { beforeLogout } from "../logoutHooks";
import { isInstalledApp } from "../pwa";
import { isIOS } from "../install/installState";
import { chime } from "./chime";
import { allowedBy, fromIncoming, viewOf } from "./chatAlertView";
import { isRacingAlert, notifyApi, type ChatAlert, type ChatAlertKind, type NotificationSettings, type PushInfo, type SettingsChange, type UnreadAnswer } from "./notifyApi";
import { viewingChat } from "./viewing";

/**
 * Notifications for the whole site: Stayblz Chat (messages, mentions, replies, reactions, requests, friends, groups)
 * and Stayblz Paddock calls and meetings (PaddockAlerts.tsx adds those through `addAlert`). Behind the account's
 * "Notifications" switch, an alert reaches you as the device's own notification (computer or phone), open or closed:
 *  1. Push on for this device: Web Push (backend lib/chatAlerts.ts), shown by the service worker (public/sw.js),
 *     unless you're looking at that very chat.
 *  2. No push here (the server has none, or this browser can't): this page shows it while Stayblz is open.
 *  3. The browser blocks notifications: a card in the corner of Stayblz (+ a soft chime) while it's in front.
 * Chat alerts are saved on the server (the bell list), so every device shows the same history.
 * One poll (/api/messages/unread?since=) feeds the menu badges, the bell and 2–3; a push to an open page polls at once.
 */
export interface AppAlert {
  id: string;
  kind: "chat" | "call" | "meeting" | "racing";
  title: string;
  body: string;
  url: string;
  fromId: string | null;
  /** Whose face to show (defaults to the title). */
  fromName?: string;
  group: boolean;
  at: number;
  /** Stayblz Chat: the saved alert (read when opened) and what happened. */
  chatAlertId?: string;
  alertKind?: ChatAlertKind;
  /** A photo message's picture. */
  image?: string;
  /** 🎉 for a reaction, @ for a mention… */
  badge?: string;
  read?: boolean;
}
export type Permission = NotificationPermission | "unsupported";
/** "needs-install": iPhone/iPad in the browser, where notifications only work in the Home Screen app. */
export type PushState = "unsupported" | "needs-install" | "unavailable" | "off" | "on";
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
  /** This device shows notifications (browser allowed + alerts when closed, where the server has them). */
  deviceReady: boolean;
  /** The set-up guide should open by itself (first time, or a new device). */
  shouldPrompt: boolean;
  save: (changes: SettingsChange) => Promise<void>;
  /** "Turn on": asks the browser, saves the account choice, and switches on push for this device when possible. */
  enable: () => Promise<Permission>;
  dismissPrompt: () => void;
  setPush: (on: boolean) => Promise<void>;
  test: () => Promise<string>;
  toasts: AppAlert[];
  /** The bell: saved chat alerts + this visit's call/meeting alerts, newest first. */
  bell: AppAlert[];
  bellUnread: number;
  /** Kept for older callers: same as `bell`. */
  recent: AppAlert[];
  dismiss: (id: string) => void;
  openAlert: (alert: AppAlert) => void;
  markAllRead: () => void;
  reload: () => void;
  /** Another feature's alert: into the bell's list, and a corner card (+ chime) when `toast`. */
  addAlert: (alert: AppAlert, toast: boolean) => void;
  /** The "Set up notifications" guide. */
  setupOpen: boolean;
  openSetup: () => void;
  closeSetup: () => void;
}
const Context = createContext<Ctx | null>(null);
const EMPTY: UnreadCounts = { personal: 0, requests: 0, team: 0 };
const VISIBLE_MS = 20_000;
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

function chatAppAlert(a: ChatAlert, previews: boolean): AppAlert {
  const view = viewOf(a, previews);
  return {
    id: `${a.id}:${a.at}`,
    chatAlertId: a.id,
    alertKind: a.kind,
    kind: isRacingAlert(a.kind) ? "racing" : "chat",
    title: view.title,
    body: view.body,
    url: view.url,
    image: view.image,
    badge: view.badge,
    fromId: a.actorId,
    fromName: a.actorName,
    group: false,
    at: Date.parse(a.at) || Date.now(),
    read: a.read,
  };
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
  const [chatAlerts, setChatAlerts] = useState<ChatAlert[]>([]);
  const [alertsUnread, setAlertsUnread] = useState(0);
  const [recent, setRecent] = useState<AppAlert[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
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
  /** Alerts the service worker already showed as system notifications (iPhone shows every push). */
  const shownBySystem = useRef(new Set<string>());
  /** This device was (re)registered for push in this visit. */
  const registered = useRef<string | null>(null);

  // Your settings (and whether the server can send push), and the bell's saved alerts.
  useEffect(() => {
    if (!signedIn) {
      setSettings(null);
      setPushInfo(null);
      setChatAlerts([]);
      setAlertsUnread(0);
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
    notifyApi
      .alerts(c.signal)
      .then((d) => {
        if (c.signal.aborted || !Array.isArray(d?.items)) return;
        setChatAlerts(d.items);
        setAlertsUnread(d.unread ?? 0);
      })
      .catch(() => undefined);
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
        registered.current = null;
        const sub = await currentSubscription();
        if (!sub) return;
        await notifyApi.unsubscribe(sub.endpoint).catch(() => undefined);
        await sub.unsubscribe().catch(() => undefined);
      }),
    [],
  );

  const subscribePush = useCallback(async () => {
    if (!push?.available || !push.publicKey) throw new Error("Alerts when Stayblz is closed aren't switched on yet.");
    if (!pushCapable())
      throw new Error(isIOS() && !isInstalledApp() ? "On iPhone, add Stayblz to your Home Screen and open it from there first." : "This browser can't get alerts while Stayblz is closed.");
    const reg = (await registration()) ?? (await navigator.serviceWorker.ready.catch(() => null));
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

  // Every visit, a device that allows notifications is (re)registered for push: a device that said yes before the
  // server could send push, or whose registration the server dropped, starts getting alerts again without a click.
  useEffect(() => {
    if (!signedIn || !user || !settings?.enabled || permission !== "granted" || !push?.available || !pushCapable()) return;
    if (registered.current === user.id) return;
    registered.current = user.id;
    void subscribePush().catch(() => {
      registered.current = null;
    });
  }, [signedIn, user, settings?.enabled, permission, push?.available, subscribePush]);

  const showSystem = useCallback(async (alert: AppAlert) => {
    const options = {
      body: alert.body,
      tag: alert.chatAlertId ? `alert-${alert.chatAlertId}` : alert.id.split(":").slice(0, 2).join("-"),
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      data: { url: alert.url },
      renotify: true,
      silent: !settingsRef.current?.sound,
      ...(alert.image ? { image: alert.image } : {}),
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
    (items: ChatAlert[]) => {
      const s = settingsRef.current;
      if (!s?.enabled) return;
      for (const item of [...items].reverse()) {
        if (item.read || !allowedBy(s, item.kind)) continue;
        const front = document.visibilityState === "visible" && document.hasFocus();
        // Looking at that chat already: its messages are right there.
        const inChat = item.kind === "message" || item.kind === "request" || item.kind === "mention" || item.kind === "reply";
        if (front && inChat && item.chatId && viewingChat() === `${item.chatKind}:${item.chatId}`) continue;
        if (shownBySystem.current.has(item.id)) continue;
        const alert = chatAppAlert(item, s.previews);
        // Device notifications first (the computer's or phone's own), even while Stayblz is open: with push on, the
        // service worker shows them (sw.js); without it, this page does. A card inside Stayblz only where the browser
        // can't or won't show them.
        if (readPermission() === "granted") {
          if (!pushOnRef.current) void showSystem(alert);
        } else if (front) {
          setToasts((old) => [...old.filter((t) => t.chatAlertId !== item.id), alert].slice(-3));
          if (s.sound) chime();
        }
      }
    },
    [showSystem],
  );

  // One poll for menu badges, the bell and on-screen alerts. Hidden tabs only keep polling when they're the way
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
        const data = await api.get<UnreadAnswer>(`/api/messages/unread?since=${encodeURIComponent(since ?? new Date().toISOString())}&racing=1`);
        if (stopped || !data || typeof data.personal !== "number") return schedule();
        setCounts({ personal: data.personal, requests: data.requests, team: data.team });
        const items = Array.isArray(data.alerts) ? data.alerts : (data.incoming ?? []).map(fromIncoming);
        const fresh = items.filter((i) => !seen.has(`${i.id}:${i.at}`));
        fresh.forEach((i) => seen.add(`${i.id}:${i.at}`));
        if (seen.size > 500) seen.clear();
        if (Array.isArray(data.alerts) && fresh.length)
          setChatAlerts((old) => {
            const byId = new Map(old.map((a) => [a.id, a]));
            fresh.forEach((a) => byId.set(a.id, a));
            return [...byId.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 40);
          });
        if (typeof data.alertsUnread === "number") {
          setAlertsUnread(data.alertsUnread);
          // Read somewhere else (another device, or by opening the chat): no unread dots left here either.
          if (data.alertsUnread === 0) setChatAlerts((old) => (old.some((a) => !a.read) ? old.map((a) => ({ ...a, read: true })) : old));
        }
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
      soonTimer = window.setTimeout(load, 900);
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

  // A page notification (no service worker) was tapped: open its page here.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (typeof url === "string" && url.startsWith("/")) navigateRef.current(url);
    };
    window.addEventListener("stayblz:open", onOpen);
    return () => window.removeEventListener("stayblz:open", onOpen);
  }, []);

  // The service worker: a tapped notification opens its page here (we answer so it knows we did); a push while
  // we're open checks now (and remembers alerts it already showed, so they don't show twice).
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: string; alertId?: string; shown?: boolean } | null;
      if (data?.type === "stayblz:open" && data.url) {
        try {
          const url = new URL(data.url, window.location.origin);
          if (url.origin === window.location.origin) navigateRef.current(url.pathname + url.search);
          e.ports?.[0]?.postMessage("opened");
        } catch {
          /* ignore */
        }
      } else if (data?.type === "stayblz:push") {
        if (data.shown && data.alertId) shownBySystem.current.add(data.alertId);
        pollSoon.current();
      }
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, []);

  // "(3) Stayblz" in the browser tab, and the number on the installed app's icon.
  useEffect(() => {
    const total = counts.personal + counts.requests + counts.team;
    const base = document.title.replace(/^\(\d+\+?\) /, "");
    document.title = total ? `(${total > 99 ? "99+" : total}) ${base}` : base;
    const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    try {
      if (total && nav.setAppBadge) void nav.setAppBadge(total).catch(() => undefined);
      else if (!total && nav.clearAppBadge) void nav.clearAppBadge().catch(() => undefined);
    } catch {
      /* Not supported here. */
    }
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
    if (answer === "granted" && push?.available) {
      await subscribePush().catch(() => undefined);
      if (user) registered.current = user.id;
    }
    return answer;
  }, [push?.available, save, subscribePush, user]);

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
      return r.sent
        ? `Sent to ${r.sent} ${r.sent === 1 ? "device" : "devices"}. It should appear in a few seconds.`
        : "No device answered. Turn alerts off and on again here.";
    }
    const alert: AppAlert = {
      id: `test:${Date.now()}`,
      kind: "chat",
      title: "Stayblz notifications are on",
      body: "This is how Stayblz Chat messages, mentions and calls will look.",
      url: "/account/notifications",
      fromId: null,
      group: false,
      at: Date.now(),
    };
    if (readPermission() === "granted") await showSystem(alert);
    else setToasts((old) => [...old, alert].slice(-3));
    if (settingsRef.current?.sound !== false) chime();
    return readPermission() === "granted"
      ? "Sent. Look for it in your system notifications."
      : "Shown here. Allow notifications in your browser to get them in the background too.";
  }, [pushOn, showSystem]);

  const markRead = useCallback((ids: string[] | "all") => {
    setChatAlerts((old) => old.map((a) => (ids === "all" || ids.includes(a.id) ? { ...a, read: true } : a)));
    if (ids === "all") setAlertsUnread(0);
    void notifyApi.markRead(ids).then(
      (d) => typeof d?.unread === "number" && setAlertsUnread(d.unread),
      () => undefined,
    );
  }, []);

  const pushState: PushState = !pushCapable()
    ? isIOS() && !isInstalledApp()
      ? "needs-install"
      : "unsupported"
    : !push?.available
      ? "unavailable"
      : pushOn
        ? "on"
        : "off";
  const deviceReady = permission === "granted" && (pushState === "on" || pushState === "unavailable");
  const bell = useMemo(() => {
    const previews = settings?.previews !== false;
    return [...chatAlerts.map((a) => chatAppAlert(a, previews)), ...recent].sort((a, b) => b.at - a.at).slice(0, 40);
  }, [chatAlerts, recent, settings?.previews]);

  const value = useMemo<Ctx>(
    () => ({
      counts,
      settings,
      push,
      loadError,
      permission,
      pushState,
      deviceReady,
      shouldPrompt:
        !!settings &&
        !promptHidden &&
        permission !== "denied" &&
        (settings.enabled ? !deviceReady && pushState !== "unsupported" : !settings.promptedAt),
      save,
      enable,
      dismissPrompt,
      setPush,
      test,
      toasts,
      bell,
      bellUnread: alertsUnread + recent.filter((a) => !a.read).length,
      recent: bell,
      dismiss: (id) => setToasts((old) => old.filter((t) => t.id !== id)),
      openAlert: (alert) => {
        setToasts((old) => old.filter((t) => t.id !== alert.id));
        if (alert.chatAlertId) markRead([alert.chatAlertId]);
        else setRecent((old) => old.map((a) => (a.id === alert.id ? { ...a, read: true } : a)));
        navigate(alert.url);
      },
      markAllRead: () => {
        markRead("all");
        setRecent((old) => old.map((a) => ({ ...a, read: true })));
      },
      reload: () => setReloadKey((k) => k + 1),
      addAlert: (alert, toast) => {
        setRecent((old) => [alert, ...old.filter((a) => a.id !== alert.id)].slice(0, 20));
        if (toast) {
          setToasts((old) => [...old.filter((t) => t.id !== alert.id), alert].slice(-3));
          if (settingsRef.current?.sound !== false) chime();
        }
      },
      setupOpen,
      openSetup: () => setSetupOpen(true),
      closeSetup: () => setSetupOpen(false),
    }),
    [counts, settings, push, loadError, permission, pushState, deviceReady, promptHidden, save, enable, dismissPrompt, setPush, test, toasts, bell, alertsUnread, recent, markRead, navigate, setupOpen],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error("NotificationsProvider is required.");
  return context;
}
