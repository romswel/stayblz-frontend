import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type MutableRefObject } from "react";
import EmojiPicker from "./EmojiPicker";
import { ACCEPT_ATTR } from "./files";
import { CloseIcon, EditIcon, PaperclipIcon, ReplyIcon, SendIcon, SmileIcon } from "./icons";
import { MAX_MESSAGE, type ChatReply } from "./types";

const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

/**
 * Message box. Enter sends on a keyboard (Shift+Enter = new line); on phones Enter adds a line.
 * 📎 attaches photos/files (also paste or drag onto the chat), 🙂 opens emoji, ↑ edits your last
 * message. While editing, the box shows the message being changed; Escape cancels.
 */
export default function Composer({
  value,
  onChange,
  onSend,
  onFiles,
  onTyping,
  replyTo,
  onCancelReply,
  editing,
  onSaveEdit,
  onCancelEdit,
  onEditLast,
  inputRef,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onFiles: (files: File[]) => void;
  onTyping: (on: boolean) => void;
  replyTo: ChatReply | null;
  onCancelReply: () => void;
  editing: { id: string; body: string } | null;
  onSaveEdit: (text: string) => void;
  onCancelEdit: () => void;
  onEditLast: () => void;
  inputRef: MutableRefObject<HTMLTextAreaElement | null>;
}) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [emoji, setEmoji] = useState(false);
  const [editText, setEditText] = useState("");
  const shown = editing ? editText : value;
  const text = shown.trim();

  useEffect(() => {
    if (editing) {
      setEditText(editing.body);
      requestAnimationFrame(() => {
        const el = local.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      });
    }
  }, [editing]);

  // Grow with the text, up to about six lines.
  useEffect(() => {
    const el = local.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [shown]);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!text || text.length > MAX_MESSAGE) return;
    if (editing) {
      if (text !== editing.body.trim()) onSaveEdit(text);
      else onCancelEdit();
      return;
    }
    onTyping(false);
    onSend(text);
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !coarse()) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      if (editing) {
        e.preventDefault();
        onCancelEdit();
      } else if (replyTo) {
        e.preventDefault();
        onCancelReply();
      }
    } else if (e.key === "ArrowUp" && !shown && !editing) {
      e.preventDefault();
      onEditLast();
    }
  }
  function change(next: string) {
    if (editing) setEditText(next);
    else {
      onChange(next);
      onTyping(next.trim().length > 0);
    }
  }
  function insert(emojiChar: string) {
    const el = local.current;
    const start = el?.selectionStart ?? shown.length;
    const end = el?.selectionEnd ?? shown.length;
    const next = shown.slice(0, start) + emojiChar + shown.slice(end);
    change(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emojiChar.length, start + emojiChar.length);
    });
  }
  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    if (editing) return;
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.length) {
      e.preventDefault();
      onFiles(files);
    }
  }

  return (
    <form className="mx-composer" onSubmit={submit}>
      {editing ? (
        <div className="mx-replying is-editing">
          <EditIcon />
          <span>
            <strong>Editing message</strong>
            <span className="mx-replying-text">{editing.body}</span>
          </span>
          <button type="button" className="mx-icon-btn" aria-label="Cancel editing" onClick={onCancelEdit}>
            <CloseIcon size={16} />
          </button>
        </div>
      ) : (
        replyTo && (
          <div className="mx-replying">
            <ReplyIcon />
            <span>
              Replying to <strong>{replyTo.from}</strong>
              <span className="mx-replying-text">{replyTo.body || (replyTo.attachment ? `📎 ${replyTo.attachment}` : "")}</span>
            </span>
            <button type="button" className="mx-icon-btn" aria-label="Cancel reply" onClick={onCancelReply}>
              <CloseIcon size={16} />
            </button>
          </div>
        )
      )}
      <div className="mx-compose-row">
        {!editing && (
          <>
            <button type="button" className="mx-compose-btn" aria-label="Attach photos or files" title="Attach photos or files" onClick={() => fileInput.current?.click()}>
              <PaperclipIcon />
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              hidden
              aria-hidden="true"
              tabIndex={-1}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) onFiles(files);
              }}
            />
          </>
        )}
        <div className="mx-compose-field">
          <textarea
            ref={(el) => {
              local.current = el;
              inputRef.current = el;
            }}
            rows={1}
            aria-label={editing ? "Edit message" : "Write a message"}
            placeholder={editing ? "Edit your message" : "Aa"}
            value={shown}
            maxLength={MAX_MESSAGE}
            onChange={(e) => change(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={() => onTyping(false)}
            enterKeyHint="send"
          />
          <button
            type="button"
            className="mx-compose-emoji"
            aria-label="Emoji"
            title="Emoji"
            aria-expanded={emoji}
            data-emoji-toggle
            onClick={() => setEmoji((v) => !v)}
          >
            <SmileIcon size={20} />
          </button>
          {emoji && (
            <div className="mx-compose-picker">
              <EmojiPicker onPick={insert} onClose={() => setEmoji(false)} />
            </div>
          )}
        </div>
        {text || editing ? (
          <button type="submit" className="mx-send" aria-label={editing ? "Save edit" : "Send"} title={editing ? "Save (Enter)" : "Send (Enter)"} disabled={!text}>
            {editing ? "✓" : <SendIcon />}
          </button>
        ) : (
          <button type="button" className="mx-send is-like" aria-label="Send a thumbs up" title="Send 👍" onClick={() => onSend("👍")}>
            👍
          </button>
        )}
      </div>
      {shown.length > MAX_MESSAGE - 500 && (
        <p className="mx-count" aria-live="polite">
          {MAX_MESSAGE - shown.length} characters left
        </p>
      )}
    </form>
  );
}
