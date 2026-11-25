import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PublicHeader from "../components/PublicHeader";
import PublicFooter from "../components/PublicFooter";
import BackButton from "../components/ui/BackButton";
import usePublicMotion from "../components/usePublicMotion";
import { ERROR_GUIDE } from "../components/status/errorGuide";
import { API_BASE } from "../api";
import { netStatus } from "../netStatus";
import { VERSION_TITLE } from "../version";
import { useAuth } from "../auth";
import "./landing.css";
import "./service-status.css";

type Server = "checking" | "up" | "slow" | "down";
interface Check {
  server: Server;
  ms: number | null;
  database: "ok" | "slow" | "down" | null;
  uptimeSeconds: number | null;
  notice: string | null;
  at: number;
}

const SLOW_MS = 3000;

/** One live check: /api/status, timed. Plain fetch, so a failure here doesn't raise the site-wide notice twice. */
async function checkStatus(): Promise<Check> {
  const started = performance.now();
  const stop = new AbortController();
  const timer = window.setTimeout(() => stop.abort(), 15_000);
  try {
    const res = await fetch(`${API_BASE}/api/status`, { cache: "no-store", credentials: "omit", signal: stop.signal });
    const ms = Math.round(performance.now() - started);
    const data = res.ok ? await res.json().catch(() => null) : null;
    if (!data?.ok) return { server: "down", ms: null, database: null, uptimeSeconds: null, notice: null, at: Date.now() };
    netStatus.reachable();
    return {
      server: ms > SLOW_MS ? "slow" : "up",
      ms,
      database: ["ok", "slow", "down"].includes(data.database) ? data.database : null,
      uptimeSeconds: typeof data.uptimeSeconds === "number" ? data.uptimeSeconds : null,
      notice: typeof data.notice === "string" && data.notice.trim() ? data.notice.trim() : null,
      at: Date.now(),
    };
  } catch {
    return { server: "down", ms: null, database: null, uptimeSeconds: null, notice: null, at: Date.now() };
  } finally {
    window.clearTimeout(timer);
  }
}

const seconds = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);
function ago(totalSeconds: number) {
  if (totalSeconds < 90) return "less than 2 minutes ago";
  if (totalSeconds < 5400) return `${Math.round(totalSeconds / 60)} minutes ago`;
  if (totalSeconds < 172_800) return `${Math.round(totalSeconds / 3600)} hours ago`;
  return `${Math.round(totalSeconds / 86_400)} days ago`;
}

/** Clears this device's saved copies of Stayblz's files and reloads. Sign-in and notifications stay as they are. */
async function refreshApp() {
  try {
    if ("caches" in window) await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
    const registrations = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(registrations.map((r) => r.update().catch(() => undefined)));
  } catch {
    /* reload anyway */
  }
  window.location.reload();
}

/**
 * Service status (/status, signed in or out): a live check of your connection, the Stayblz server and its database,
 * the team's notice when there is one, what each message on the site means, and ways to get unstuck.
 */
