import { useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { CHAT_NAME } from "./brand";
import { chatLimits } from "./files";
import { fileSize } from "./format";
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
  const limits = chatLimits();
  return (
    <Modal label="About chat storage" onClose={onClose} className="modal-sm mx-dialog mx-layer gx-layer">
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
              chat is open; elsewhere on Stayblz the count and alerts follow within about half a minute. Alerts when
              Stayblz is closed only work once you turn them on in Notification settings, on devices that support them.
              Calls open in Stayblz Paddock.
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
              <strong>File limits.</strong> Photos (shrunk before sending), videos, voice clips (up to 2 minutes) and PDF,
              Word, Excel or text files, up to {fileSize(limits.fileBytes)} each and {fileSize(limits.quotaBytes)} per
              person in total. Unsending a file deletes it.
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
