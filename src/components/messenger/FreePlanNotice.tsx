import { useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { DatabaseIcon } from "./icons";

const KEY = "stayblz.chatNotice.v1";
const seen = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Short, dismissible heads-up shown until someone closes it on this device. */
export function FreePlanBanner({ onMore }: { onMore: () => void }) {
  const [hidden, setHidden] = useState(seen);
  if (hidden) return null;
  return (
    <div className="mx-banner" role="note">
      <DatabaseIcon />
      <p>
        <strong>Chat runs on a free database plan.</strong> Messages can be slow to arrive, and in rare cases may not
        save or may disappear. Keep a copy of anything important.{" "}
        <button type="button" className="mx-link" onClick={onMore}>
          What this means
        </button>
      </p>
      <button
        type="button"
        className="mx-icon-btn"
        aria-label="Dismiss notice"
        onClick={() => {
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* Storage blocked: hide for this visit only. */
          }
          setHidden(true);
        }}
      >
        ×
      </button>
    </div>
  );
}

export function FreePlanDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="About chat storage" onClose={onClose} className="modal-sm">
      <DialogHead kicker="Good to know" title="Chat on a free plan" onClose={onClose} />
      <div className="dlg">
        <div className="dlg-text mx-about">
          <p>
            Stayblz is still in development and runs on a <strong>free database and server plan</strong>. That keeps
            the site free, but chat has limits a big messenger app doesn't:
          </p>
          <ul>
            <li>
              <strong>Not instant.</strong> New messages show up within a few seconds while a chat is open, and the
              menu count updates about once a minute. There's no typing indicator or push notifications yet.
            </li>
            <li>
              <strong>Slow starts.</strong> After a quiet spell the server can take up to a minute to wake up.
            </li>
            <li>
              <strong>Messages can go missing.</strong> During outages or maintenance a message may fail to save,
              and if we run out of space older messages may be cleared. Don't rely on chat for anything you can't
              afford to lose.
            </li>
            <li>
              <strong>Text only.</strong> No photos, files or voice notes for now.
            </li>
          </ul>
          <p>
            If a message doesn't send, it stays on this device with a <strong>Retry</strong> button, so your typing
            isn't lost.
          </p>
        </div>
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </Modal>
  );
}