export default function ServiceStatus() {
  const pageRef = usePublicMotion();
  const { user } = useAuth();
  const [online, setOnline] = useState(() => navigator.onLine !== false);
  const [check, setCheck] = useState<Check>({ server: "checking", ms: null, database: null, uptimeSeconds: null, notice: null, at: 0 });
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const run = useCallback(async () => {
    const id = ++latest.current;
    setBusy(true);
    const result = await checkStatus();
    if (id !== latest.current) return; // a newer check started
    setCheck(result);
    setBusy(false);
  }, []);

  useEffect(() => {
    void run();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void run(), 30_000);
    const up = () => {
      setOnline(true);
      void run();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [run]);

  const overall: { tone: "good" | "warn" | "bad" | "wait"; title: string; text: string } = !online
    ? { tone: "bad", title: "You're offline", text: "Your device has no internet connection, so Stayblz can't load anything new." }
    : check.server === "checking"
      ? { tone: "wait", title: "Checking Stayblz…", text: "This takes a few seconds." }
      : check.server === "down"
        ? {
            tone: "bad",
            title: "Stayblz isn't answering",
            text: "Your internet works, but our server didn't answer. It may be restarting or down for a short while. This page checks again every 30 seconds.",
          }
        : check.database === "down"
          ? { tone: "bad", title: "Stayblz is having trouble", text: "The server is up but can't reach its database, so most pages won't load. Please try again soon." }
          : check.server === "slow" || check.database === "slow"
            ? { tone: "warn", title: "Stayblz is slow right now", text: "Everything answers, but slower than usual. Pages may take a few seconds." }
            : { tone: "good", title: "Everything's working", text: "If something still isn't loading for you, try the steps under \"Still stuck?\"." };

  const serverText =
    check.server === "checking"
      ? "Checking…"
      : check.server === "down"
        ? "Not answering"
        : `${check.server === "slow" ? "Slow" : "Answering"} · ${seconds(check.ms ?? 0)}`;
  const databaseText =
    check.server === "down" || check.server === "checking" || !check.database
      ? "Unknown until the server answers"
      : { ok: "Working", slow: "Slow", down: "Having trouble" }[check.database];
  const restartedRecently = check.uptimeSeconds !== null && check.uptimeSeconds < 900;

  return (
    <div className="landing gx-layer gx-public" id="top" ref={pageRef}>
      <a className="ld-skip" href="#status-main">
        Skip to status
      </a>
      <PublicHeader />
      <main className="svc-main" id="status-main">
        <BackButton className="legal-back public-back" signedIn={!!user} />
        <header className="svc-intro">
          <span className="ld-kicker">SERVICE STATUS / STAYBLZ</span>
          <h1>Is Stayblz working?</h1>
          <p>A live check between you and Stayblz, and what each message on the site means.</p>
        </header>

        <section className={`svc-card svc-live is-${overall.tone}`} aria-labelledby="svc-now">
          <div className="svc-verdict" role="status" aria-live="polite">
            <span className="svc-light" aria-hidden="true" />
            <div>
              <h2 id="svc-now">{overall.title}</h2>
              <p>{overall.text}</p>
            </div>
          </div>
          {check.notice && (
            <p className="svc-notice">
              <strong>From the Stayblz team:</strong> {check.notice}
            </p>
          )}
          <dl className="svc-rows">
            <div>
              <dt>Your connection</dt>
              <dd className={online ? "is-good" : "is-bad"}>{online ? "Online" : "Offline"}</dd>
            </div>
            <div>
              <dt>Stayblz server</dt>
              <dd className={check.server === "up" ? "is-good" : check.server === "slow" ? "is-warn" : check.server === "down" ? "is-bad" : ""}>
                {serverText}
              </dd>
            </div>
            <div>
              <dt>Database</dt>
              <dd className={check.database === "ok" && check.server !== "down" ? "is-good" : check.database === "slow" ? "is-warn" : check.database === "down" ? "is-bad" : ""}>
                {databaseText}
              </dd>
            </div>
          </dl>
          <div className="svc-foot">
            <span>
              {check.at ? `Checked at ${new Date(check.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Not checked yet"}
              {restartedRecently && check.server !== "down" && ` · The server restarted ${ago(check.uptimeSeconds ?? 0)}`}
            </span>
            <button type="button" className="btn btn-quiet" onClick={() => void run()} disabled={busy}>
              {busy ? "Checking…" : "Check again"}
            </button>
          </div>
        </section>

        <section className="svc-card" aria-labelledby="svc-guide">
          <h2 id="svc-guide">What the messages mean</h2>
          <dl className="svc-guide">
            {ERROR_GUIDE.map((entry) => (
              <div key={entry.id} id={`message-${entry.id}`}>
                <dt>“{entry.title}”</dt>
                <dd>
                  <p>{entry.meaning}</p>
                  <p className="svc-todo">
                    <span>What to do:</span> {entry.todo}
                  </p>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="svc-card" aria-labelledby="svc-stuck">
          <h2 id="svc-stuck">Still stuck?</h2>
          <ol className="svc-steps">
            <li>
              <strong>Reload the page.</strong> It fixes most one-off problems.
              <button type="button" className="btn btn-quiet" onClick={() => window.location.reload()}>
                Reload
              </button>
            </li>
            <li>
              <strong>Refresh the app.</strong> Clears this device's saved copy of Stayblz's files and loads the newest version. You
              stay logged in and your notifications stay on.
              <button
                type="button"
                className="btn btn-quiet"
                disabled={refreshing}
                onClick={() => {
                  setRefreshing(true);
                  void refreshApp();
                }}
              >
                {refreshing ? "Refreshing…" : "Refresh the app"}
              </button>
            </li>
            <li>
              <strong>Check what's new.</strong> Planned changes and fixes are posted on <Link to="/updates">Updates</Link>. Common
              questions are in <Link to="/faq">Help &amp; FAQ</Link>.
            </li>
          </ol>
          <p className="svc-version">{VERSION_TITLE}</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
