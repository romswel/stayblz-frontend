import { useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { CHAT_NAME } from "./brand";
import { CloseIcon, DatabaseIcon } from "./icons";

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
        <strong>Free plan:</strong> messages can take a few seconds and may rarely fail to save or disappear. Keep
        copies of anything important.{" "}
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
        <CloseIcon size={14} />
      </button>
    </div>
  );
}

export function FreePlanDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal label="About chat storage" onClose={onClose} className="modal-sm">
      <DialogHead kicker="Good to know" title={`${CHAT_NAME} on a free plan`} onClose={onClose} />
      <div className="dlg">
        <div className="dlg-text mx-about">
          <p>
            Stayblz is still in development and runs on a <strong>free database, storage and server plan</strong>.
            That keeps the site free, but {CHAT_NAME} has limits a big messenger app doesn't:
          </p>
          <ul>
            <li>
              <strong>Not instant.</strong> New messages, "typing…" and "Seen" show up within a few seconds while a
              chat is open; the menu count updates about once a minute. There are no push notifications or calls.
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
              <strong>Small files only.</strong> Photos (shrunk before sending) and PDF, Word, Excel or text files up to
              4 MB each, 50 MB per person in total. No voice notes or videos. Unsending a file deletes it.
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
