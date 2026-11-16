import { useMemo, useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import AttachmentView from "./AttachmentView";
import EmojiPicker from "./EmojiPicker";
import { dayLabel, clock } from "./format";
import { Avatar, CopyIcon, DownloadIcon, EditIcon, ForwardIcon, PinIcon, PlusIcon, ReplyIcon, UndoIcon } from "./icons";
import { REACTIONS, type ChatMember, type ChatMessage, type PinnedMessage } from "./types";

export type SheetAction = "reply" | "copy" | "forward" | "pin" | "download" | "edit" | "unsend";

/** Phones: long-press a message → reactions on top, actions underneath (a bottom sheet). */
export function MessageSheet({
  m,
  canEdit,
  onReact,
  onAction,
  onClose,
}: {
  m: ChatMessage;
  canEdit: boolean;
  onReact: (emoji: string) => void;
  onAction: (action: SheetAction) => void;
  onClose: () => void;
}) {
  const [more, setMore] = useState(false);
  const rows: { key: SheetAction; label: string; icon: JSX.Element; danger?: boolean }[] = [
    { key: "reply", label: "Reply", icon: <ReplyIcon size={18} /> },
    ...(canEdit ? [{ key: "edit" as const, label: "Edit", icon: <EditIcon size={18} /> }] : []),
    ...(m.body ? [{ key: "copy" as const, label: "Copy text", icon: <CopyIcon /> }] : []),
    { key: "forward", label: "Forward", icon: <ForwardIcon size={18} /> },
    { key: "pin", label: m.pinned ? "Unpin" : "Pin", icon: <PinIcon size={18} /> },
    ...(m.attachment ? [{ key: "download" as const, label: "Download", icon: <DownloadIcon size={18} /> }] : []),
    ...(m.mine ? [{ key: "unsend" as const, label: "Unsend", icon: <UndoIcon />, danger: true }] : []),
  ];
  return (
    <Modal label="Message actions" onClose={onClose} className="modal-sm mx-dialog mx-sheet mx-layer gx-layer">
      <div className="dlg mx-sheet-body">
        <p className="mx-sheet-preview">{m.body || (m.attachment ? `📎 ${m.attachment.name}` : "")}</p>
        {more ? (
          <EmojiPicker label="Pick any reaction" onPick={(e) => onReact(e)} onClose={() => setMore(false)} />
        ) : (
          <div className="mx-picker is-sheet" role="group" aria-label="Pick a reaction">
            {REACTIONS.map((emoji, i) => (
              <button
                key={emoji}
                type="button"
                style={{ animationDelay: `${i * 22}ms` }}
                aria-label={`React ${emoji}`}
                aria-pressed={m.reactions.some((r) => r.mine && r.emoji === emoji)}
                onClick={() => onReact(emoji)}
              >
                {emoji}
              </button>
            ))}
            <button type="button" className="mx-picker-more" aria-label="More reactions" data-emoji-toggle onClick={() => setMore(true)}>
              <PlusIcon />
            </button>
          </div>
        )}
        <div className="mx-sheet-actions">
          {rows.map((r) => (
            <button key={r.key} type="button" className={`mx-action-row${r.danger ? " is-danger" : ""}`} onClick={() => onAction(r.key)}>
              {r.icon} {r.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** Who reacted, by emoji. Tap your own to remove it. */
export function ReactionsDialog({
  m,
  members,
  meId,
  onRemoveMine,
  onClose,
}: {
  m: ChatMessage;
  members: ChatMember[];
  meId: string;
  onRemoveMine: (emoji: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<string>("all");
  const names = useMemo(() => new Map(members.map((p) => [p.id, p.name])), [members]);
  const total = m.reactions.reduce((n, r) => n + r.count, 0);
  const people = m.reactions.flatMap((r) =>
    (r.ids ?? []).map((id) => ({ id, emoji: r.emoji, name: id === meId ? "You" : (names.get(id) ?? "Former member") })),
  );
  const shown = tab === "all" ? people : people.filter((p) => p.emoji === tab);
  return (
    <Modal label="Reactions" onClose={onClose} className="modal-sm mx-dialog mx-layer gx-layer">
      <DialogHead kicker="Message" title="Reactions" onClose={onClose} />
      <div className="dlg mx-reactions-dlg">
        <div className="mx-seg" role="tablist" aria-label="Filter reactions">
          <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")}>
            All {total}
          </button>
          {m.reactions.map((r) => (
            <button key={r.emoji} type="button" role="tab" aria-selected={tab === r.emoji} onClick={() => setTab(r.emoji)}>
              {r.emoji} {r.count}
            </button>
          ))}
        </div>
        {!people.length ? (
          <p className="mx-hint">{m.reactions.map((r) => `${r.emoji} ${r.count}`).join("  ")}</p>
        ) : (
          <ul className="mx-rows mx-reactors">
            {shown.map((p) => (
              <li key={p.id + p.emoji}>
                <Avatar name={p.name} id={p.id === meId ? meId : p.id} size="sm" />
                <span>
                  {p.name}
                  {p.id === meId && (
                    <button type="button" className="mx-link mx-remove-mine" onClick={() => onRemoveMine(p.emoji)}>
                      Tap to remove
                    </button>
                  )}
                </span>
                <span className="mx-reactor-emoji">{p.emoji}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/** Every pinned message in the chat, newest pin first. Tap one to jump to it; unpin from here too. */
export function PinnedDialog({
  pins,
  messages,
  members,
  canAct,
  fileLoader,
  onJump,
  onUnpin,
  onOpenImage,
  onError,
  onClose,
}: {
  pins: PinnedMessage[];
  messages: ChatMessage[];
  members: ChatMember[];
  canAct: boolean;
  fileLoader: (m: ChatMessage) => (() => Promise<Blob>) | null;
  onJump: (id: string) => void;
  onUnpin: (id: string) => void;
  onOpenImage: (m: ChatMessage, url: string) => void;
  onError: (text: string) => void;
  onClose: () => void;
}) {
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  return (
    <Modal label="Pinned messages" onClose={onClose} className="mx-dialog mx-pinned-dlg mx-layer gx-layer">
      <DialogHead kicker={`${pins.length} pinned`} title="Pinned messages" onClose={onClose} />
      <div className="dlg">
        {!pins.length && <p className="mx-hint">Nothing pinned yet. Use a message's ⋮ menu → Pin to keep it handy here.</p>}
        <ul className="mx-pinned-list">
          {pins.map((p, i) => {
            const full = byId.get(p.id);
            const senderId = full?.senderId ?? members.find((x) => x.name === p.from)?.id;
            return (
              <li key={p.id} style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <Avatar name={p.from} id={senderId} size="sm" />
                <div className="mx-pinned-main">
                  <div className="mx-pinned-head">
                    <strong>{full?.mine ? "You" : p.from}</strong>
                    <small>
                      {dayLabel(full?.sentAt ?? p.pinnedAt)}
                      {full ? ` · ${clock(full.sentAt)}` : ""}
                    </small>
                  </div>
                  {full?.attachment && /^image\//.test(full.attachment.type) && (
                    <div className="mx-pinned-photo">
                      <AttachmentView
                        a={full.attachment}
                        fileKey={full.id}
                        load={fileLoader(full)}
                        onOpenImage={(url) => onOpenImage(full, url)}
                        onError={onError}
                      />
                    </div>
                  )}
                  <button type="button" className="mx-pinned-bubble" onClick={() => onJump(p.id)} aria-label={`Go to pinned message from ${p.from}`}>
                    {full?.body || p.body || (p.attachment ? `📎 ${p.attachment}` : "Go to message")}
                  </button>
                </div>
                {canAct && (
                  <button type="button" className="mx-pill" onClick={() => onUnpin(p.id)}>
                    Unpin
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
