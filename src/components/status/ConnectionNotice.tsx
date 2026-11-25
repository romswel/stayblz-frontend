import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router-dom";
import { netStatus } from "../../netStatus";
import { useAuth } from "../../auth";
import "./status.css";

const minutes = (ms: number) => Math.floor(ms / 60_000);

/**
 * Small bottom notice for offline, slow, or unreachable server, then "Back online" for a moment when it answers
 * again (netStatus re-checks by itself). Shown on every page; "What's going on?" opens /status.
 */
export default function ConnectionNotice() {
  const state = useSyncExternalStore(netStatus.subscribe, netStatus.get, netStatus.get);
  const { pathname } = useLocation();
  const { loading } = useAuth();
  const [hiddenFor, setHiddenFor] = useState("");
  const [checking, setChecking] = useState(false);
  const [, tick] = useState(0);
  const kind = state.offline ? "offline" : state.unreachable ? "down" : state.slow > 0 ? "slow" : state.backAt ? "back" : "";

  useEffect(() => {
    if (kind !== "back") return;
    const t = window.setTimeout(() => netStatus.clearBack(), 4500);
    return () => window.clearTimeout(t);
  }, [kind]);
  // "Not answering for 3 minutes" stays current.
  useEffect(() => {
    if (kind !== "down") return;
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [kind]);
  useEffect(() => {
    if (hiddenFor && hiddenFor !== kind) setHiddenFor("");
  }, [kind, hiddenFor]);

  // The first-load screen and the status page explain it themselves; the notice would cover them on phones.
  if (!kind || hiddenFor === kind || loading || pathname === "/status") return null;
  const down = state.downSince ? minutes(Date.now() - state.downSince) : 0;
  const text = {
    offline: ["You're offline", "Check your Wi-Fi or mobile data. Stayblz will work again when you're back online."],
    down: [
      "Can't reach Stayblz",
      `${down >= 1 ? `Not answering for ${down} min. ` : ""}The server may be restarting. We'll tell you when it's back.`,
    ],
    slow: ["Still working…", "This is taking longer than usual. The server may be busy."],
    back: ["Back online", "Stayblz is answering again. You can carry on."],
  }[kind];

  async function tryNow() {
    setChecking(true);
    await netStatus.checkNow();
    setChecking(false);
  }

  return (
    // A polite status, not an alert: the page usually shows its own error message too.
    <div className={`net-notice is-${kind}`} role="status" aria-live="polite" aria-label="Connection status">
      <span className="net-dot" aria-hidden="true" />
      <span className="net-text">
        <strong>{text[0]}</strong>
        <span className="net-detail">{text[1]}</span>
        {kind !== "back" && (
          <Link className="net-more" to="/status">
            What's going on?
          </Link>
        )}
      </span>
      <span className="net-actions">
        {kind === "down" && (
          <button type="button" className="net-try" onClick={tryNow} disabled={checking}>
            {checking ? "Checking…" : "Try now"}
          </button>
        )}
        {kind !== "back" && (
          <button type="button" onClick={() => setHiddenFor(kind)}>
            Hide
          </button>
        )}
      </span>
    </div>
  );
}
