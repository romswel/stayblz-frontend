import { memo } from "react";
import { fullTime, linkify } from "./format";
import { Avatar, CopyIcon, ReplyIcon, SmileIcon, UndoIcon } from "./icons";
import { REACTIONS, type ChatMessage } from "./types";

/** One to three emoji and nothing else are shown large, without a bubble. */
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*){1,3}$/u;

interface Props {
  m: ChatMessage;
  first: boolean;
  last: boolean;
  group: boolean;
  /** False while a message request is pending (you can read but not react or reply). */
  canAct: boolean;
  selected: boolean;
  pickerOpen: boolean;
  onSelect: (id: string | null) => void;
  onPicker: (id: string | null) => void;
  onReact: (id: string, emoji: string) => void;
  onReply: (m: ChatMessage) => void;
  onCopy: (m: ChatMessage) => void;
  onUnsend: (m: ChatMessage) => void;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onJump: (id: string) => void;
}

function MessageRow({
  m, first, last, group, canAct, selected, pickerOpen,
  onSelect, onPicker, onReact, onReply, onCopy, onUnsend, onRetry, onDiscard, onJump,
}: Props) {
  const local = !!m.status;
  const actionable = canAct && !local && !m.removed;
  const side = m.mine ? "mine" : "theirs";
  const emojiOnly = !m.removed && EMOJI_ONLY.test(m.body.trim());
  return (
    <div
      id={`msg-${m.id}`}
      className={`mx-row is-${side}${first ? " is-first" : ""}${last ? " is-last" : ""}${selected ? " is-selected" : ""}`}
    >
      {!m.mine && <span className="mx-row-av">{last && <Avatar name={m.from} size="sm" />}</span>}
      <div className="mx-stack">
        {group && !m.mine && first && <div className="mx-name">{m.from}</div>}
        {m.replyTo && (
          <button type="button" className="mx-quote" onClick={() => onJump(m.replyTo!.id)}>
            <ReplyIcon />
            <span>
              <strong>{m.replyTo.from}</strong>{" "}
              {m.replyTo.removed ? <em>Message unsent</em> : m.replyTo.body}
            </span>
          </button>
        )}
        <div className="mx-line">
          <div
            className={`mx-bubble${emojiOnly ? " is-emoji" : ""}${m.removed ? " is-removed" : ""}${m.status === "failed" ? " is-failed" : ""}`}
            title={fullTime(m.sentAt)}
            onClick={() => actionable && onSelect(selected ? null : m.id)}
          >
            {m.removed ? <em>{m.mine ? "You unsent a message" : `${m.from} unsent a message`}</em> : linkify(m.body)}
          </div>
          {actionable && (
            <div className="mx-actions" role="toolbar" aria-label="Message actions">
              <button type="button" aria-label="React" aria-expanded={pickerOpen} title="React"
                onClick={() => onPicker(pickerOpen ? null : m.id)}>
                <SmileIcon />
              </button>
              <button type="button" aria-label="Reply" title="Reply" onClick={() => onReply(m)}>
                <ReplyIcon />
              </button>
              <button type="button" aria-label="Copy text" title="Copy" onClick={() => onCopy(m)}>
                <CopyIcon />
              </button>
              {m.mine && (
                <button type="button" aria-label="Unsend" title="Unsend" onClick={() => onUnsend(m)}>
                  <UndoIcon />
                </button>
              )}
              {pickerOpen && (
                <div className="mx-picker" role="group" aria-label="Pick a reaction">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      aria-label={`React ${emoji}`}
                      aria-pressed={m.reactions.some((r) => r.mine && r.emoji === emoji)}
                      onClick={() => {
                        onReact(m.id, emoji);
                        onPicker(null);
                        onSelect(null);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
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
                onClick={() => onReact(m.id, r.emoji)}
              >
                {r.emoji}
                {r.count > 1 && <span>{r.count}</span>}
              </button>
            ))}
          </div>
        )}
        {m.status === "sending" && <div className="mx-status">Sending…</div>}
        {m.status === "failed" && (
          <div className="mx-status is-failed" role="status">
            Not sent.{" "}
            <button type="button" onClick={() => onRetry(m.clientId!)}>
              Retry
            </button>
            <button type="button" onClick={() => onDiscard(m.clientId!)}>
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default memo(MessageRow);
