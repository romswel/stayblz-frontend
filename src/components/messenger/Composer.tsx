import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type MutableRefObject } from "react";
import EmojiPicker from "./EmojiPicker";
import { ACCEPT_ATTR, MEDIA_ATTR } from "./files";
import { seconds } from "./format";
import {
  ChevronRightIcon,
  CloseIcon,
  EditIcon,
  FileIcon,
  ImageIcon,
  MicIcon,
  PhoneIcon,
  PlusCircleIcon,
  ReplyIcon,
  SendIcon,
  SmileIcon,
  ThumbIcon,
  TrashIcon,
  VideoIcon,
} from "./icons";
import Menu, { type MenuEntry } from "./Menu";
import { MAX_MESSAGE, MAX_VOICE_SECONDS, type ChatReply } from "./types";
import { canRecord, useVoiceRecorder } from "./useVoiceRecorder";

const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

/**
 * Message box, Messenger style. Left: (+) more, photo/video, voice clip — they fold into one arrow while
 * you type. Middle: "Aa" with emoji. Right: 👍 when empty, send when there's text.
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
}) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const [emoji, setEmoji] = useState(false);
  const [plus, setPlus] = useState(false);
  const [editText, setEditText] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const shown = editing ? editText : value;
  const text = shown.trim();
  const recorder = useVoiceRecorder(() => void finishVoice(true));
  const recording = recorder.state !== "idle";
  // While typing, the left buttons fold into one arrow (tap it to get them back).
  const folded = !!text && !toolsOpen;

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
  useEffect(() => {
    if (!text) setToolsOpen(false);
  }, [text]);

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
    { label: "Photo or video", icon: <ImageIcon size={18} />, onSelect: () => mediaInput.current?.click() },
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
            <div className={`mx-compose-tools${folded ? " is-folded" : ""}`}>
              {folded ? (
                <button type="button" className="mx-compose-btn" aria-label="Show more options" title="More" onClick={() => setToolsOpen(true)}>
                  <ChevronRightIcon size={22} />
                </button>
              ) : (
                <>
                  <button
                    ref={plusRef}
                    type="button"
                    className="mx-compose-btn"
                    aria-label="More: files, voice clip, calls"
                    title="More"
                    aria-haspopup="menu"
                    aria-expanded={plus}
                    onClick={() => setPlus((v) => !v)}
                  >
                    <PlusCircleIcon />
                  </button>
                  <button type="button" className="mx-compose-btn" aria-label="Attach photos or videos" title="Photos & videos" onClick={() => mediaInput.current?.click()}>
                    <ImageIcon />
                  </button>
                  <button type="button" className="mx-compose-btn" aria-label="Attach a file" title="Attach a file" onClick={() => fileInput.current?.click()}>
                    <PaperclipSmall />
                  </button>
                  {canRecord() && (
                    <button type="button" className="mx-compose-btn" aria-label="Record a voice clip" title="Voice clip" onClick={() => void startVoice()}>
                      <MicIcon />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {plus && <Menu anchor={plusRef.current} items={plusItems} onClose={() => setPlus(false)} label="More" align="start" />}
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
              onFocus={() => setToolsOpen(false)}
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
              <SmileIcon size={22} />
            </button>
            {emoji && (
              <div className="mx-compose-picker">
                <EmojiPicker onPick={insert} onClose={() => setEmoji(false)} />
              </div>
            )}
          </div>
          {text || editing ? (
            <button
              type="submit"
              className="mx-send is-go"
              aria-label={editing ? "Save edit" : "Send"}
              title={editing ? "Save (Enter)" : "Send (Enter)"}
              disabled={!text}
            >
              {editing ? <span className="mx-send-check">✓</span> : <SendIcon />}
            </button>
          ) : (
            <button type="button" className="mx-send is-like" aria-label="Send a thumbs up" title="Send 👍" onClick={() => onSend("👍")}>
              <ThumbIcon />
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
