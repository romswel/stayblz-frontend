import { memo, useRef, useState } from "react";
import AttachmentView from "./AttachmentView";
import EmojiPicker from "./EmojiPicker";
import { fullTime, linkify } from "./format";
import {
  Avatar,
  CopyIcon,
  DownloadIcon,
  EditIcon,
  ForwardIcon,
  MoreIcon,
  PinIcon,
  PlusIcon,
  ReplyIcon,
  SmileIcon,
  StatusMark,
  UndoIcon,
} from "./icons";
import Menu, { type MenuEntry } from "./Menu";
import Popover from "./Popover";
import { REACTIONS, type ChatMessage, type DeliveryStatus } from "./types";

/** One to three emoji and nothing else are shown large, without a bubble. */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*){1,3}$/u;

export interface RowHandlers {
  onSelect: (id: string | null) => void;
  onPicker: (id: string | null) => void;
  onReact: (id: string, emoji: string) => void;
  onReply: (m: ChatMessage) => void;
  onCopy: (m: ChatMessage) => void;
  onUnsend: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onPin: (m: ChatMessage) => void;
  onForward: (m: ChatMessage) => void;
  onDownload: (m: ChatMessage) => void;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onJump: (id: string) => void;
  onOpenImage: (m: ChatMessage, url: string) => void;
  onError: (text: string) => void;
  fileLoader: (m: ChatMessage) => (() => Promise<Blob>) | null;
}

interface Props {
  m: ChatMessage;
  first: boolean;
  last: boolean;
  group: boolean;
  /** False while a message request is pending (you can read but not react or reply). */
  canAct: boolean;
  canEdit: boolean;
  selected: boolean;
  pickerOpen: boolean;
  /** Your newest message's state (sent / delivered / seen) — shown only there. */
  delivery?: DeliveryStatus | null;
  /** Group chats: who has read up to this message. */
  seenBy?: string[];
  directSeenName?: string;
  highlight?: string;
  h: RowHandlers;
}

