import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import AttachmentView from "./AttachmentView";
import LinkCards from "./LinkCards";
import EmojiPicker from "./EmojiPicker";
import { clock, dayLabel, firstName, fullTime, linkify, tone } from "./format";
import {
  Avatar,
  CopyIcon,
  DownloadIcon,
  EditIcon,
  ForwardIcon,
  MoreVIcon,
  PhoneIcon,
  PinIcon,
  PlusIcon,
  ReplyIcon,
  SmileIcon,
  StatusMark,
  UndoIcon,
  VideoIcon,
} from "./icons";
import Menu, { type MenuEntry } from "./Menu";
import Popover from "./Popover";
import { QUICK_REACTION, REACTIONS, type ChatMessage, type DeliveryStatus } from "./types";

/** One to three emoji and nothing else are shown large, without a bubble. */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*){1,3}$/u;
/** The message a chat call posts (see callLink.ts). */
const CALL_MESSAGE = /^(📹|📞) (Video|Voice) call on Stayblz Paddock[^:]*: \S*\/paddock\/([a-z]{4}-[a-z]{4})\s*$/u;

export interface Who {
  id?: string | null;
  name: string;
}
export interface RowHandlers {
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
  /** Phones: long-press opens the action sheet. */
  onSheet: (m: ChatMessage) => void;
  /** Who reacted. */
  onReactions: (m: ChatMessage) => void;
  fileLoader: (m: ChatMessage) => (() => Promise<Blob>) | null;
}

interface Props {
  m: ChatMessage;
  first: boolean;
  last: boolean;
  group: boolean;
  meId: string;
  /** False while a message request is pending (you can read but not react or reply). */
  canAct: boolean;
  canEdit: boolean;
  pickerOpen: boolean;
  /** Newly arrived (not part of the first load): plays the entrance. */
  fresh: boolean;
  /** Your newest message's state (sent / delivered / seen) — shown only there. */
  delivery?: DeliveryStatus | null;
  /** Group chats: who has read up to this message. */
  seenBy?: Who[];
  /** One-to-one chats: the other person (their face shows when they've seen your newest message). */
  other?: Who;
  highlight?: string;
  /** Groups: "@Name" for the chat's members, and your own name (messages that mention you stand out). */
  mentions?: RegExp | null;
  meName?: string;
  h: RowHandlers;
}

const LONG_PRESS_MS = 430;
const SWIPE_REPLY_PX = 56;

