import { useState } from "react";
import { MAX_PEOPLE, meetingLink, PADDOCK_NAME } from "./brand";
import type { CallView, PaddockCall } from "./engine/call";
import { CopyIcon, ShareIcon } from "./icons";

export function CopyLink({ code, label = "Copy link" }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const link = meetingLink(code);
  const share = typeof navigator !== "undefined" && "share" in navigator;
  return (
    <div className="pd-copy">
      <input readOnly value={link.replace(/^https?:\/\//, "")} aria-label="Meeting link" onFocus={(e) => e.currentTarget.select()} />
      <div className="pd-copy-actions">
        <button
          type="button"
          className="pd-btn is-quiet is-small"
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
            className="pd-btn is-quiet is-small"
            onClick={() => void navigator.share({ title: `Join my ${PADDOCK_NAME} call`, url: link }).catch(() => undefined)}
          >
            <ShareIcon /> Share
          </button>
        )}
      </div>
    </div>
  );
}

export default function InfoTab({ view, call }: { view: CallView; call: PaddockCall }) {
  return (
    <div className="pd-info">
      <section className="pd-section">
        <h3>Link and code</h3>
        <CopyLink code={view.code} />
        <p className="pd-small">
          Paddock code <strong className="pd-code">{view.code}</strong>
        </p>
      </section>

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
          <li>Presenting a browser tab can share its sound too: handy for watching a race replay together.</li>
          <li>People in the call can see each other's internet (IP) address, because the call is direct.</li>
          {view.locked && <li>This meeting is locked: nobody new can join.</li>}
        </ul>
      </section>
    </div>
  );
}
