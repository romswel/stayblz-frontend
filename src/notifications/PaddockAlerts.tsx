import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, API_BASE, getToken } from "../api";
import { useAuth } from "../auth";
import { Avatar } from "../components/messenger/icons";
import type { AlertsAnswer, PaddockAlert } from "../components/paddock/paddockApi";
import { useNotifications, type AppAlert } from "./NotificationsContext";
import { closeSystemAlert, systemAlert } from "./systemAlert";

/**
 * Stayblz Paddock in the site-wide notifications. One quiet long-poll (GET /api/paddock/alerts) brings:
 *  - incoming calls: a ringing card (Join / Decline) while Stayblz is open, a system notification in the background
 *  - missed calls, meetings that started, invitations: a corner card and the bell's list
 * Web Push covers Stayblz being closed (backend lib/push.ts). Calls ring on screen whenever "Calls and meetings"
 * is on, even with notifications off; the background needs notifications on (same rule as chat).
 */
const RETRY_MS = [2_000, 5_000, 15_000, 30_000];

/**
 * The alerts line runs in the background on every page, so it stays quiet: a failure here never raises the
 * site-wide "can't reach Stayblz" notice (the page's own requests do that) and never renews the session.
 */
async function readAlerts(since: number, wait: number, signal: AbortSignal): Promise<AlertsAnswer | null> {
  const token = getToken();
  const response = await fetch(`${API_BASE}/api/paddock/alerts?since=${since}&wait=${wait}`, {
    credentials: "include",
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json().catch(() => null)) as AlertsAnswer | null;
}

/** A soft ring made in the browser, every two seconds until stopped. */
function startRingtone(): () => void {
  let context: AudioContext | null = null;
  let timer = 0;
  try {
    context = new AudioContext();
    if (context.state === "suspended") void context.resume().catch(() => undefined);
  } catch {
    return () => undefined;
  }
  const ring = () => {
    if (!context) return;
    const start = context.currentTime + 0.02;
    [
      [659, 0],
      [880, 0.16],
      [659, 0.5],
      [880, 0.66],
    ].forEach(([frequency, offset]) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.08, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.28);
      osc.connect(gain).connect(context!.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.3);
    });
  };
  ring();
  timer = window.setInterval(ring, 2200);
  return () => {
    window.clearInterval(timer);
    void context?.close().catch(() => undefined);
    context = null;
  };
}

const PhoneIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2Z" />
  </svg>
);
const VideoIcon = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="6" width="14" height="12" rx="2.5" />
    <path d="m16 10 6-3.5v11L16 14" />
  </svg>
);

const toAppAlert = (a: PaddockAlert, title: string, body: string): AppAlert => ({
  id: `paddock:${a.id}:${a.status}`,
  kind: a.kind === "ring" ? "call" : "meeting",
  title,
  body,
  url: `/paddock/${a.code}`,
  fromId: a.fromId,
  fromName: a.fromName,
  group: false,
  at: Date.now(),
});

