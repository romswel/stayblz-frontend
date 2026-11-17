import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useAuth } from "../../auth";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import type { CallView, PaddockCall } from "./engine/call";
import { SendIcon } from "./icons";

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
/** Plain text with web links made clickable (opened in a new tab). */
export function Linkified({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(text.slice(last, at));
    parts.push(
      <a key={at} href={match[0]} target="_blank" rel="noopener noreferrer">
        {match[0]}
      </a>,
    );
    last = at + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function ChatTab({ view, call }: { view: CallView; call: PaddockCall }) {
  const { user } = useAuth();
  const key = (user ? accountDraftKey(user.id, `paddock.chat.${view.code}`) : null) ?? `paddock.guest-chat.${view.code}`;
  const [draft, setDraft, clear] = useDraft(key, "", { delayMs: 0 });
  const list = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const nearBottom = useRef(true);

  useEffect(() => {
    input.current?.focus();
  }, []);
  // Keep the newest message in view, unless you scrolled up to read.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [view.chat.length]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    if (text.length > 1000) return;
    call.sendChat(text);
    clear();
    nearBottom.current = true;
  }

  const canSend = view.allowed.chat;
  return (
    <div className="pd-chat">
      {view.canManage && (
        <label className="pd-switch is-compact">
          <span>
            <strong>Let everyone send messages</strong>
          </span>
          <input type="checkbox" role="switch" checked={view.rules.chat} onChange={(e) => void call.setRule("chat", e.target.checked)} />
        </label>
      )}
      <p className="pd-chat-note">Only people in the call see these messages. They disappear when the call ends.</p>
      <ol
        ref={list}
        className="pd-chat-list"
        aria-label="Messages"
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {view.chat.length === 0 && <li className="pd-chat-empty">{canSend ? "No messages yet. Say hello!" : "No messages yet."}</li>}
        {view.chat.map((line, i) => {
          const previous = view.chat[i - 1];
          const grouped = previous && previous.from === line.from && line.at - previous.at < 3 * 60_000;
          return (
            <li key={`${line.from}:${line.id}`} className={`pd-msg${line.mine ? " is-mine" : ""}${grouped ? " is-grouped" : ""}`}>
              {!grouped && (
                <span className="pd-msg-head">
                  <strong>{line.mine ? "You" : line.name}</strong>
                  <time>{clock(line.at)}</time>
                </span>
              )}
              <span className="pd-msg-body">
                <Linkified text={line.text} />
              </span>
              {line.status === "sending" && <small className="pd-msg-status">Sending…</small>}
              {line.status === "failed" && (
                <small className="pd-msg-status is-failed">
                  Not sent.{" "}
                  <button type="button" className="pd-link" onClick={() => call.retryChat(line.id)}>
                    Try again
                  </button>
                </small>
              )}
            </li>
          );
        })}
      </ol>
      {!canSend && <p className="pd-chat-off">The host turned off chat for everyone.</p>}
      <form
        className={`pd-compose${canSend ? "" : " is-off"}`}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label className="sr-only" htmlFor="pd-chat-input">
          Message everyone
        </label>
        <textarea
          id="pd-chat-input"
          ref={input}
          rows={1}
          value={draft}
          maxLength={1000}
          disabled={!canSend}
          placeholder={canSend ? "Message everyone" : "Chat is off"}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="pd-send" aria-label="Send message" title="Send (Enter)" disabled={!draft.trim() || !canSend}>
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