function MessageRow({ m, first, last, group, canAct, canEdit, selected, pickerOpen, delivery, seenBy, directSeenName, highlight, h }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreEmoji, setMoreEmoji] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const reactRef = useRef<HTMLButtonElement>(null);

  if (m.system) {
    return (
      <div id={`msg-${m.id}`} className="mx-system" role="note">
        {m.body}
      </div>
    );
  }

  const local = !!m.status;
  const actionable = canAct && !local && !m.removed;
  const side = m.mine ? "mine" : "theirs";
  const emojiOnly = !m.removed && !m.attachment && EMOJI_ONLY.test(m.body.trim());
  const loader = h.fileLoader(m);

  const menu: MenuEntry[] = [
    ...(canEdit ? [{ label: "Edit", icon: <EditIcon />, onSelect: () => h.onEdit(m) }] : []),
    ...(m.body ? [{ label: "Copy text", icon: <CopyIcon />, onSelect: () => h.onCopy(m) }] : []),
    { label: "Forward", icon: <ForwardIcon />, onSelect: () => h.onForward(m) },
    { label: m.pinned ? "Unpin" : "Pin", icon: <PinIcon />, onSelect: () => h.onPin(m) },
    ...(m.attachment ? [{ label: "Download", icon: <DownloadIcon />, onSelect: () => h.onDownload(m) }] : []),
    ...(m.mine ? [{ label: "Unsend", icon: <UndoIcon />, danger: true, onSelect: () => h.onUnsend(m) }] : []),
  ];

  return (
    <div
      id={`msg-${m.id}`}
      className={`mx-row is-${side}${first ? " is-first" : ""}${last ? " is-last" : ""}${selected ? " is-selected" : ""}`}
    >
      {!m.mine && <span className="mx-row-av">{last && <Avatar name={m.from} size="sm" />}</span>}
      <div className="mx-stack">
        {(group && !m.mine && first) || m.forwarded || m.pinned ? (
          <div className="mx-name">
            {group && !m.mine && first && <span>{m.from}</span>}
            {m.forwarded && (
              <span className="mx-label">
                <ForwardIcon /> Forwarded
              </span>
            )}
            {m.pinned && (
              <span className="mx-label">
                <PinIcon size={12} /> Pinned
              </span>
            )}
          </div>
        ) : null}
        {m.replyTo && (
          <button type="button" className="mx-quote" onClick={() => h.onJump(m.replyTo!.id)}>
            <ReplyIcon />
            <span>
              <strong>{m.replyTo.from}</strong>{" "}
              {m.replyTo.removed ? <em>Message unsent</em> : m.replyTo.body || (m.replyTo.attachment ? `📎 ${m.replyTo.attachment}` : "")}
            </span>
          </button>
        )}
        <div className="mx-line">
          <div
            className={`mx-bubble${emojiOnly ? " is-emoji" : ""}${m.removed ? " is-removed" : ""}${m.status === "failed" ? " is-failed" : ""}${m.attachment && !m.body ? " is-media" : ""}`}
            title={fullTime(m.sentAt)}
            onClick={() => actionable && h.onSelect(selected ? null : m.id)}
          >
            {m.removed ? (
              <em>{m.mine ? "You unsent a message" : `${m.from} unsent a message`}</em>
            ) : (
              <>
                {m.attachment && (
                  <AttachmentView
                    a={m.attachment}
                    fileKey={local ? null : m.id}
                    load={loader}
                    preview={m.previewUrl}
                    onOpenImage={(url) => h.onOpenImage(m, url)}
                    onError={h.onError}
                  />
                )}
                {m.body && <span className="mx-text">{linkify(m.body, highlight)}</span>}
                {m.edited && <span className="mx-edited"> · Edited</span>}
              </>
            )}
          </div>
          {actionable && (
            <div className="mx-actions" role="toolbar" aria-label="Message actions">
              <button ref={reactRef} type="button" aria-label="React" aria-expanded={pickerOpen} title="React" onClick={() => h.onPicker(pickerOpen ? null : m.id)}>
                <SmileIcon />
              </button>
              <button type="button" aria-label="Reply" title="Reply" onClick={() => h.onReply(m)}>
                <ReplyIcon />
              </button>
              <button ref={moreRef} type="button" aria-label="More" title="More" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
                <MoreIcon />
              </button>
              {pickerOpen && !moreEmoji && (
                <Popover anchor={reactRef.current} align={m.mine ? "end" : "start"}>
                <div className="mx-picker" role="group" aria-label="Pick a reaction">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`React ${emoji}`}
                      aria-pressed={m.reactions.some((r) => r.mine && r.emoji === emoji)}
                      onClick={() => {
                        h.onReact(m.id, emoji);
                        h.onPicker(null);
                        h.onSelect(null);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button type="button" className="mx-picker-more" aria-label="More reactions" data-emoji-toggle onClick={() => setMoreEmoji(true)}>
                    <PlusIcon />
                  </button>
                </div>
                </Popover>
              )}
              {pickerOpen && moreEmoji && (
                <Popover anchor={reactRef.current} align={m.mine ? "end" : "start"}>
                  <EmojiPicker
                    label="Pick any reaction"
                    onPick={(emoji) => {
                      h.onReact(m.id, emoji);
                      setMoreEmoji(false);
                      h.onPicker(null);
                      h.onSelect(null);
                    }}
                    onClose={() => {
                      setMoreEmoji(false);
                      h.onPicker(null);
                    }}
                  />
                </Popover>
              )}
              {menuOpen && <Menu anchor={moreRef.current} items={menu} onClose={() => setMenuOpen(false)} label="Message options" align={m.mine ? "end" : "start"} />}
            </div>
          )}
        </div>
        {m.reactions.length > 0 && (
          <div className="mx-reacts">
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={r.mine ? "is-mine" : ""}
                disabled={!actionable}
                aria-label={`${r.emoji} ${r.count}${r.mine ? ", including you" : ""}`}
                title={r.mine ? "Tap to remove yours" : undefined}
                onClick={() => h.onReact(m.id, r.emoji)}
              >
                {r.emoji}
                {r.count > 1 && <span>{r.count}</span>}
              </button>
            ))}
          </div>
        )}
        {m.status === "failed" && (
          <div className="mx-status is-failed" role="status">
            <StatusMark status="failed" /> Not sent.
            <button type="button" onClick={() => h.onRetry(m.clientId!)}>
              Retry
            </button>
            <button type="button" onClick={() => h.onDiscard(m.clientId!)}>
              Remove
            </button>
          </div>
        )}
        {m.status === "sending" && (
          <div className="mx-status">
            <StatusMark status="sending" /> {m.attachment ? "Uploading…" : "Sending…"}
          </div>
        )}
        {!m.status && m.mine && delivery && !seenBy?.length && (
          <div className="mx-status">
            <StatusMark status={delivery} seenBy={delivery === "seen" ? directSeenName : undefined} />
            {delivery === "seen" ? "Seen" : delivery === "delivered" ? "Delivered" : "Sent"}
          </div>
        )}
        {!!seenBy?.length && (
          <div className="mx-seen-by" aria-label={`Seen by ${seenBy.join(", ")}`} title={`Seen by ${seenBy.join(", ")}`}>
            {seenBy.slice(0, 5).map((name) => (
              <Avatar key={name} name={name} size="xs" />
            ))}
            {seenBy.length > 5 && <span>+{seenBy.length - 5}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
export default memo(MessageRow);
