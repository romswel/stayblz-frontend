import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "../ui/Confirm";
import { downloadFile, Lightbox } from "./AttachmentView";
import Composer from "./Composer";
import { activeLabel, buildTimeline, toMs } from "./format";
import { ArrowLeftIcon, Avatar, CloseIcon, DownIcon, InfoIcon, PinIcon, SearchIcon } from "./icons";
import MessageRow, { type RowHandlers } from "./MessageRow";
import ThreadSearch from "./ThreadSearch";
import { EDIT_WINDOW_MS, type ChatMessage, type ChatMode, type ChatPreview, type ChatReply, type DeliveryStatus } from "./types";
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
  infoOpen,
  onAccept,
  onDecline,
  onUnblock,
  onForward,
  fileLoader,
  busy,
}: {
  mode: ChatMode;
  state: ThreadState;
  preview?: ChatPreview;
  draft: string;
  onDraft: (text: string) => void;
  onBack: () => void;
  onInfo: (section?: "pinned") => void;
  infoOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onUnblock: () => void;
  onForward: (m: ChatMessage) => void;
  fileLoader: (m: ChatMessage) => (() => Promise<Blob>) | null;
  busy: boolean;
}) {
  const confirm = useConfirm();
  const forwardRef = useRef(onForward);
  forwardRef.current = onForward;
  const { thread, messages, status } = state;
  const head = thread ?? preview;
  const [reply, setReply] = useState<ChatReply | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [newBelow, setNewBelow] = useState(false);
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState("");
  const [dragging, setDragging] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; m: ChatMessage } | null>(null);
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
  const other = thread?.members.find((m) => !m.me);

  const nearBottom = () => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };
  const toBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(false);
  }, []);

  // Stick to the bottom when you're there (or just sent), keep your place when older messages load.
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
  // Typing bubble appearing at the bottom keeps you at the bottom.
  useEffect(() => {
    if (thread?.typing.length && stick.current) toBottom();
  }, [thread?.typing.length, toBottom]);

  const { before, olderLoading, loadOlder } = state;
  const older = useCallback(() => {
    const el = scroller.current;
    if (el) keepFrom.current = { height: el.scrollHeight, top: el.scrollTop };
    void loadOlder();
  }, [loadOlder]);
  useEffect(() => {
    const el = top.current;
    if (!el || !before || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && !olderLoading && older(), {
      root: scroller.current,
      rootMargin: "120px 0px 0px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [before, olderLoading, older]);

  // Escape or a tap elsewhere closes the reaction picker / selected message.
  useEffect(() => {
    if (!picker && !selected) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && (e.target as Element | null)?.closest?.(".mx-row.is-selected, .mx-actions, .mx-emoji, .mx-popover, .mx-menu")) return;
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

  const canEdit = useCallback(
    (m: ChatMessage) => m.mine && !m.attachment && !m.removed && !m.status && !m.system && Date.now() - toMs(m.sentAt) < EDIT_WINDOW_MS,
    [],
  );
  const jump = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
    return true;
  }, []);
  const { unsend, react, retrySend, discard, send, sendFiles, setNotice, edit, pin } = state;

  const handlers: RowHandlers = useMemo(
    () => ({
      onSelect: setSelected,
      onPicker: setPicker,
      onReact: (id, emoji) => void react(id, emoji),
      onReply: (m) => {
        setEditing(null);
        setReply({ id: m.id, from: m.mine ? "yourself" : m.from, body: m.body.slice(0, 160), removed: false, attachment: m.attachment?.name ?? null });
        setSelected(null);
        input.current?.focus();
      },
      onCopy: (m) => {
        void navigator.clipboard?.writeText(m.body).catch(() => undefined);
        setSelected(null);
      },
      onUnsend: async (m) => {
        setSelected(null);
        const ok = await confirm({
          title: "Unsend this message?",
          message: "It's removed for everyone in this chat, including any photo or file. People who already saw it may remember it.",
          confirmLabel: "Unsend",
          tone: "danger",
        });
        if (ok) void unsend(m.id);
      },
      onEdit: (m) => {
        setReply(null);
        setSelected(null);
        setEditing({ id: m.id, body: m.body });
      },
      onPin: (m) => {
        setSelected(null);
        void pin(m.id, !m.pinned);
      },
      onForward: (m) => {
        setSelected(null);
        forwardRef.current(m);
      },
      onDownload: (m) => {
        const load = fileLoader(m);
        if (m.attachment && load) void downloadFile(m.attachment.name, load).catch(() => setNotice("That file couldn't be downloaded. Try again."));
      },
      onRetry: retrySend,
      onDiscard: discard,
      onJump: (id) => void jump(id),
      onOpenImage: (m, url) => setViewer({ m, url }),
      onError: setNotice,
      fileLoader,
    }),
    [confirm, discard, fileLoader, jump, pin, react, retrySend, setNotice, unsend],
  );

  function onSend(text: string) {
    send(text, reply);
    if (text === draft.trim()) onDraft("");
    setReply(null);
    requestAnimationFrame(() => toBottom());
  }
  function onFiles(files: File[]) {
    if (!canAct || !files.length) return;
    sendFiles(files, reply);
    setReply(null);
    requestAnimationFrame(() => toBottom());
  }
  function editLast() {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (canEdit(messages[i])) return setEditing({ id: messages[i].id, body: messages[i].body });
      if (messages[i].mine && !messages[i].system) return;
    }
  }

  // Receipts: direct chats show ✓ / ● / avatar under your newest message; groups show who read up to where.
  const receipts = useMemo(() => {
    const sentOnly = messages.filter((m) => !m.status && !m.removed);
    const newestMine = [...sentOnly].reverse().find((m) => m.mine && !m.system);
    const seenAt = new Map<string, string[]>();
    let delivery: DeliveryStatus | null = null;
    if (!thread || !newestMine) return { seenAt, delivery, newestMine: null as string | null };
    const at = toMs(newestMine.sentAt);
    if (thread.reads.some((r) => toMs(r.at) >= at)) delivery = "seen";
    else if (thread.delivered.some((d) => toMs(d.at) >= at)) delivery = "delivered";
    else delivery = "sent";
    if (group) {
      for (const r of thread.reads) {
        const readAt = toMs(r.at);
        let target: ChatMessage | undefined;
        for (const m of sentOnly) if (toMs(m.sentAt) <= readAt) target = m;
        if (target && r.name) seenAt.set(target.id, [...(seenAt.get(target.id) ?? []), r.name]);
      }
    }
    return { seenAt, delivery, newestMine: newestMine.id };
  }, [messages, thread, group]);

  const subtitle = !head
    ? ""
    : thread?.typing.length
      ? `${thread.typing.length === 1 ? (group ? thread.typing[0] + " is" : "") : thread.typing.length + " people are"} typing…`.trim()
      : head.kind === "direct"
        ? head.waiting
          ? "Waiting for them to accept your request"
          : activeLabel(other?.active, other?.seenAt) || (mode === "team" ? "Teammate" : "Stayblz member")
        : head.participants.length
          ? `You, ${head.participants.join(", ")}`
          : "Only you so far";
  const latestPin = thread?.pinnedMessages[0];

  return (
    <section
      className={`mx-thread${dragging ? " is-dragging" : ""}`}
      aria-label={head ? `Chat with ${head.title}` : "Chat"}
      onDragOver={(e) => {
        if (canAct && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!canAct) return;
        e.preventDefault();
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files ?? []));
      }}
    >
      <header className="mx-thread-head">
        <button type="button" className="mx-icon-btn mx-back" aria-label="Back to chats" onClick={onBack}>
          <ArrowLeftIcon />
        </button>
        {head && <Avatar name={head.title} group={group} active={head.kind === "direct" && !!other?.active} />}
        <div className="mx-thread-title">
          <h2>{head?.title ?? "Loading…"}</h2>
          <p className={thread?.typing.length ? "is-typing" : undefined}>
            {state.syncTrouble ? <span className="mx-sync" role="status">Reconnecting…</span> : subtitle}
          </p>
        </div>
        {thread && (
          <>
            <button type="button" className="mx-icon-btn" aria-label="Search in chat" aria-pressed={searching} title="Search in chat" onClick={() => setSearching((v) => !v)}>
              <SearchIcon size={20} />
            </button>
            <button type="button" className="mx-icon-btn" aria-label="Chat info" aria-pressed={infoOpen} title="Chat info" onClick={() => onInfo()}>
              <InfoIcon />
            </button>
          </>
        )}
      </header>

      {searching && thread && (
        <ThreadSearch
          search={(q, signal) => state.searchIn(q, signal)}
          onHighlight={setHighlight}
          onPick={async (id) => {
            for (let i = 0; i < 6 && !jump(id); i++) {
              if (!state.before) break;
              older();
              await new Promise((r) => setTimeout(r, 450));
            }
            if (!document.getElementById(`msg-${id}`)) setNotice("That message is further back. Scroll up to load more.");
          }}
          onClose={() => {
            setSearching(false);
            setHighlight("");
          }}
        />
      )}

      {latestPin && !searching && (
        <div className="mx-pinbar">
          <PinIcon size={14} />
          <button type="button" className="mx-pinbar-text" onClick={() => jump(latestPin.id) || onInfo("pinned")}>
            <strong>{latestPin.from}:</strong> {latestPin.body || (latestPin.attachment ? `📎 ${latestPin.attachment}` : "")}
          </button>
          {thread!.pinnedMessages.length > 1 && (
            <button type="button" className="mx-link" onClick={() => onInfo("pinned")}>
              All {thread!.pinnedMessages.length}
            </button>
          )}
        </div>
      )}

      <div
        className="mx-scroll"
        ref={scroller}
        onScroll={() => {
          stick.current = nearBottom();
          if (newBelow && stick.current) setNewBelow(false);
          if (picker) setPicker(null); // floating pickers don't follow the scroll
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
                  <p>{group ? "This is the start of the group." : "Only the two of you can open this chat on Stayblz."}</p>
                </div>
              )}
            </div>
            <div className="mx-timeline" role="log" aria-live="polite" aria-relevant="additions">
              {timeline.map((item) =>
                item.type === "day" ? (
                  <div key={item.key} className="mx-day" role="separator">
                    <span>{item.label}</span>
                  </div>
                ) : item.type === "time" ? (
                  <div key={item.key} className="mx-time">
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
                    canEdit={canEdit(item.message)}
                    selected={selected === item.message.id}
                    pickerOpen={picker === item.message.id}
                    delivery={item.message.id === receipts.newestMine ? receipts.delivery : null}
                    seenBy={receipts.seenAt.get(item.message.id)}
                    directSeenName={!group ? other?.name : undefined}
                    highlight={highlight}
                    h={handlers}
                  />
                ),
              )}
              {!!thread.typing.length && (
                <div className="mx-row is-theirs is-first is-last mx-typing-row" aria-live="polite">
                  <span className="mx-row-av">
                    <Avatar name={thread.typing[0]} size="sm" />
                  </span>
                  <div className="mx-typing" aria-label={`${thread.typing.join(", ")} typing`}>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {dragging && (
        <div className="mx-dropzone" aria-hidden="true">
          Drop photos or files to send
        </div>
      )}
      {newBelow && (
        <button type="button" className="mx-jump" onClick={() => toBottom(true)}>
          <DownIcon /> New messages
        </button>
      )}
      {state.notice && (
        <div className="mx-notice" role="alert">
          <span>{state.notice}</span>
          <button type="button" className="mx-icon-btn" aria-label="Dismiss" onClick={() => setNotice("")}>
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {thread?.request ? (
        <div className="mx-request">
          <p>
            <strong>{thread.title}</strong> wants to message you. Accept to reply. They won't know you've read it until you do.
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
      ) : thread?.direct?.blockedByMe ? (
        <div className="mx-request">
          <p>You blocked {thread.title}. They can't message you, and you can't message them.</p>
          <div className="mx-request-actions">
            <button type="button" className="btn btn-quiet" onClick={onUnblock} disabled={busy}>
              Unblock
            </button>
          </div>
        </div>
      ) : thread?.direct?.blockedMe ? (
        <p className="mx-request">You can't reply to this conversation.</p>
      ) : thread && thread.kind === "direct" && thread.members.length === 1 && thread.members[0].me ? (
        <p className="mx-request">The other person left this chat. You can still read it.</p>
      ) : (
        thread && (
          <Composer
            value={draft}
            onChange={onDraft}
            onSend={onSend}
            onFiles={onFiles}
            onTyping={state.typing}
            replyTo={reply}
            onCancelReply={() => setReply(null)}
            editing={editing}
            onSaveEdit={(text) => {
              if (editing) void edit(editing.id, text);
              setEditing(null);
            }}
            onCancelEdit={() => setEditing(null)}
            onEditLast={editLast}
            inputRef={input}
          />
        )
      )}

      {viewer && viewer.m.attachment && (
        <Lightbox
          url={viewer.url}
          name={viewer.m.attachment.name}
          onClose={() => setViewer(null)}
          onDownload={() => {
            const load = fileLoader(viewer.m);
            if (load) void downloadFile(viewer.m.attachment!.name, load).catch(() => setNotice("That file couldn't be downloaded."));
          }}
        />
      )}
    </section>
  );
}
