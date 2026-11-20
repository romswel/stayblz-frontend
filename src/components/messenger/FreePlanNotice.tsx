import Modal from "../Modal";
import BriefNotice from "../ui/BriefNotice";
import DialogHead from "../ui/DialogHead";
import { CHAT_NAME } from "./brand";
import { chatLimits } from "./files";
import { fileSize } from "./format";
import { DatabaseIcon } from "./icons";

/**
 * A brief heads-up about chat on the free plan: slides in for a few seconds, at most once a week on this device.
 * The full explanation stays one tap away in Chat settings and Chat info ("How chat works on our free plan").
 */
export function FreePlanBanner({ onMore }: { onMore: () => void }) {
  return (
    <BriefNotice storageKey="stayblz.chatNotice.shownAt" everyDays={7} seconds={10} title="Free plan." icon={<DatabaseIcon />}>
      Messages may take a moment and can rarely fail to save, so keep copies of anything important.{" "}
      <button type="button" className="brief-notice-link" onClick={onMore}>
        What this means
      </button>
    </BriefNotice>
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
              <strong>Nearly instant.</strong> While Stayblz is open, new messages, "typing…", "Delivered" and "Seen"
              usually show up within a second or two; after the server has been asleep, the first one can take longer.
              Alerts when Stayblz is closed only work once you turn them on in Notification settings, on devices that
              support them. Calls open in Stayblz Paddock.
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
