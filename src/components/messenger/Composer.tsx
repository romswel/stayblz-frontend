import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type MutableRefObject } from "react";
import EmojiPicker from "./EmojiPicker";
import { ACCEPT_ATTR, MEDIA_ATTR } from "./files";
import { seconds } from "./format";
import {
  Avatar,
  CloseIcon,
  EditIcon,
  FileIcon,
  ImageIcon,
  MicIcon,
  PhoneIcon,
  ReplyIcon,
  SendIcon,
  SmileIcon,
  TrashIcon,
  VideoIcon,
} from "./icons";
import Menu, { type MenuEntry } from "./Menu";
import { MAX_MESSAGE, MAX_VOICE_SECONDS, type ChatReply } from "./types";
import { canRecord, useVoiceRecorder } from "./useVoiceRecorder";

const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

/**
 * Message box (Stayblz's own layout). Left: one Attach button (photos, files, voice clip, calls). Middle:
 * "Write a message…" with emoji. Right: the mic for a voice clip while the box is empty, Send once you type.
 * Enter sends on a keyboard (Shift+Enter = new line); on phones Enter adds a line. Paste or drop files to send
 * them; ↑ edits your last message; Escape cancels a reply or edit.
 */
export default function Composer({
  value,
  onChange,
  onSend,
  onFiles,
  onVoice,
  onCall,
  onTyping,
  onError,
  replyTo,
  onCancelReply,
  editing,
  onSaveEdit,
  onCancelEdit,
  onEditLast,
  inputRef,
  mentionable,
}: {
  value: string;
  onChange: (text: string) => void;
  onSend: (text: string) => void;
  onFiles: (files: File[]) => void;
  onVoice: (file: File, duration: number) => void;
  /** Start a Stayblz Paddock call from here (omitted where calls aren't offered). */
  onCall?: (video: boolean) => void;
  onTyping: (on: boolean) => void;
  onError: (text: string) => void;
  replyTo: ChatReply | null;
  onCancelReply: () => void;
  editing: { id: string; body: string } | null;
  onSaveEdit: (text: string) => void;
  onCancelEdit: () => void;
  onEditLast: () => void;
  inputRef: MutableRefObject<HTMLTextAreaElement | null>;
  /** Group chats: people you can @mention (everyone but you). */
  mentionable?: { id: string; name: string }[];
}) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const [emoji, setEmoji] = useState(false);
  const [plus, setPlus] = useState(false);
  const [editText, setEditText] = useState("");
  const shown = editing ? editText : value;
  const text = shown.trim();
  const recorder = useVoiceRecorder(() => void finishVoice(true));
  const recording = recorder.state !== "idle";
  // "@ann" just before the caret in a group: suggest members to mention.
  const [mention, setMention] = useState<{ query: string; start: number; end: number } | null>(null);
  const [mentionAt, setMentionAt] = useState(0);
  const suggestions = mention
    ? (mentionable ?? [])
        .filter((p) => p.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(mention.query.toLowerCase())) || p.name.toLowerCase().startsWith(mention.query.toLowerCase()))
        .slice(0, 6)
    : [];

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
  function findMention(next: string, caret: number | null | undefined) {
    if (!mentionable?.length || editing) return setMention(null);
    const upTo = next.slice(0, caret ?? next.length);
    const found = /(?:^|\s)@([^\s@]{0,24})$/u.exec(upTo);
    if (!found) return setMention(null);
    setMention({ query: found[1], start: upTo.length - found[1].length - 1, end: upTo.length });
    setMentionAt(0);
  }
  function pickMention(person: { name: string }) {
    if (!mention) return;
    const insertText = `@${person.name} `;
    const next = shown.slice(0, mention.start) + insertText + shown.slice(mention.end);
    const caret = mention.start + insertText.length;
    setMention(null);
    change(next);
    requestAnimationFrame(() => {
      local.current?.focus();
      local.current?.setSelectionRange(caret, caret);
    });
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setMentionAt((i) => (i + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
        return;
      }
      if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        e.preventDefault();
        pickMention(suggestions[Math.min(mentionAt, suggestions.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        return;
      }
    }
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
  async function startVoice() {
    try {
      await recorder.start();
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "The microphone couldn't start.");
    }
  }
  async function finishVoice(keep: boolean) {
    const clip = await recorder.stop(keep);
    if (clip) onVoice(clip.file, clip.duration);
  }

  const plusItems: MenuEntry[] = [
    { label: "Photos or videos", icon: <ImageIcon size={18} />, onSelect: () => mediaInput.current?.click() },
    { label: "File", icon: <FileIcon size={18} />, onSelect: () => fileInput.current?.click() },
    ...(canRecord() ? [{ label: "Voice clip", icon: <MicIcon size={18} />, onSelect: () => void startVoice() }] : []),
    ...(onCall
      ? [
          { section: "Stayblz Paddock" },
          { label: "Voice call", icon: <PhoneIcon size={16} />, onSelect: () => onCall(false) },
          { label: "Video call", icon: <VideoIcon size={18} />, onSelect: () => onCall(true) },
        ]
      : []),
  ];

  const pick = (input: HTMLInputElement | null) => {
    const files = Array.from(input?.files ?? []);
    if (input) input.value = "";
    if (files.length) onFiles(files);
  };

  return (
    <form className={`mx-composer${recording ? " is-recording" : ""}`} onSubmit={submit}>
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
              <span>
                Replying to <strong>{replyTo.from}</strong>
              </span>
              <span className="mx-replying-text">{replyTo.body || (replyTo.attachment ? `📎 ${replyTo.attachment}` : "")}</span>
            </span>
            <button type="button" className="mx-icon-btn" aria-label="Cancel reply" onClick={onCancelReply}>
              <CloseIcon size={16} />
            </button>
          </div>
        )
      )}
      <input ref={fileInput} type="file" multiple accept={ACCEPT_ATTR} hidden aria-hidden="true" tabIndex={-1} onChange={(e) => pick(e.target)} />
      <input ref={mediaInput} type="file" multiple accept={MEDIA_ATTR} hidden aria-hidden="true" tabIndex={-1} onChange={(e) => pick(e.target)} />

      {recording ? (
        <div className="mx-recorder" role="group" aria-label="Recording a voice clip">
          <button type="button" className="mx-compose-btn is-danger" aria-label="Delete recording" title="Delete" onClick={() => void finishVoice(false)}>
            <TrashIcon />
          </button>
          <div className="mx-rec-bar">
            <span className="mx-rec-dot" aria-hidden="true" />
            <span className="mx-rec-levels" aria-hidden="true">
              {Array.from({ length: 28 }, (_, i) => {
                const level = recorder.levels[recorder.levels.length - 28 + i] ?? 0;
                return <i key={i} style={{ transform: `scaleY(${0.15 + level * 0.85})` }} />;
              })}
            </span>
            <span className="mx-rec-time" aria-live="off">
              {recorder.state === "starting" ? "Starting…" : `${seconds(recorder.elapsed)} / ${seconds(MAX_VOICE_SECONDS)}`}
            </span>
          </div>
          <button type="button" className="mx-send" aria-label="Send voice clip" title="Send" disabled={recorder.state !== "recording"} onClick={() => void finishVoice(true)}>
            <SendIcon />
          </button>
        </div>
      ) : (
        <div className="mx-compose-row">
          {!editing && (
            <button
              ref={plusRef}
              type="button"
              className="mx-compose-btn mx-attach-btn"
              aria-label="Attach: photos, files, voice clip, calls"
              title="Attach"
              aria-haspopup="menu"
              aria-expanded={plus}
              onClick={() => setPlus((v) => !v)}
            >
              <PaperclipSmall />
            </button>
          )}
          {plus && <Menu anchor={plusRef.current} items={plusItems} onClose={() => setPlus(false)} label="Attach" align="start" />}
          <div className="mx-compose-field">
            <textarea
              ref={(el) => {
                local.current = el;
                inputRef.current = el;
              }}
              rows={1}
              aria-label={editing ? "Edit message" : "Write a message"}
              placeholder={editing ? "Edit your message" : "Write a message…"}
              value={shown}
              maxLength={MAX_MESSAGE}
              onChange={(e) => {
                change(e.target.value);
                findMention(e.target.value, e.target.selectionStart);
              }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              onBlur={() => {
                onTyping(false);
                // Let a click on a suggestion land first.
                window.setTimeout(() => setMention(null), 150);
              }}
              enterKeyHint="send"
              aria-autocomplete={mentionable?.length ? "list" : undefined}
              aria-controls={suggestions.length ? "mx-mentions" : undefined}
              aria-activedescendant={suggestions.length ? `mx-mention-${Math.min(mentionAt, suggestions.length - 1)}` : undefined}
            />
            {suggestions.length > 0 && (
              <ul className="mx-mentions" id="mx-mentions" role="listbox" aria-label="Mention someone">
                {suggestions.map((person, i) => (
                  <li
                    key={person.id}
                    id={`mx-mention-${i}`}
                    role="option"
                    aria-selected={i === Math.min(mentionAt, suggestions.length - 1)}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      pickMention(person);
                    }}
                  >
                    <Avatar name={person.name} id={person.id} size="sm" />
                    <span>{person.name}</span>
                  </li>
                ))}
              </ul>
            )}
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
          {/* Empty box: the mic records a voice clip. Typing turns it into Send. */}
          {!text && !editing && canRecord() ? (
            <button type="button" className="mx-send is-mic" aria-label="Record a voice clip" title="Voice clip" onClick={() => void startVoice()}>
              <MicIcon />
            </button>
          ) : (
            <button
              type="submit"
              className="mx-send is-go"
              aria-label={editing ? "Save edit" : "Send"}
              title={editing ? "Save (Enter)" : "Send (Enter)"}
              disabled={!text}
            >
              {editing ? <span className="mx-send-check">✓</span> : <SendIcon />}
            </button>
          )}
        </div>
      )}
      {shown.length > MAX_MESSAGE - 500 && (
        <p className="mx-count" aria-live="polite">
          {MAX_MESSAGE - shown.length} characters left
        </p>
      )}
    </form>
  );
}

const PaperclipSmall = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21.4 11-8.5 8.5a6 6 0 0 1-8.5-8.5l8.5-8.5a4 4 0 0 1 5.7 5.7l-8.5 8.5a2 2 0 0 1-2.8-2.8l7.8-7.8" />
  </svg>
);
