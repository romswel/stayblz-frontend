import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "../ui/Confirm";
import Composer from "./Composer";
import { buildTimeline, toMs } from "./format";
import { ArrowLeftIcon, Avatar, DownIcon, InfoIcon } from "./icons";
import MessageRow from "./MessageRow";
import type { ChatMessage, ChatMode, ChatPreview, ChatReply } from "./types";
import type { ThreadState } from "./useThread";

const NEAR_BOTTOM_PX = 140;

export default function ChatThread({
  mode,
  state,
  preview,
  draft,
  onDraft,
  onBack,
  onInfo,
  onAccept,
  onDecline,
  busy,
}: {
  mode: ChatMode;
  state: ThreadState;
  preview?: ChatPreview;
  draft: string;
  onDraft: (text: string) => void;
  onBack: () => void;
  onInfo: () => void;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const confirm = useConfirm();
  const { thread, messages, status } = state;
  const head = thread ?? preview;
  const [reply, setReply] = useState<ChatReply | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [newBelow, setNewBelow] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | null>(null);
  const firstId = useRef<string | null>(null);
  const keepFrom = useRef<{ height: number; top: number } | null>(null);
  /** Were you reading the newest messages? Then resizes (window, phone keyboard, banners) keep you there. */
  const stick = useRef(true);
  const group = head?.kind === "group";
  const canAct = !!thread && !thread.request;
  const timeline = useMemo(() => buildTimeline(messages), [messages]);

  const nearBottom = () => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };
  const toBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(false);
  }, []);

  // Keep the view where it should be as messages arrive: stick to the bottom when you're there
  // (or you just sent), keep your place when older messages load above, else offer a jump pill.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !messages.length) return;
    const newest = messages[messages.length - 1];
    const oldest = messages[0];
    if (keepFrom.current && oldest.id !== firstId.current) {
      el.scrollTop = el.scrollHeight - keepFrom.current.height + keepFrom.current.top;
      keepFrom.current = null;
    } else if (lastId.current === null) {
      el.scrollTop = el.scrollHeight;
    } else if (newest.id !== lastId.current) {
      if (newest.mine || nearBottom()) el.scrollTop = el.scrollHeight;
      else setNewBelow(true);
    }
    lastId.current = newest.id;
    firstId.current = oldest.id;
    stick.current = nearBottom();
  }, [messages]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Older messages load when you scroll to the top.
  const { before, olderLoading, loadOlder } = state;
  const older = useCallback(() => {
    const el = scroller.current;
    if (el) keepFrom.current = { height: el.scrollHeight, top: el.scrollTop };
    void loadOlder();
  }, [loadOlder]);
  useEffect(() => {
    const el = top.current;
    if (!el || !before || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !olderLoading) older();
      },
      { root: scroller.current, rootMargin: "120px 0px 0px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [before, olderLoading, older]);

  // Escape or a tap elsewhere closes the reaction picker / selected message.
  useEffect(() => {
    if (!picker && !selected) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && (e.target as Element | null)?.closest?.(".mx-row.is-selected, .mx-actions")) return;
      setPicker(null);
      setSelected(null);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [picker, selected]);

  const onReply = useCallback((m: ChatMessage) => {
    setReply({ id: m.id, from: m.mine ? "yourself" : m.from, body: m.body.slice(0, 160), removed: false });
    setSelected(null);
    input.current?.focus();
  }, []);
  const onCopy = useCallback((m: ChatMessage) => {
    void navigator.clipboard?.writeText(m.body).catch(() => undefined);
    setSelected(null);
  }, []);
  const { unsend, react, retrySend, discard, send, setNotice } = state;
  const onUnsend = useCallback(
    async (m: ChatMessage) => {
      setSelected(null);
      const ok = await confirm({
        title: "Unsend this message?",
        message: "It's removed for everyone in this chat. People who already read it may remember it.",
        confirmLabel: "Unsend",
        tone: "danger",
      });
      if (ok) void unsend(m.id);
    },
    [confirm, unsend],
  );
  const onJump = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
  }, []);

  function onSend(text: string) {
    send(text, reply);
    if (text === draft.trim()) onDraft("");
    setReply(null);
    requestAnimationFrame(() => toBottom());
  }

  // "Seen" under your last message when it's the newest one in the chat.
  const seen = useMemo(() => {
    const newest = messages[messages.length - 1];
    if (!thread || !newest?.mine || newest.status || newest.removed) return null;
    const at = toMs(newest.sentAt);
    const by = thread.reads.filter((r) => toMs(r.at) >= at).map((r) => r.name);
    const others = thread.members.filter((m) => !m.me && !m.pending).length;
    if (!by.length) return thread.waiting ? "Sent · waiting for them to accept" : "Sent";
    if (!group || by.length >= others) return group ? "Seen by everyone" : "Seen";
    return `Seen by ${by.slice(0, 3).join(", ")}${by.length > 3 ? ` +${by.length - 3}` : ""}`;
  }, [messages, thread, group]);

  const subtitle = !head
    ? ""
    : head.kind === "direct"
      ? head.waiting
        ? "Waiting for them to accept your request"
        : mode === "team"
          ? "Teammate"
          : "Direct message"
      : head.participants.length
        ? `You, ${head.participants.join(", ")}`
        : "Only you so far";

  return (
    <section className="mx-thread" aria-label={head ? `Chat with ${head.title}` : "Chat"}>
      <header className="mx-thread-head">
        <button type="button" className="mx-icon-btn mx-back" aria-label="Back to chats" onClick={onBack}>
          <ArrowLeftIcon />
        </button>
        {head && <Avatar name={head.title} group={group} />}
        <div className="mx-thread-title">
          <h2>{head?.title ?? "Loading…"}</h2>
          <p>
            {state.syncTrouble ? (
              <span className="mx-sync" role="status">Reconnecting…</span>
            ) : (
              subtitle
            )}
          </p>
        </div>
        {thread && (
          <button type="button" className="mx-icon-btn" aria-label="Chat details" title="Chat details" onClick={onInfo}>
            <InfoIcon />
          </button>
        )}
      </header>

      <div
        className="mx-scroll"
        ref={scroller}
        onScroll={() => {
          stick.current = nearBottom();
          if (newBelow && stick.current) setNewBelow(false);
        }}
      >
        {status === "loading" && <p className="mx-center" role="status">Loading chat…</p>}
        {status === "missing" && (
          <div className="mx-center">
            <p className="mx-empty-title">This chat isn't available</p>
            <p>It may have been deleted, or you're no longer in it.</p>
          </div>
        )}
        {status === "error" && (
          <div className="mx-center" role="alert">
            <p>{state.error}</p>
            <button type="button" className="btn btn-quiet" onClick={state.retry}>
              Try again
            </button>
          </div>
        )}
        {thread && (
          <>
            <div ref={top} className="mx-top">
              {before ? (
                <button type="button" className="mx-older" onClick={older} disabled={olderLoading}>
                  {olderLoading ? "Loading…" : "Load older messages"}
                </button>
              ) : (
                <div className="mx-intro">
                  <Avatar name={thread.title} group={group} size="lg" />
                  <p className="mx-intro-name">{thread.title}</p>
                  <p>
                    {group ? "This is the start of the group." : "Only the two of you can open this chat on Stayblz."}
                  </p>
                </div>
              )}
            </div>
            <div className="mx-timeline" role="log" aria-live="polite" aria-relevant="additions">
              {timeline.map((item) =>
                item.type === "divider" ? (
                  <div key={item.key} className="mx-divider">
                    {item.label}
                  </div>
                ) : (
                  <MessageRow
                    key={item.key}
                    m={item.message}
                    first={item.first}
                    last={item.last}
                    group={group}
                    canAct={canAct}
                    selected={selected === item.message.id}
                    pickerOpen={picker === item.message.id}
                    onSelect={setSelected}
                    onPicker={setPicker}
                    onReact={react}
                    onReply={onReply}
                    onCopy={onCopy}
                    onUnsend={onUnsend}
                    onRetry={retrySend}
                    onDiscard={discard}
                    onJump={onJump}
                  />
                ),
              )}
            </div>
            {seen && <p className="mx-seen">{seen}</p>}
          </>
        )}
      </div>

      {newBelow && (
        <button type="button" className="mx-jump" onClick={() => toBottom(true)}>
          <DownIcon /> New messages
        </button>
      )}

      {state.notice && (
        <div className="mx-notice" role="alert">
          <span>{state.notice}</span>
          <button type="button" className="mx-icon-btn" aria-label="Dismiss" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}

      {thread?.request ? (
        <div className="mx-request">
          <p>
            <strong>{thread.title}</strong> wants to message you. Accept to reply. They won't know you've read it
            until you do.
          </p>
          <div className="mx-request-actions">
            <button type="button" className="btn btn-quiet" onClick={onDecline} disabled={busy}>
              Delete
            </button>
            <button type="button" className="btn btn-primary" onClick={onAccept} disabled={busy}>
              Accept
            </button>
          </div>
        </div>
      ) : thread && thread.kind === "direct" && thread.members.length === 1 && thread.members[0].me ? (
        <p className="mx-request">The other person left this chat. You can still read it.</p>
      ) : (
        thread && (
          <Composer
            value={draft}
            onChange={onDraft}
            onSend={onSend}
            replyTo={reply}
            onCancelReply={() => setReply(null)}
            inputRef={input}
          />
        )
      )}
    </section>
  );
}
