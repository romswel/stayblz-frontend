import { useMemo, useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import type { ChatApi } from "./chatApi";
import { Avatar, SearchIcon } from "./icons";
import type { ChatMessage, ChatPreview } from "./types";

/** Forward one message to up to 10 of your chats (same kind: personal → personal, team → same stable). */
export default function ForwardDialog({
  chatApi,
  fromId,
  message,
  chats,
  onClose,
  onDone,
}: {
  chatApi: ChatApi;
  fromId: string;
  message: ChatMessage;
  chats: ChatPreview[];
  onClose: () => void;
  onDone: (sent: number) => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = useMemo(
    () => chats.filter((c) => !c.request && (!q.trim() || c.title.toLowerCase().includes(q.trim().toLowerCase()))),
    [chats, q],
  );
  const preview = message.body || (message.attachment ? `📎 ${message.attachment.name}` : "");

  async function send() {
    if (!picked.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const { results } = await chatApi.forward(fromId, message.id, picked);
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        setError(`${failed.length} of ${results.length} didn't send. ${failed[0].error ?? ""}`.trim());
        setPicked(failed.map((f) => f.to));
        setBusy(false);
        return;
      }
      onDone(results.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Forwarding didn't work. Try again.");
      setBusy(false);
    }
  }

  return (
    <Modal label="Forward message" onClose={onClose} className="modal-sm">
      <DialogHead kicker="Forward" title="Send to…" onClose={onClose} />
      <div className="dlg mx-new">
        <blockquote className="mx-forward-preview">{preview}</blockquote>
        <label className="mx-search">
          <SearchIcon />
          <input type="search" placeholder="Search chats" aria-label="Search chats" value={q} onChange={(e) => setQ(e.target.value)} data-autofocus />
        </label>
        <ul className="mx-pick" aria-label="Chats">
          {list.map((c) => (
            <li key={c.id}>
              <label>
                <input
                  type="checkbox"
                  aria-label={c.title}
                  checked={picked.includes(c.id)}
                  disabled={!picked.includes(c.id) && picked.length >= 10}
                  onChange={(e) => setPicked((old) => (e.target.checked ? [...old, c.id] : old.filter((id) => id !== c.id)))}
                />
                <Avatar name={c.title} group={c.kind === "group"} size="sm" />
                <span>{c.title}</span>
              </label>
            </li>
          ))}
          {!list.length && <li className="mx-hint mx-pad">No chats match.</li>}
        </ul>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!picked.length || busy} onClick={() => void send()}>
            {busy ? "Sending…" : picked.length > 1 ? `Send to ${picked.length} chats` : "Send"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
