import { useState, useSyncExternalStore } from "react";
import { netStatus } from "../../netStatus";
import "./status.css";

/** Small bottom notice for offline, slow, or unreachable server. Shown on every page. */
export default function ConnectionNotice() {
  const state = useSyncExternalStore(netStatus.subscribe, netStatus.get, netStatus.get);
  const [hiddenFor, setHiddenFor] = useState("");
  const kind = state.offline ? "offline" : state.unreachable ? "down" : state.slow > 0 ? "slow" : "";
  if (!kind || hiddenFor === kind) return null;
  const text = {
    offline: ["You're offline", "Check your connection. Stayblz will work again when you're back online."],
    down: ["Can't reach Stayblz", "The server may be starting up or busy. Your next action will try again."],
    slow: ["Still working…", "This is taking longer than usual. The server may be waking up; it can take up to a minute."],
  }[kind];
  return (
    // A polite status, not an alert: the page usually shows its own error message too.
    <div className={`net-notice is-${kind}`} role="status" aria-live="polite" aria-label="Connection status">
      <span className="net-dot" aria-hidden="true" />
      <span>
        <strong>{text[0]}</strong>
        {text[1]}
      </span>
      <button type="button" onClick={() => setHiddenFor(kind)}>
        Hide
      </button>
    </div>
  );
}
