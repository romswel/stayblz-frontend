import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Brand from "../Brand";
import { PADDOCK_NAME } from "./brand";
import type { CallView } from "./engine/call";

const headings = {
  in: "",
  left: "You left the call",
  ended: "The call has ended",
  removed: "You were removed from the call",
  failed: "The call was disconnected",
} as const;
const BACK_AFTER = 60;

/** After a call: rejoin, or go back. Signed-in people return to the Paddock home by themselves after a minute. */
export default function LeftScreen({ view, guest, onRejoin, onDone }: { view: CallView; guest: boolean; onRejoin: () => void; onDone: () => void }) {
  const [minutes] = useState(() => Math.max(1, Math.round((Date.now() - view.joinedAt) / 60_000)));
  const [left, setLeft] = useState(guest ? 0 : BACK_AFTER);
  const canRejoin = view.phase !== "removed";
  useEffect(() => {
    if (!left) return;
    const timer = window.setTimeout(() => (left === 1 ? onDone() : setLeft(left - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [left, onDone]);
  return (
    <div className="pd-left">
      {left > 0 && (
        <p className="pd-left-timer" role="status">
          <span className="pd-countdown" style={{ ["--p" as string]: left / BACK_AFTER }} aria-hidden="true">
            {left}
          </span>
          Returning to {PADDOCK_NAME}…
          <button type="button" className="pd-link" onClick={() => setLeft(0)}>
            Stay here
          </button>
        </p>
      )}
      <section className="pd-left-card gx-glass" aria-labelledby="pd-left-title">
        <span className="pd-crest is-large" aria-hidden="true">
          <Brand />
        </span>
        <h1 id="pd-left-title">{headings[view.phase]}</h1>
        <p>{view.phase === "left" ? `You were in “${view.title}” for about ${minutes} minute${minutes === 1 ? "" : "s"}.` : view.endMessage}</p>
        {view.phase === "ended" && <p className="pd-small">The meeting link still works, so the call can start again later.</p>}
        <div className="pd-actions">
          {canRejoin && (
            <button type="button" className="pd-btn is-quiet" onClick={onRejoin}>
              {view.phase === "ended" ? "Join again" : "Rejoin"}
            </button>
          )}
          <button type="button" className="pd-btn is-primary" onClick={onDone}>
            {guest ? "Done" : `Back to ${PADDOCK_NAME}`}
          </button>
        </div>
        {guest && (
          <p className="pd-small">
            Want to host your own meetings? <Link to="/signup">Create a free Stayblz account</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
