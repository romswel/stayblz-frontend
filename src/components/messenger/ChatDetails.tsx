import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import ConversationInvites from "../my-racing/ConversationInvites";
import { Avatar, DatabaseIcon } from "./icons";
import type { ChatMode, ChatThread } from "./types";

/** Who's in the chat, invite links (personal groups you created), and leave/delete. */
export default function ChatDetails({
  mode,
  thread,
  inviteOpen,
  onLeave,
  onAbout,
  onClose,
}: {
  mode: ChatMode;
  thread: ChatThread;
  inviteOpen: boolean;
  onLeave: () => void;
  onAbout: () => void;
  onClose: () => void;
}) {
  const direct = thread.kind === "direct";
  return (
    <Modal label="Chat details" onClose={onClose} className="modal-sm">
      <DialogHead kicker={direct ? "Direct chat" : "Group"} title={thread.title} onClose={onClose} />
      <div className="dlg mx-details">
        <h3 className="mx-details-h">People ({thread.members.length})</h3>
        <ul className="mx-people">
          {thread.members.map((m) => (
            <li key={m.id}>
              <Avatar name={m.name} size="sm" />
              <span>{m.me ? `${m.name} (you)` : m.name}</span>
              {m.pending && <span className="mx-tag">Hasn't accepted yet</span>}
            </li>
          ))}
        </ul>

        {mode === "personal" && thread.canInvite && (
          <div className="mx-details-block">
            <h3 className="mx-details-h">Add people</h3>
            <ConversationInvites key={thread.id} conversationId={thread.id} initiallyOpen={inviteOpen} />
          </div>
        )}

        <button type="button" className="mx-link mx-about-link" onClick={onAbout}>
          <DatabaseIcon /> How chat storage works on Stayblz
        </button>

        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn-danger" onClick={onLeave}>
            {direct ? "Delete chat" : "Leave group"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
