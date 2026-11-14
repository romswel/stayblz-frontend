import { useEffect, useState } from "react";
import { useAuth } from "../../auth";
import { MAX_PEOPLE, meetingLink } from "./brand";
import type { CallView, PaddockCall } from "./engine/call";
import { CopyIcon, ShareIcon } from "./icons";
import { paddockApi, type Access, type Meeting } from "./paddockApi";

export function CopyLink({ code, label = "Copy link" }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const link = meetingLink(code);
  const share = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="pd-copy">
      <input readOnly value={link} aria-label="Meeting link" onFocus={(e) => e.currentTarget.select()} />
      <div className="pd-copy-actions">
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() =>
            void navigator.clipboard?.writeText(link).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2500);
              },
              () => setCopied(false),
            )
          }
        >
          <CopyIcon /> {copied ? "Copied" : label}
        </button>
        {share && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => void navigator.share({ title: "Join my Stayblz Paddock call", url: link }).catch(() => undefined)}
          >
            <ShareIcon /> Share
          </button>
        )}
      </div>
    </div>
  );
}

export default function InfoTab({ view, call }: { view: CallView; call: PaddockCall }) {
  const { user } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const isHost = view.role === "host";

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    paddockApi
      .get(view.code, controller.signal)
      .then((d) => setMeeting(d.meeting))
      .catch(() => undefined);
    return () => controller.abort();
  }, [user, view.code]);

  async function save(change: { access?: Access; guestsAllowed?: boolean }) {
    if (!meeting) return;
    setSaving(Object.keys(change)[0]);
    setError("");
    try {
      setMeeting((await paddockApi.update(view.code, change)).meeting);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That change wasn't saved. Try again.");
    } finally {
      setSaving("");
    }
  }

  return (
    <div className="pd-info">
      <section className="pd-section">
        <h3>Joining info</h3>
        <CopyLink code={view.code} />
        <p className="pd-small">
          Meeting code <strong className="pd-code">{view.code}</strong>
        </p>
      </section>

      {isHost && meeting && (
        <section className="pd-section">
          <h3>Who can join</h3>
          <label className="pd-option">
            <input type="radio" name="pd-access" checked={meeting.access === "ask"} disabled={!!saving} onChange={() => void save({ access: "ask" })} />
            <span>
              <strong>Invited people join; others ask</strong>
              <small>People you invited (and your stable, if linked) come straight in.</small>
            </span>
          </label>
          <label className="pd-option">
            <input type="radio" name="pd-access" checked={meeting.access === "open"} disabled={!!saving} onChange={() => void save({ access: "open" })} />
            <span>
              <strong>Any Stayblz member with the link</strong>
              <small>Signed-in members join without asking.</small>
            </span>
          </label>
          <label className="pd-switch">
            <input type="checkbox" role="switch" checked={meeting.guestsAllowed} disabled={!!saving} onChange={(e) => void save({ guestsAllowed: e.target.checked })} />
            <span>
              <strong>Guests can ask to join</strong>
              <small>People without a Stayblz account type a name and wait for you to let them in.</small>
            </span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}

      <section className="pd-section">
        <h3>Connection</h3>
        <p className="pd-small">
          {view.relayInUse
            ? "Some video is going through a secure relay because a network blocked a direct connection."
            : "Video and sound go directly between the people in this call."}
          {!view.relayAvailable && " If someone can't connect, their network may block direct calls."}
        </p>
        {view.people.some((p) => p.link === "failed") && (
          <ul className="pd-failed">
            {view.people
              .filter((p) => p.link === "failed")
              .map((p) => (
                <li key={p.id}>
                  Couldn't connect to {p.name}.{" "}
                  <button type="button" className="pd-link" onClick={() => call.retryLink(p.id)}>
                    Retry
                  </button>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="pd-section">
        <h3>Good to know</h3>
        <ul className="pd-facts">
          <li>Up to {MAX_PEOPLE} people, free.</li>
          <li>Nothing is recorded. Chat disappears when the call ends.</li>
          <li>People in the call can see each other's internet (IP) address, because the call is direct.</li>
          {view.locked && <li>This meeting is locked: nobody new can join.</li>}
        </ul>
      </section>
    </div>
  );
}
