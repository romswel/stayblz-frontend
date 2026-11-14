import { useState } from "react";
import { Link } from "react-router-dom";
import { PADDOCK_NAME } from "./brand";
import type { CallView } from "./engine/call";
import { PaddockMark } from "./icons";

const headings = {
  in: "",
  left: "You left the call",
  ended: "The call has ended",
  removed: "You were removed from the call",
  failed: "The call was disconnected",
} as const;

export default function LeftScreen({ view, guest, onRejoin, onDone }: { view: CallView; guest: boolean; onRejoin: () => void; onDone: () => void }) {
  const [minutes] = useState(() => Math.max(1, Math.round((Date.now() - view.joinedAt) / 60_000)));
  const canRejoin = view.phase !== "removed";
  return (
    <div className="pd-left">
      <section className="pd-left-card panel" aria-labelledby="pd-left-title">
        <span className="pd-left-mark" aria-hidden="true">
          <PaddockMark size={30} />
        </span>
        <h1 id="pd-left-title">{headings[view.phase]}</h1>
        <p>{view.phase === "left" ? `You were in “${view.title}” for about ${minutes} minute${minutes === 1 ? "" : "s"}.` : view.endMessage}</p>
        {view.phase === "ended" && <p className="pd-small">The meeting link still works, so the call can start again later.</p>}
        <div className="pd-actions">
          {canRejoin && (
            <button type="button" className="btn btn-primary" onClick={onRejoin}>
              {view.phase === "ended" ? "Join again" : "Rejoin"}
            </button>
          )}
          <button type="button" className="btn btn-quiet" onClick={onDone}>
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