export default function PaddockAlerts() {
  const { user } = useAuth();
  const { settings, pushState, permission, addAlert } = useNotifications();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const signedIn = !!user && !user.passwordSetupRequired;
  const [ringing, setRinging] = useState<PaddockAlert[]>([]);
  const seen = useRef(new Map<string, string>()); // alert id → last status handled
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const background = useRef({ pushState, permission });
  background.current = { pushState, permission };
  const addRef = useRef(addAlert);
  addRef.current = addAlert;

  // The alerts line: one request open at a time while signed in.
  useEffect(() => {
    if (!signedIn) {
      setRinging([]);
      return;
    }
    let stopped = false;
    let controller: AbortController | null = null;
    let since = 0;
    let first = true;
    let failures = 0;
    let wake: (() => void) | null = null;
    const pause = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(done, ms);
        function done() {
          window.clearTimeout(timer);
          wake = null;
          resolve();
        }
        wake = done;
      });
    // Hidden tabs keep listening only when that's how alerts reach this person (no push on this device).
    const listening = () =>
      document.visibilityState === "visible" ||
      (!!settingsRef.current?.enabled && background.current.permission === "granted" && background.current.pushState !== "on");
    const onVisible = () => document.visibilityState === "visible" && wake?.();
    document.addEventListener("visibilitychange", onVisible);

    async function run() {
      while (!stopped) {
        if (!listening()) {
          await pause(30_000);
          continue;
        }
        controller = new AbortController();
        const started = Date.now();
        let answer: AlertsAnswer | null = null;
        try {
          answer = await readAlerts(since, first ? 0 : 15_000, controller.signal);
          failures = 0;
        } catch {
          if (stopped) return;
          await pause(RETRY_MS[Math.min(failures++, RETRY_MS.length - 1)]);
          continue;
        }
        if (stopped || !answer || !Array.isArray(answer.alerts)) {
          await pause(5_000);
          continue;
        }
        const changed = answer.version !== since;
        since = answer.version;
        handle(answer.alerts, first);
        first = false;
        // A server that answers at once with nothing new: don't spin.
        if (!changed && Date.now() - started < 1_000) await pause(3_000);
      }
    }
    void run();
    return () => {
      stopped = true;
      controller?.abort();
      wake?.();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signedIn, user?.id]);

  function handle(alerts: PaddockAlert[], first: boolean) {
    const s = settingsRef.current;
    const hiddenOk = !!s?.enabled && background.current.pushState !== "on";
    const front = () => document.visibilityState === "visible" && document.hasFocus();
    for (const a of alerts) {
      const before = seen.current.get(a.id);
      if (before === a.status) continue;
      seen.current.set(a.id, a.status);
      const fresh = Date.now() - a.at < 5 * 60_000;
      if (a.kind === "ring") {
        if (a.status === "active") {
          if (!front() && hiddenOk)
            void systemAlert({
              title: `${a.fromName} is calling you`,
              body: `${a.video ? "Video" : "Voice"} call on Stayblz Paddock · ${a.title}`,
              url: `/paddock/${a.code}`,
              tag: `call-${a.code}`,
              sticky: true,
            });
        } else {
          void closeSystemAlert(`call-${a.code}`);
          if (a.status === "missed" && before === "active")
            addRef.current(toAppAlert(a, `Missed call from ${a.fromName}`, `${a.video ? "Video" : "Voice"} call · ${a.title}`), true);
        }
      } else if (a.status === "active" && (!first || fresh) && (a.kind === "started" || !first)) {
        const title = a.kind === "started" ? `${a.title} has started` : `${a.fromName} invited you to a meeting`;
        const body =
          a.kind === "started"
            ? `${a.fromName} is in the meeting. Tap to join.`
            : `${a.title}${a.scheduledFor ? ` · ${new Date(a.scheduledFor).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}`;
        const alert = toAppAlert(a, title, body);
        addRef.current(alert, true);
        if (!front() && hiddenOk) void systemAlert({ title, body, url: alert.url, tag: `meeting-${a.code}` });
      }
    }
    if (seen.current.size > 200) seen.current = new Map([...seen.current].slice(-100));
    setRinging(alerts.filter((a) => a.kind === "ring" && a.status === "active"));
  }

  // Ringing cards: not for the call you're already looking at.
  const shown = ringing.filter((r) => pathname !== `/paddock/${r.code}`);
  const sound = settings?.sound !== false && shown.length > 0;
  useEffect(() => {
    if (!sound) return;
    return startRingtone();
  }, [sound]);

  async function decline(a: PaddockAlert) {
    setRinging((list) => list.filter((r) => r.id !== a.id));
    void closeSystemAlert(`call-${a.code}`);
    await api.post(`/api/paddock/alerts/${a.id}/decline`, {}).catch(() => undefined);
  }
  function join(a: PaddockAlert) {
    setRinging((list) => list.filter((r) => r.id !== a.id));
    void closeSystemAlert(`call-${a.code}`);
    navigate(`/paddock/${a.code}`, { state: { answer: true } });
  }

  if (!shown.length) return null;
  return (
    <div className="nt-calls gx-layer" aria-live="assertive">
      {shown.map((a) => (
        <section key={a.id} className="nt-call" role="alertdialog" aria-label={`${a.video ? "Video" : "Voice"} call from ${a.fromName}`}>
          <span className="nt-call-face">
            <Avatar name={a.fromName} id={a.fromId} size="lg" />
          </span>
          <span className="nt-call-text">
            <small>
              {a.video ? <VideoIcon size={14} /> : <PhoneIcon size={14} />} Incoming {a.video ? "video" : "voice"} call
            </small>
            <strong>{a.fromName}</strong>
            <span>{a.title}</span>
          </span>
          <span className="nt-call-actions">
            <button type="button" className="nt-call-btn is-decline" aria-label={`Decline call from ${a.fromName}`} title="Decline" onClick={() => void decline(a)}>
              <PhoneIcon />
            </button>
            <button type="button" className="nt-call-btn is-join" aria-label={`Join call from ${a.fromName}`} title="Join" onClick={() => join(a)}>
              {a.video ? <VideoIcon /> : <PhoneIcon />}
            </button>
          </span>
        </section>
      ))}
    </div>
  );
}
