import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type MutableRefObject } from "react";
import type { Gif } from "./chatApi";
import CommandHelp from "./CommandHelp";
import { matchCommands, runCommand, type CommandResult } from "./commands";
import EmojiPicker from "./EmojiPicker";
import { ACCEPT_ATTR, MEDIA_ATTR } from "./files";
import { seconds } from "./format";
import GifPicker, { gifSearchAvailable } from "./GifPicker";
import {
  Avatar,
  CloseIcon,
  EditIcon,
  FileIcon,
  ImageIcon,
  MicIcon,
  ReplyIcon,
  SendIcon,
  SmileIcon,
  TrashIcon,
  VideoIcon,
} from "./icons";
import Menu, { type MenuEntry } from "./Menu";
import { pastedText } from "./pasteFormat";
import { MAX_MESSAGE, MAX_VOICE_SECONDS, type ChatReply } from "./types";
import { canRecord, useVoiceRecorder } from "./useVoiceRecorder";

const coarse = () => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

/** "@…" suggestions: people in a group, plus @everyone (groups) and @highlight (any chat). */
interface Suggestion {
  id: string;
  name: string;
  special?: "everyone" | "highlight";
  hint?: string;
}
const SPECIALS: Suggestion[] = [
  { id: "@everyone", name: "everyone", special: "everyone", hint: "Notify everyone in this group" },
  { id: "@highlight", name: "highlight", special: "highlight", hint: "Make this message stand out (no alerts)" },
];

/** Ctrl/⌘ + key → the mark it wraps the selection in. */
const WRAPS: Record<string, string> = { b: "**", i: "_", e: "`" };

/**
 * Message box (Stayblz's own layout). Left: one Attach button (photos, files, GIF, voice clip, Paddock). Middle:
 * "Write a message…" with emoji. Right: the mic for a voice clip while the box is empty, Send once you type.
 * Enter sends on a keyboard (Shift+Enter = new line); on phones Enter adds a line. Paste or drop files to send them;
 * pasting formatted text keeps its formatting; ↑ edits your last message; Escape cancels a reply or edit.
 * "/" lists commands (commands.ts); "@" suggests people, @everyone and @highlight; Ctrl/⌘+B / I / E and
 * Ctrl/⌘+Shift+X format the selection.
 */