function MessageRow({ m, first, last, group, meId, canAct, canEdit, pickerOpen, fresh, delivery, seenBy, other, highlight, mentions, meName, h }: Props) {
  const [menuAt, setMenuAt] = useState<HTMLElement | null>(null);
  const [moreEmoji, setMoreEmoji] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [burst, setBurst] = useState(0);
  const [swipe, setSwipe] = useState(0);
  const moreRef = useRef<HTMLButtonElement>(null);
  const reactRef = useRef<HTMLButtonElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; t: number; timer: number; moved: boolean; long: boolean; axis: "" | "x" | "y" } | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef(0);

  if (m.system) {
    return (
      <div id={`msg-${m.id}`} className={`mx-system${fresh ? " is-new" : ""}`} role="note">
        {m.body}
      </div>
    );
  }

  const local = !!m.status;
  const actionable = canAct && !local && !m.removed;
  const side = m.mine ? "mine" : "theirs";
  const emojiOnly = !m.removed && !m.attachment && EMOJI_ONLY.test(m.body.trim());
  const call = !m.removed && !m.attachment ? CALL_MESSAGE.exec(m.body.trim()) : null;
  const loader = h.fileLoader(m);
  const media = !!m.attachment && !m.body && /^(image|video)\//.test(m.attachment.type);

  const menu: MenuEntry[] = [
    ...(canEdit ? [{ label: "Edit", icon: <EditIcon />, onSelect: () => h.onEdit(m) }] : []),
    { label: "Reply", icon: <ReplyIcon />, onSelect: () => h.onReply(m) },
    ...(m.body ? [{ label: "Copy text", icon: <CopyIcon />, onSelect: () => h.onCopy(m) }] : []),
    { label: "Forward", icon: <ForwardIcon />, onSelect: () => h.onForward(m) },
    { label: m.pinned ? "Unpin" : "Pin", icon: <PinIcon />, onSelect: () => h.onPin(m) },
    ...(m.attachment ? [{ label: "Download", icon: <DownloadIcon />, onSelect: () => h.onDownload(m) }] : []),
    ...(m.mine ? [{ label: "Remove for everyone", icon: <UndoIcon />, danger: true, onSelect: () => h.onUnsend(m) }] : []),
  ];

  // Reply label: "In reply to Ann", "In reply to you".
  let replyLabel = "";
  if (m.replyTo) {
    const quotedMine = m.replyTo.senderId ? m.replyTo.senderId === meId : m.replyTo.from === "yourself";
    const quotedSame = m.replyTo.senderId ? m.replyTo.senderId === m.senderId : false;
    replyLabel = quotedMine
      ? m.mine
        ? "In reply to yourself"
        : "In reply to you"
      : quotedSame
        ? "In reply to an earlier message"
        : `In reply to ${firstName(m.replyTo.from)}`;
  }
  const mentionsMe =
    !!mentions && !!meName && !m.mine && !m.removed && m.body.toLowerCase().includes(`@${meName.toLowerCase()}`);

  function quickReact() {
    if (!actionable) return;
    h.onReact(m.id, QUICK_REACTION);
    setBurst((n) => n + 1);
    navigator.vibrate?.(8);
  }

  // Touch: long-press = action sheet, double-tap = ❤️, single tap = show the time, swipe toward the middle = reply.
  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    // Links, photos, players and buttons inside a bubble keep their own taps.
    if ((e.target as Element).closest("button, a, audio, video, input, [role='slider']")) return;
    const g = { x: e.clientX, y: e.clientY, t: Date.now(), timer: 0, moved: false, long: false, axis: "" as "" | "x" | "y" };
    g.timer = window.setTimeout(() => {
      if (!g.moved && actionable) {
        g.long = true;
        navigator.vibrate?.(12);
        h.onSheet(m);
      }
    }, LONG_PRESS_MS);
    gesture.current = g;
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.axis && Math.hypot(dx, dy) > 8) {
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
      g.moved = true;
      window.clearTimeout(g.timer);
    }
    if (g.axis === "x" && actionable) {
      const toward = m.mine ? -dx : dx;
      setSwipe(Math.max(0, Math.min(80, toward)));
    }
  }
  function onPointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    window.clearTimeout(g.timer);
    if (swipe >= SWIPE_REPLY_PX && actionable) {
      navigator.vibrate?.(10);
      h.onReply(m);
    }
    setSwipe(0);
    if (g.moved || g.long || e.type === "pointercancel") return;
    // Tap: a second tap within 280 ms is a double-tap.
    const now = Date.now();
    if (now - lastTap.current < 280) {
      window.clearTimeout(tapTimer.current);
      lastTap.current = 0;
      quickReact();
      return;
    }
    lastTap.current = now;
    tapTimer.current = window.setTimeout(() => setShowTime((v) => !v), 280);
  }

  const total = m.reactions.reduce((n, r) => n + r.count, 0);
  const top = [...m.reactions].sort((a, b) => b.count - a.count).slice(0, 3);
  const deliveryMark =
    m.status === "sending" ? (
      <StatusMark status="sending" />
    ) : m.status === "failed" ? (
      <StatusMark status="failed" />
    ) : m.mine && delivery && !seenBy?.length ? (
      <StatusMark status={delivery} seenBy={delivery === "seen" ? other?.name : undefined} seenById={other?.id} />
    ) : null;

  return (
    <div
      id={`msg-${m.id}`}
      className={`mx-row is-${side}${first ? " is-first" : ""}${last ? " is-last" : ""}${fresh ? " is-new" : ""}${
        m.reactions.length ? " has-reacts" : ""
      }${menuAt ? " is-menu" : ""}${mentionsMe ? " is-mention" : ""}`}
      data-tone={m.mine ? undefined : tone(m.senderId || m.from)}
    >
      {!m.mine && <span className="mx-row-av">{last && <Avatar name={m.from} id={m.senderId} size="sm" />}</span>}
      <div className="mx-stack">
        {group && !m.mine && first && !m.replyTo && <div className="mx-name">{m.from}</div>}
        {m.forwarded && (
          <div className="mx-meta-label">
            <ForwardIcon size={12} /> {m.mine ? "You forwarded a message" : `${firstName(m.from)} forwarded a message`}
          </div>
        )}
        {m.replyTo && (
          <>
            <div className="mx-meta-label">
              <ReplyIcon size={12} /> {replyLabel}
            </div>
            <button type="button" className="mx-quote" onClick={() => h.onJump(m.replyTo!.id)}>
              {m.replyTo.removed ? <em>Message removed</em> : m.replyTo.body || (m.replyTo.attachment ? `📎 ${m.replyTo.attachment}` : "")}
            </button>
          </>
        )}
        <div className="mx-line">
          <div
            className="mx-swipe"
            style={swipe ? { transform: `translateX(${m.mine ? -swipe : swipe}px)` } : undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onContextMenu={(e) => {
              if (!actionable) return;
              e.preventDefault();
              if (gesture.current || (e.nativeEvent as PointerEvent).pointerType === "touch") return; // long-press handles touch
              setMenuAt(bubbleRef.current);
            }}
          >
            {swipe > 0 && (
              <span className={`mx-swipe-hint${swipe >= SWIPE_REPLY_PX ? " is-ready" : ""}`} aria-hidden="true">
                <ReplyIcon size={16} />
              </span>
            )}
            <div
              ref={bubbleRef}
              className={`mx-bubble${emojiOnly ? " is-emoji" : ""}${m.removed ? " is-removed" : ""}${m.status === "failed" ? " is-failed" : ""}${
                media ? " is-media" : ""
              }${call ? " is-call" : ""}${m.attachment && !media && !m.body ? " is-attach" : ""}`}
              title={fullTime(m.sentAt)}
              onDoubleClick={(e) => {
                if ((e.target as Element).closest("button, a, audio, video, [role='slider']")) return;
                window.getSelection()?.removeAllRanges(); // a double-click also selects a word
                quickReact();
              }}
            >
              {m.removed ? (
                <em>{m.mine ? "You removed a message" : `${firstName(m.from)} removed a message`}</em>
              ) : call ? (
                <span className="mx-call">
                  <span className="mx-call-icon">{call[2] === "Video" ? <VideoIcon size={20} /> : <PhoneIcon size={18} />}</span>
                  <span className="mx-call-text">
                    <strong>{call[2]} call</strong>
                    <small>Stayblz Paddock · {clock(m.sentAt)}</small>
                  </span>
                  <Link className="mx-call-join" to={`/paddock/${call[3]}`}>
                    Join
                  </Link>
                </span>
              ) : (
                <>
                  {m.attachment && (
                    <AttachmentView
                      a={m.attachment}
                      fileKey={local ? null : m.id}
                      load={loader}
                      preview={m.previewUrl}
                      mine={m.mine}
                      onOpenImage={(url) => h.onOpenImage(m, url)}
                      onError={h.onError}
                    />
                  )}
                  {m.body && <span className="mx-text">{linkify(m.body, highlight, mentions)}</span>}
                  {m.body && <LinkCards text={m.body} />}
                  {m.edited && <span className="mx-edited">Edited</span>}
                </>
              )}
              {burst > 0 && (
                <span key={burst} className="mx-burst" aria-hidden="true">
                  {QUICK_REACTION}
                </span>
              )}
              {m.reactions.length > 0 && (
                <button
                  type="button"
                  className={`mx-reacts${m.reactions.some((r) => r.mine) ? " is-mine" : ""}`}
                  aria-label={`Reactions: ${m.reactions.map((r) => `${r.emoji} ${r.count}`).join(", ")}${
                    m.reactions.some((r) => r.mine) ? ", including yours" : ""
                  }. See who reacted`}
                  onClick={() => h.onReactions(m)}
                >
                  {top.map((r) => (
                    <span key={r.emoji} className="mx-react-emoji">
                      {r.emoji}
                    </span>
                  ))}
                  {total > 1 && <span className="mx-react-count">{total}</span>}
                </button>
              )}
            </div>
          </div>
          {actionable && (
            <div className="mx-actions" role="toolbar" aria-label="Message actions">
              <button ref={reactRef} type="button" aria-label="React" aria-expanded={pickerOpen} title="React" onClick={() => h.onPicker(pickerOpen ? null : m.id)}>
                <SmileIcon size={18} />
              </button>
              <button type="button" aria-label="Reply" title="Reply" onClick={() => h.onReply(m)}>
                <ReplyIcon size={18} />
              </button>
              <button
                ref={moreRef}
                type="button"
                aria-label="More"
                title="More"
                aria-haspopup="menu"
                aria-expanded={!!menuAt}
                onClick={() => setMenuAt((v) => (v ? null : moreRef.current))}
              >
                <MoreVIcon />
              </button>
              {pickerOpen && !moreEmoji && (
                <Popover anchor={reactRef.current} align="center">
                  <div className="mx-picker" role="group" aria-label="Pick a reaction">
                    {REACTIONS.map((emoji, i) => (
                      <button
                        key={emoji}
                        type="button"
                        style={{ animationDelay: `${i * 22}ms` }}
                        aria-label={`React ${emoji}`}
                        aria-pressed={m.reactions.some((r) => r.mine && r.emoji === emoji)}
                        onClick={() => {
                          h.onReact(m.id, emoji);
                          h.onPicker(null);
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
                    }}
                    onClose={() => {
                      setMoreEmoji(false);
                      h.onPicker(null);
                    }}
                  />
                </Popover>
              )}
            </div>
          )}
          {m.mine && <span className="mx-tick">{deliveryMark}</span>}
          {menuAt && (
            <Menu anchor={menuAt} items={menu} onClose={() => setMenuAt(null)} label="Message options" align={m.mine ? "end" : "start"} />
          )}
        </div>
        {m.status === "failed" && (
          <div className="mx-status is-failed" role="status">
            Not sent.
            <button type="button" onClick={() => h.onRetry(m.clientId!)}>
              Retry
            </button>
            <button type="button" onClick={() => h.onDiscard(m.clientId!)}>
              Remove
            </button>
          </div>
        )}
        {/* Said in words too: on the free plan a send can take a few seconds. */}
        {m.status === "sending" && <div className="mx-status">{m.attachment ? "Uploading…" : "Sending…"}</div>}
        {!m.status && m.mine && delivery && !seenBy?.length && last && (
          <div className="mx-status mx-status-text" aria-hidden="true">
            {delivery === "seen" ? "Seen" : delivery === "delivered" ? "Delivered" : "Sent"}
          </div>
        )}
        {showTime && (
          <div className="mx-when">
            {dayLabel(m.sentAt)} · {clock(m.sentAt)}
            {m.pinned ? " · Pinned" : ""}
          </div>
        )}
        {!!seenBy?.length && (
          <div className="mx-seen-by" title={`Seen by ${seenBy.map((p) => p.name).join(", ")}`}>
            <StatusMark status="seen" />
            Seen by {seenBy.slice(0, 3).map((p) => firstName(p.name)).join(", ")}
            {seenBy.length > 3 ? ` +${seenBy.length - 3}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
export default memo(MessageRow);
