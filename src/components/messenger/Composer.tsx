import { useEffect, useRef, type FormEvent, type KeyboardEvent, type MutableRefObject } from "react";
import { SendIcon } from "./icons";
import { MAX_MESSAGE, type ChatReply } from "./types";

const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

/**
 * Message box. Enter sends on a keyboard (Shift+Enter for a new line); on phones Enter adds a
 * line and the Send button sends. Empty box shows a quick 👍.
 */
export default function Composer({
  value,
  onChange,
  onSend,
  replyTo,
  onCancelReply,
  inputRef,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  replyTo: ChatReply | null;
  onCancelReply: () => void;
  inputRef: MutableRefObject<HTMLTextAreaElement | null>;
}) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  const text = value.trim();

  // Grow with the text, up to about six lines.
  useEffect(() => {
    const el = local.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!text || text.length > MAX_MESSAGE) return;
    onSend(text);
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !coarse()) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape" && replyTo) {
      e.preventDefault();
      onCancelReply();
    }
  }

  return (
    <form className="mx-composer" onSubmit={submit}>
      {replyTo && (
        <div className="mx-replying">
          <span>
            Replying to <strong>{replyTo.from}</strong>
            <span className="mx-replying-text">{replyTo.body}</span>
          </span>
          <button type="button" className="mx-icon-btn" aria-label="Cancel reply" onClick={onCancelReply}>
            ×
          </button>
        </div>
      )}
      <div className="mx-compose-row">
        <textarea
          ref={(el) => {
            local.current = el;
            inputRef.current = el;
          }}
          rows={1}
          aria-label="Write a message"
          placeholder="Aa"
          value={value}
          maxLength={MAX_MESSAGE}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          enterKeyHint="send"
        />
        {text ? (
          <button type="submit" className="mx-send" aria-label="Send" title="Send (Enter)">
            <SendIcon />
          </button>
        ) : (
          <button type="button" className="mx-send is-like" aria-label="Send a thumbs up" title="Send 👍" onClick={() => onSend("👍")}>
            👍
          </button>
        )}
      </div>
      {value.length > MAX_MESSAGE - 500 && (
        <p className="mx-count" aria-live="polite">
          {MAX_MESSAGE - value.length} characters left
        </p>
      )}
    </form>
  );
}
