import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useConfirm } from "../ui/Confirm";
import { downloadFile, Lightbox } from "./AttachmentView";
import ChatAvatar from "./ChatAvatar";
import Composer from "./Composer";
import { activeLabel, buildTimeline, muteLabel, toMs } from "./format";
import { ArrowLeftIcon, Avatar, ChevronIcon, CloseIcon, DownIcon, InfoIcon, MuteIcon, PhoneIcon, PinIcon, VideoIcon } from "./icons";
import { MessageSheet, PinnedDialog, ReactionsDialog, type SheetAction } from "./MessageDialogs";
import MessageRow, { type RowHandlers, type Who } from "./MessageRow";
import ThreadSearch from "./ThreadSearch";
import { EDIT_WINDOW_MS, type ChatMessage, type ChatMode, type ChatPreview, type ChatReply, type DeliveryStatus } from "./types";
import type { ThreadState } from "./useThread";

const NEAR_BOTTOM_PX = 140;
const SHOW_JUMP_PX = 480;

export default function ChatThread({
  mode,
  state,
  preview,
  meId,
  draft,
  onDraft,
  onBack,
  onInfo,
  infoOpen,
  searchSignal,
  pinnedSignal,
  onAccept,
  onDecline,
  onUnblock,
  onForward,
  onCall,
  calling,
  fileLoader,
  busy,
}: {
  mode: ChatMode;
  state: ThreadState;
  preview?: ChatPreview;
  meId: string;
  draft: string;
  onDraft: (text: string) => void;
  onBack: () => void;
  onInfo: () => void;
  infoOpen: boolean;
  /** Changes when Chat info asks to search this chat. */
  searchSignal: number;
  /** Changes when Chat info asks for the pinned messages. */
  pinnedSignal: number;
  onAccept: () => void;
  onDecline: () => void;
  onUnblock: () => void;
  onForward: (m: ChatMessage) => void;
  onCall: (video: boolean) => void;
  calling: boolean;
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
  const [picker, setPicker] = useState<string | null>(null);
  const [newBelow, setNewBelow] = useState(0);
  const [farUp, setFarUp] = useState(false);
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState("");
  const [dragging, setDragging] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; m: ChatMessage } | null>(null);
  const [sheet, setSheet] = useState<ChatMessage | null>(null);
  const [reactions, setReactions] = useState<string | null>(null);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [pinIndex, setPinIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const lastId = useRef<string | null>(null);
  const firstId = useRef<string | null>(null);
  const keepFrom = useRef<{ height: number; top: number } | null>(null);
  /** Messages already there when the chat opened don't animate in; newer ones do (older pages loaded later don't). */
  const known = useRef<Set<string> | null>(null);
  const openedAt = useRef(0);
  /** Were you reading the newest messages? Then resizes (window, phone keyboard, banners) keep you there. */
  const stick = useRef(true);
  const group = head?.kind === "group";
  const canAct = !!thread && !thread.request;
  const timeline = useMemo(() => buildTimeline(messages), [messages]);
  const other = thread?.members.find((m) => !m.me);
  if (thread && !known.current) {
    known.current = new Set(thread.messages.map((m) => m.id));
    openedAt.current = Math.max(0, ...thread.messages.map((m) => toMs(m.sentAt)).filter(Number.isFinite));
  }

  // Only requests made while this chat is open count (switching chats remounts this with the old numbers).
  const signals = useRef({ search: searchSignal, pinned: pinnedSignal });
  useEffect(() => {
    if (searchSignal !== signals.current.search) setSearching(true);
    signals.current.search = searchSignal;
  }, [searchSignal]);
  useEffect(() => {
    if (pinnedSignal !== signals.current.pinned) setPinsOpen(true);
    signals.current.pinned = pinnedSignal;
  }, [pinnedSignal]);

  const nearBottom = () => {
    const el = scroller.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };
  const toBottom = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(0);
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
      else setNewBelow((n) => n + 1);
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
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [status]);
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
      rootMargin: "160px 0px 0px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [before, olderLoading, older]);

  // Escape or a tap elsewhere closes the reaction picker.
  useEffect(() => {
    if (!picker) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e.type === "pointerdown" && (e.target as Element | null)?.closest?.(".mx-actions, .mx-emoji, .mx-popover, .mx-menu")) return;
      setPicker(null);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [picker]);

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

  const startReply = useCallback((m: ChatMessage) => {
    setEditing(null);
    setReply({
      id: m.id,
      from: m.mine ? "yourself" : m.from,
      senderId: m.senderId,
      body: m.body.slice(0, 160),
      removed: false,
      attachment: m.attachment?.name ?? null,
    });
    requestAnimationFrame(() => input.current?.focus());
  }, []);
  const askUnsend = useCallback(
    async (m: ChatMessage) => {
      const ok = await confirm({
        title: "Unsend this message?",
        message: "It's removed for everyone in this chat, including any photo, video or file. People who already saw it may remember it.",
        confirmLabel: "Unsend",
        tone: "danger",
      });
      if (ok) void unsend(m.id);
    },
    [confirm, unsend],
  );
  const download = useCallback(
    (m: ChatMessage) => {
      const load = fileLoader(m);
      if (m.attachment && load) void downloadFile(m.attachment.name, load).catch(() => setNotice("That file couldn't be downloaded. Try again."));
    },
    [fileLoader, setNotice],
  );

  const handlers: RowHandlers = useMemo(
    () => ({
      onPicker: setPicker,
      onReact: (id, emoji) => void react(id, emoji),
      onReply: startReply,
      onCopy: (m) => void navigator.clipboard?.writeText(m.body).catch(() => undefined),
      onUnsend: (m) => void askUnsend(m),
      onEdit: (m) => {
        setReply(null);
        setEditing({ id: m.id, body: m.body });
      },
      onPin: (m) => void pin(m.id, !m.pinned),
      onForward: (m) => forwardRef.current(m),
      onDownload: download,
      onRetry: retrySend,
      onDiscard: discard,
      onJump: (id) => void jump(id),
      onOpenImage: (m, url) => setViewer({ m, url }),
      onError: setNotice,
      onSheet: setSheet,
      onReactions: (m) => setReactions(m.id),
      fileLoader,
    }),
    [askUnsend, discard, download, fileLoader, jump, pin, react, retrySend, setNotice, startReply],
  );

  function sheetAction(m: ChatMessage, action: SheetAction) {
    setSheet(null);
    if (action === "reply") startReply(m);
    else if (action === "copy") void navigator.clipboard?.writeText(m.body).catch(() => undefined);
    else if (action === "forward") forwardRef.current(m);
    else if (action === "pin") void pin(m.id, !m.pinned);
    else if (action === "download") download(m);
    else if (action === "edit") {
      setReply(null);
      setEditing({ id: m.id, body: m.body });
    } else if (action === "unsend") void askUnsend(m);
  }

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

  // Receipts: one-to-one chats show ○ / ✓ / ● / their face beside your newest message; groups show who read up to where.
  const receipts = useMemo(() => {
    const sentOnly = messages.filter((m) => !m.status && !m.removed);
    const newestMine = [...sentOnly].reverse().find((m) => m.mine && !m.system);
    const seenAt = new Map<string, Who[]>();
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
        for (const m of sentOnly) if (toMs(m.sentAt) <= readAt && !m.system) target = m;
        if (target && r.name) seenAt.set(target.id, [...(seenAt.get(target.id) ?? []), { id: r.id, name: r.name }]);
      }
    }
    return { seenAt, delivery, newestMine: newestMine.id };
  }, [messages, thread, group]);

  const typingNames = thread?.typing ?? [];
  const status_ = !head
    ? ""
    : typingNames.length
      ? group
        ? typingNames.length === 1
          ? `${typingNames[0]} is typing…`
          : `${typingNames.length} people are typing…`
        : "typing…"
      : head.kind === "direct"
        ? head.waiting
          ? "Waiting for them to accept your request"
          : activeLabel(other?.active, other?.seenAt) || (mode === "team" ? "Teammate" : "Stayblz member")
        : head.participants.length
          ? `You, ${head.participants.join(", ")}`
          : "Only you so far";
  const pins = thread?.pinnedMessages ?? [];
  const pinShown = pins[pinIndex % Math.max(1, pins.length)];
  const reactionMessage = reactions ? messages.find((m) => m.id === reactions) : undefined;
  const otherWho: Who | undefined = !group && other ? { id: other.id, name: other.name } : undefined;
  const friends = thread?.direct?.friend === "friends";

  return (
    <section
      className={`mx-thread mx-card${dragging ? " is-dragging" : ""}`}
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
        <button type="button" className="mx-thread-who" onClick={onInfo} aria-label={head ? `${head.title}: chat info` : "Chat info"} disabled={!thread}>
          {head && <ChatAvatar c={head} size="md" active={head.kind === "direct" && !!other?.active} />}
          <span className="mx-thread-title">
            <span className="mx-thread-name">{head?.title ?? "Loading…"}</span>
            <span className={`mx-thread-sub${typingNames.length ? " is-typing" : ""}`}>
              {state.syncTrouble ? (
                <span className="mx-sync" role="status">
                  Reconnecting…
                </span>
              ) : (
                <>
                  {status_}
                  {head?.muted && (
                    <span className="mx-sub-muted" title={muteLabel(head.mutedUntil)}>
                      {" "}
                      · <MuteIcon size={12} />
                    </span>
                  )}
                </>
              )}
            </span>
          </span>
        </button>
        {thread && (
          <div className="mx-thread-actions">
            {canAct && !thread.direct?.blockedByMe && !thread.direct?.blockedMe && (
              <>
                <button type="button" className="mx-icon-btn is-accent" aria-label="Start a voice call" title="Voice call (Stayblz Paddock)" disabled={calling} onClick={() => onCall(false)}>
                  <PhoneIcon />
                </button>
                <button type="button" className="mx-icon-btn is-accent" aria-label="Start a video call" title="Video call (Stayblz Paddock)" disabled={calling} onClick={() => onCall(true)}>
                  <VideoIcon />
                </button>
              </>
            )}
            <button type="button" className="mx-icon-btn is-accent" aria-label="Chat info" aria-pressed={infoOpen} title="Chat info" onClick={onInfo}>
              <InfoIcon />
            </button>
          </div>
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

      {pinShown && !searching && (
        <div className="mx-pinbar">
          <PinIcon size={15} />
          <button
            type="button"
            className="mx-pinbar-text"
            title={pins.length > 1 ? "Go to this pinned message (tap again for the next one)" : "Go to the pinned message"}
            onClick={() => {
              if (!jump(pinShown.id)) setPinsOpen(true);
              setPinIndex((i) => (i + 1) % Math.max(1, pins.length));
            }}
          >
            <small>
              {pinShown.from}
              {pins.length > 1 ? ` · ${(pinIndex % pins.length) + 1} of ${pins.length}` : ""}
            </small>
            <span>{pinShown.body || (pinShown.attachment ? `📎 ${pinShown.attachment}` : "Attachment")}</span>
          </button>
          <button type="button" className="mx-icon-btn" aria-label={`See all ${pins.length} pinned messages`} title="All pinned messages" onClick={() => setPinsOpen(true)}>
            <ChevronIcon />
          </button>
        </div>
      )}

      <div
        className="mx-scroll"
        ref={scroller}
        onScroll={() => {
          const el = scroller.current;
          stick.current = nearBottom();
          if (newBelow && stick.current) setNewBelow(0);
          setFarUp(!!el && el.scrollHeight - el.scrollTop - el.clientHeight > SHOW_JUMP_PX);
          if (picker) setPicker(null); // floating pickers don't follow the scroll
        }}
      >
        <div className="mx-scroll-inner">
          {status === "loading" && (
            <div className="mx-thread-skeleton" role="status" aria-label="Loading chat">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className={i % 2 ? "is-mine" : ""} style={{ animationDelay: `${i * 90}ms` }} />
              ))}
            </div>
          )}
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
                    <ChatAvatar c={thread} size="xl" active={false} />
                    <p className="mx-intro-name">{thread.title}</p>
                    <p>
                      {group
                        ? `${thread.members.length} ${thread.members.length === 1 ? "member" : "members"} · This is the start of the group.`
                        : friends
                          ? "You're friends on Stayblz. Only the two of you can open this chat."
                          : mode === "team"
                            ? "Your teammate. Only the two of you can open this chat."
                            : "Only the two of you can open this chat on Stayblz."}
                    </p>
                    {!group && mode === "personal" && other && (
                      <Link className="mx-pill" to={`/community/people/${other.id}`}>
                        View profile
                      </Link>
                    )}
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
                      meId={meId}
                      canAct={canAct}
                      canEdit={canEdit(item.message)}
                      pickerOpen={picker === item.message.id}
                      // Your own message animates once while sending; its confirmed copy doesn't replay it.
                      fresh={
                        !!known.current &&
                        !known.current.has(item.message.id) &&
                        toMs(item.message.sentAt) >= openedAt.current &&
                        (!item.message.mine || !!item.message.status)
                      }
                      delivery={item.message.id === receipts.newestMine ? receipts.delivery : null}
                      seenBy={receipts.seenAt.get(item.message.id)}
                      other={otherWho}
                      highlight={highlight}
                      h={handlers}
                    />
                  ),
                )}
                {!!typingNames.length && (
                  <div className="mx-row is-theirs is-first is-last mx-typing-row" aria-live="polite">
                    <span className="mx-row-av">
                      <Avatar
                        name={typingNames[0]}
                        id={thread.members.find((p) => !p.me && p.name === typingNames[0])?.id}
                        size="sm"
                      />
                    </span>
                    <div className="mx-typing" aria-label={`${typingNames.join(", ")} typing`}>
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
      </div>

      {dragging && (
        <div className="mx-dropzone" aria-hidden="true">
          Drop photos, videos or files to send
        </div>
      )}
      {(newBelow > 0 || farUp) && (
        <button type="button" className={`mx-jump${newBelow ? " has-new" : ""}`} onClick={() => toBottom(true)} aria-label={newBelow ? "Go to new messages" : "Go to the newest message"}>
          <DownIcon /> {newBelow ? (newBelow === 1 ? "New message" : `${newBelow} new messages`) : null}
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
            onVoice={(file, duration) => {
              if (!canAct) return;
              sendFiles([file], reply, { duration });
              setReply(null);
              requestAnimationFrame(() => toBottom());
            }}
            onCall={onCall}
            onTyping={state.typing}
            onError={setNotice}
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

      {/* Dialogs go to <body>: this glass card's blur would otherwise trap them inside it. */}
      {createPortal(
        <>
      {viewer && viewer.m.attachment && (
        <Lightbox
          url={viewer.url}
          name={viewer.m.attachment.name}
          onClose={() => setViewer(null)}
          onDownload={() => download(viewer.m)}
        />
      )}
      {sheet && (
        <MessageSheet
          m={sheet}
          canEdit={canEdit(sheet)}
          onReact={(emoji) => {
            void react(sheet.id, emoji);
            setSheet(null);
          }}
          onAction={(action) => sheetAction(sheet, action)}
          onClose={() => setSheet(null)}
        />
      )}
      {reactionMessage && thread && (
        <ReactionsDialog
          m={reactionMessage}
          members={thread.members}
          meId={meId}
          onRemoveMine={(emoji) => {
            void react(reactionMessage.id, emoji);
            setReactions(null);
          }}
          onClose={() => setReactions(null)}
        />
      )}
      {pinsOpen && thread && (
        <PinnedDialog
          pins={pins}
          messages={messages}
          members={thread.members}
          canAct={canAct}
          fileLoader={fileLoader}
          onJump={(id) => {
            setPinsOpen(false);
            if (!jump(id)) setNotice("That message is further back. Scroll up to load more.");
          }}
          onUnpin={(id) => void pin(id, false)}
          onOpenImage={(m, url) => setViewer({ m, url })}
          onError={setNotice}
          onClose={() => setPinsOpen(false)}
        />
      )}
        </>,
        document.body,
      )}
    </section>
  );
}