export default function Composer({
  value,
  onChange,
  onSend,
  onFiles,
  onVoice,
  onPaddock,
  onCommand,
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
  group = false,
}: {
  value: string;
  onChange: (text: string) => void;
  /** `fromBox`: it's what was typed (or a command made from it), so the saved draft can go. */
  onSend: (text: string, fromBox: boolean) => void;
  onFiles: (files: File[]) => void;
  onVoice: (file: File, duration: number) => void;
  /** Start a Stayblz Paddock for this chat (omitted where it isn't offered). */
  onPaddock?: () => void;
  /** Commands that act on the chat instead of sending (/mute, /search, /pins…). */
  onCommand: (result: CommandResult) => void;
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
  group?: boolean;
}) {
  const local = useRef<HTMLTextAreaElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);
  const [emoji, setEmoji] = useState(false);
  const [plus, setPlus] = useState(false);
  const [gif, setGif] = useState<{ query: string } | null>(null);
  const [gifsOn, setGifsOn] = useState(false);
  const [help, setHelp] = useState(false);
  const [editText, setEditText] = useState("");
  const shown = editing ? editText : value;
  const text = shown.trim();
  const recorder = useVoiceRecorder(() => void finishVoice(true));
  const recording = recorder.state !== "idle";
  // "@ann" just before the caret: suggest members to mention, plus @everyone / @highlight.
  const [mention, setMention] = useState<{ query: string; start: number; end: number } | null>(null);
  const [pickAt, setPickAt] = useState(0);
  const mentionList: Suggestion[] = mention
    ? [
        ...SPECIALS.filter((s) => (group || s.special !== "everyone") && s.name.startsWith(mention.query.toLowerCase())),
        ...(mentionable ?? [])
          .filter(
            (p) =>
              p.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(mention.query.toLowerCase())) ||
              p.name.toLowerCase().startsWith(mention.query.toLowerCase()),
          )
          .map((p) => ({ id: p.id, name: p.name })),
      ].slice(0, 7)
    : [];
  // "/mu" at the start of an empty-ish box: matching commands.
  const commandList = !editing && !mention ? matchCommands(shown, group).filter((c) => (c.name !== "gif" || gifsOn) && (c.name !== "paddock" || !!onPaddock)) : [];
  const listOpen = mentionList.length > 0 || commandList.length > 0;
  const listSize = mentionList.length || commandList.length;

  useEffect(() => {
    let live = true;
    void gifSearchAvailable().then((on) => live && setGifsOn(on));
    return () => {
      live = false;
    };
  }, []);

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

  // Grow with the text, up to about six lines; then put the cursor where an edit asked for it (same frame).
  const caretAt = useRef<[number, number] | null>(null);
  useLayoutEffect(() => {
    const el = local.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    const caret = caretAt.current;
    if (caret) {
      caretAt.current = null;
      el.focus({ preventScroll: true });
      el.setSelectionRange(caret[0], caret[1]);
    }
  }, [shown]);

  function clearBox() {
    change("");
    setMention(null);
  }
  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!text || text.length > MAX_MESSAGE) return;
    if (editing) {
      if (text !== editing.body.trim()) onSaveEdit(text);
      else onCancelEdit();
      return;
    }
    const command = runCommand(text, group);
    if (command) {
      if (command.kind === "error") return onError(command.text);
      if (command.kind === "help") {
        clearBox();
        return setHelp(true);
      }
      if (command.kind === "gif") {
        if (!gifsOn) return onError("GIF search isn't switched on yet. You can still send a GIF file with Attach.");
        clearBox();
        return setGif({ query: command.query });
      }
      if (command.kind === "send") {
        if (!command.text.trim() || command.text.length > MAX_MESSAGE) return onError("That message is empty or too long.");
        onTyping(false);
        return onSend(command.text, true);
      }
      clearBox();
      onTyping(false);
      return onCommand(command);
    }
    onTyping(false);
    onSend(text, true);
  }
  function findMention(next: string, caret: number | null | undefined) {
    if (editing) return setMention(null);
    const upTo = next.slice(0, caret ?? next.length);
    const found = /(?:^|\s)@([^\s@]{0,24})$/u.exec(upTo);
    if (!found) return setMention(null);
    setMention({ query: found[1], start: upTo.length - found[1].length - 1, end: upTo.length });
    setPickAt(0);
  }
  /** Puts the cursor (or a selection) here right after the new text is on screen — before any more typing lands. */
  function placeCaret(start: number, end = start) {
    const wanted: [number, number] = [start, end];
    caretAt.current = wanted;
    // The text didn't change (so no render): place it on the next frame instead.
    requestAnimationFrame(() => {
      if (caretAt.current !== wanted) return;
      caretAt.current = null;
      local.current?.focus({ preventScroll: true });
      local.current?.setSelectionRange(start, end);
    });
  }
  function pickMention(item: Suggestion) {
    if (!mention) return;
    const insertText = `@${item.name} `;
    const next = shown.slice(0, mention.start) + insertText + shown.slice(mention.end);
    setMention(null);
    change(next);
    placeCaret(mention.start + insertText.length);
  }
  function pickCommand(name: string) {
    const next = `/${name} `;
    change(next);
    placeCaret(next.length);
  }
  /** Ctrl/⌘+B etc.: wrap the selection (or put the marks around the caret). */
  function wrapSelection(mark: string) {
    const el = local.current;
    if (!el) return;
    const start = el.selectionStart ?? shown.length;
    const end = el.selectionEnd ?? shown.length;
    const picked = shown.slice(start, end);
    const next = shown.slice(0, start) + mark + picked + mark + shown.slice(end);
    if (next.length > MAX_MESSAGE) return;
    change(next);
    placeCaret(start + mark.length, start + mark.length + picked.length);
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (listOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setPickAt((i) => (i + (e.key === "ArrowDown" ? 1 : listSize - 1)) % listSize);
        return;
      }
      if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
        const at = Math.min(pickAt, listSize - 1);
        // A full command name + Enter runs it (e.g. "/help"); otherwise Enter completes the name.
        if (commandList.length && e.key === "Enter" && commandList[at]?.name === shown.slice(1).toLowerCase() && !commandList[at].needsText) {
          e.preventDefault();
          return submit();
        }
        e.preventDefault();
        if (mentionList.length) pickMention(mentionList[at]);
        else pickCommand(commandList[at].name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMention(null);
        if (commandList.length) change(shown + " "); // closes the list, keeps the text
        return;
      }
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey) {
      const key = e.key.toLowerCase();
      if (!e.shiftKey && WRAPS[key]) {
        e.preventDefault();
        return wrapSelection(WRAPS[key]);
      }
      if (e.shiftKey && key === "x") {
        e.preventDefault();
        return wrapSelection("~~");
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
      onTyping(next.trim().length > 0 && !next.startsWith("/"));
    }
  }
  function insertAtCaret(piece: string) {
    const el = local.current;
    const start = el?.selectionStart ?? shown.length;
    const end = el?.selectionEnd ?? shown.length;
    let add = piece;
    const room = MAX_MESSAGE - (shown.length - (end - start));
    if (add.length > room) {
      add = add.slice(0, Math.max(0, room));
      onError(`Only the first ${MAX_MESSAGE.toLocaleString()} characters fit in one message.`);
    }
    const next = shown.slice(0, start) + add + shown.slice(end);
    change(next);
    placeCaret(start + add.length);
  }
  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.length && !editing) {
      e.preventDefault();
      onFiles(files);
      return;
    }
    // Formatted text from another site, Word or Google Docs: keep its formatting and line breaks.
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    if (!html && !plain) return;
    const piece = pastedText(html, plain);
    if (piece === plain) return; // nothing to change: let the browser paste it (keeps undo history)
    e.preventDefault();
    insertAtCaret(piece);
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
  function sendGif(g: Gif) {
    setGif(null);
    onTyping(false);
    onSend(g.url, false);
  }

  const plusItems: MenuEntry[] = [
    { label: "Photos or videos", icon: <ImageIcon size={18} />, onSelect: () => mediaInput.current?.click() },
    { label: "File", icon: <FileIcon size={18} />, onSelect: () => fileInput.current?.click() },
    ...(gifsOn ? [{ label: "GIF", icon: <GifGlyph />, onSelect: () => setGif({ query: "" }) }] : []),
    ...(canRecord() ? [{ label: "Voice clip", icon: <MicIcon size={18} />, onSelect: () => void startVoice() }] : []),
    ...(onPaddock ? [{ section: "Stayblz Paddock" }, { label: "Start a Paddock", icon: <VideoIcon size={18} />, onSelect: onPaddock }] : []),
    { section: "More" },
    { label: "Commands & formatting", icon: <SlashGlyph />, onSelect: () => setHelp(true) },
  ];

  const pick = (input: HTMLInputElement | null) => {
    const files = Array.from(input?.files ?? []);
    if (input) input.value = "";
    if (files.length) onFiles(files);
  };
  const activeIndex = Math.min(pickAt, Math.max(0, listSize - 1));

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
              aria-label="Attach: photos, files, GIF, voice clip, Paddock"
              title="Attach"
              aria-haspopup="menu"
              aria-expanded={plus}
              data-gif-toggle
              onClick={() => setPlus((v) => !v)}
            >
              <PaperclipSmall />
            </button>
          )}
          {plus && <Menu anchor={plusRef.current} items={plusItems} onClose={() => setPlus(false)} label="Attach" align="start" />}
          {/* A tap anywhere in the box (not only on the words) puts the cursor in it. */}
          <div
            className="mx-compose-field"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                local.current?.focus();
              }
            }}
          >
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
              autoCapitalize="sentences"
              aria-autocomplete="list"
              aria-controls={listOpen ? "mx-suggest" : undefined}
              aria-activedescendant={listOpen ? `mx-suggest-${activeIndex}` : undefined}
            />
            {mentionList.length > 0 && (
              <ul className="mx-mentions" id="mx-suggest" role="listbox" aria-label="Mention someone">
                {mentionList.map((item, i) => (
                  <li
                    key={item.id}
                    id={`mx-suggest-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    className={item.special ? "is-special" : undefined}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      pickMention(item);
                    }}
                  >
                    {item.special ? <span className="mx-suggest-mark" aria-hidden="true">@</span> : <Avatar name={item.name} id={item.id} size="sm" />}
                    <span>
                      {item.special ? `@${item.name}` : item.name}
                      {item.hint && <small>{item.hint}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {commandList.length > 0 && (
              <ul className="mx-mentions mx-commands" id="mx-suggest" role="listbox" aria-label="Commands">
                {commandList.map((c, i) => (
                  <li
                    key={c.name}
                    id={`mx-suggest-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      pickCommand(c.name);
                    }}
                  >
                    <span className="mx-suggest-mark" aria-hidden="true">/</span>
                    <span>
                      <span className="mx-suggest-name">
                        /{c.name}
                        {c.args && <em> {c.args}</em>}
                      </span>
                      <small>{c.help}</small>
                    </span>
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
                <EmojiPicker onPick={insertAtCaret} onClose={() => setEmoji(false)} />
              </div>
            )}
            {gif && (
              <div className="mx-compose-picker is-gifs">
                <GifPicker initialQuery={gif.query} onPick={sendGif} onClose={() => setGif(null)} />
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
      {help && <CommandHelp group={group} onClose={() => setHelp(false)} />}
    </form>
  );
}

const PaperclipSmall = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21.4 11-8.5 8.5a6 6 0 0 1-8.5-8.5l8.5-8.5a4 4 0 0 1 5.7 5.7l-8.5 8.5a2 2 0 0 1-2.8-2.8l7.8-7.8" />
  </svg>
);
const GifGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <path d="M10 10.2a2 2 0 0 0-3.5 1.3v1a2 2 0 0 0 3.5 1.3V12H8.6M12.8 9.5v5M15.6 14.5v-5h2.8M15.6 12h2.2" />
  </svg>
);
const SlashGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="m14.5 7-5 10" />
  </svg>
);
