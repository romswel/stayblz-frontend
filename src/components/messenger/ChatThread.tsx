import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useConfirm } from "../ui/Confirm";
import { downloadFile } from "./AttachmentView";
import ChatAvatar from "./ChatAvatar";
import { plainText } from "./chatFormat";
import type { CommandResult } from "./commands";
import Composer from "./Composer";
import { fileProblem, stageFile, type StagedFile } from "./files";
import { buildTimeline, mentionPattern, muteLabel, presenceLabel, presenceOf, toMs } from "./format";
import { ArrowLeftIcon, Avatar, ChevronIcon, CloseIcon, DownIcon, InfoIcon, MuteIcon, PinIcon, VideoIcon } from "./icons";
import MediaViewer, { mediaItems } from "./MediaViewer";
import { MessageSheet, PinnedDialog, ReactionsDialog, type SheetAction } from "./MessageDialogs";
import MessageRow, { type RowHandlers, type Who } from "./MessageRow";
import ThreadSearch from "./ThreadSearch";
import { EDIT_WINDOW_MS, type ChatMessage, type ChatMode, type ChatPreview, type ChatReply, type DeliveryStatus } from "./types";
import type { ThreadState } from "./useThread";

const NEAR_BOTTOM_PX = 140;
const SHOW_JUMP_PX = 480;
/** Files that can wait in the message box at once (the outbox sends at most 10 in one go). */
const MAX_STAGED = 10;
const hasFiles = (e: { dataTransfer: DataTransfer | null }) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

/** The chat's loaded photos, videos and GIFs; one opened from further back (pinned list) still shows on its own. */
function viewerItems(messages: ChatMessage[], open: ChatMessage) {
  const items = mediaItems(messages);
  return items.some((i) => i.id === open.id) ? items : mediaItems([open]);
}

export default function ChatThread({
  mode,
  state,
  preview,
  meId,
  draft,
  onDraft,
  staged,
  onStaged,
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
  onChatCommand,
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
  /** This chat's files waiting in the box, and a way to change them (kept per chat, like drafts). */
  staged: StagedFile[];
  onStaged: (update: (old: StagedFile[]) => StagedFile[]) => void;
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
  /** Start this chat's Stayblz Paddock (video meeting; the link is posted in the chat). */
  onCall: (video: boolean) => void;
  /** Typed commands that change the chat itself: /mute, /unmute, /rename, /leave. */
  onChatCommand: (command: CommandResult) => void;
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
  const [searchStart, setSearchStart] = useState("");
  const [highlight, setHighlight] = useState("");
  const [dragging, setDragging] = useState(false);
  /** Files dragged in, pasted or picked: they wait in the message box until you press Send (kept per chat by Messenger). */
  const stagedRef = useRef(staged);
  stagedRef.current = staged;
  /** The photo / video / GIF open in the viewer (it steps through all of the chat's loaded media). */
  const [viewer, setViewer] = useState<ChatMessage | null>(null);
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
  /**
   * Where you'd read up to when the chat opened (your read time; newer servers send it), fixed at opening: the chat
   * opens at the first message after it, under an "Unread messages" line, instead of at the bottom. NaN = no line.
   */
  const readMark = useRef<number | undefined>(undefined);
  if (thread && readMark.current === undefined) {
    const at = thread.readAt === undefined ? NaN : thread.readAt === null ? 0 : toMs(thread.readAt);
    readMark.current = thread.unread && !thread.request && Number.isFinite(at) ? at : NaN;
  }
  const loadedAll = !state.before;
  const unreadFrom = useMemo(() => {
    const mark = readMark.current;
    if (mark === undefined || !Number.isFinite(mark)) return null;
    // Only once the spot where you stopped reading is loaded: with more unread than one page, older pages hold unread
    // messages too, and a line above the oldest loaded one would wrongly mark those as read.
    if (!loadedAll && !messages.some((m) => !m.status && toMs(m.sentAt) <= mark)) return null;
    return messages.find((m) => !m.mine && !m.system && !m.status && toMs(m.sentAt) > mark)?.id ?? null;
  }, [messages, loadedAll]);
  // The line starts a new group, so the first unread message shows who sent it.
  const timeline = useMemo(() => buildTimeline(messages, new Date(), unreadFrom), [messages, unreadFrom]);
  const viewerList = useMemo(() => (viewer ? viewerItems(messages, viewer) : []), [messages, viewer]);
  // Groups: @mentions of members (shown as chips), and the people you can mention.
  const members = thread?.members;
  const meName = members?.find((p) => p.me)?.name ?? "";
  const mentions = useMemo(() => (group && members ? mentionPattern([...members.map((p) => p.name), "everyone"]) : null), [group, members]);
  const mentionable = useMemo(
    () => (group && members ? members.filter((p) => !p.me && !p.pending).map((p) => ({ id: p.id, name: p.name })) : undefined),
    [group, members],
  );
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
      // Opening: at your first unread message when there is one (with a little room above it); when even the oldest
      // loaded message is unread, at the top (older pages load above it); else the newest.
      const line = unreadFrom ? el.querySelector<HTMLElement>(".mx-unread-line") : null;
      const mark = readMark.current;
      const allUnread = !line && mark !== undefined && Number.isFinite(mark) && !loadedAll;
      el.scrollTop = line
        ? Math.max(0, line.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12)
        : allUnread
          ? 0
          : el.scrollHeight;
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
        title: "Remove this message for everyone?",
        message: "It's removed for everyone in this chat, including any photo, video or file. People who already saw it may remember it.",
        confirmLabel: "Remove for everyone",
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
      onOpenImage: (m) => setViewer(m),
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

  /**
   * Send: the words first (they carry the reply), then the files waiting in the box. Words arrive in a moment while
   * files still upload, so this is also the order everyone sees them in. Only Send from the box takes the waiting files
   * (picking a GIF sends just the GIF).
   */
  function onSend(text: string, fromBox: boolean) {
    const files = canAct && fromBox ? stagedRef.current : [];
    if (text) send(text, reply);
    if (files.length) {
      sendFiles(
        files.map((s) => s.file),
        text ? null : reply,
      );
      files.forEach((s) => s.url && URL.revokeObjectURL(s.url));
      onStaged(() => []);
    }
    if (fromBox) onDraft("");
    setReply(null);
    requestAnimationFrame(() => toBottom());
  }
  /** "/search", "/pins", "/info", "/paddock" here; "/mute", "/rename", "/leave"… in Messenger. */
  function onCommand(command: CommandResult) {
    if (command.kind === "search") {
      setSearchStart(command.query);
      setSearching(true);
    } else if (command.kind === "pins") {
      if (pins.length) setPinsOpen(true);
      else setNotice("Nothing is pinned in this chat yet. Pin a message from its ⋯ menu.");
    } else if (command.kind === "info") {
      if (!infoOpen) onInfo();
    } else if (command.kind === "paddock") onCall(true);
    else onChatCommand(command);
  }
  /**
   * Files dragged in (from the computer or from Stayblz itself), pasted, or picked with Attach: they wait in the
   * message box with a preview until you press Send. Files that can't be sent are said at once instead.
   */
  function addFiles(list: File[]) {
    if (!canAct || !list.length) return;
    if (editing) return setNotice("Finish or cancel your edit first, then add the files.");
    const problems: string[] = [];
    const added: StagedFile[] = [];
    let room = MAX_STAGED - stagedRef.current.length;
    for (const file of list) {
      const problem = fileProblem(file);
      if (problem) problems.push(problem);
      else if (room <= 0) {
        problems.push(`Up to ${MAX_STAGED} files in one message. Send these first, then add more.`);
        break;
      } else {
        added.push(stageFile(file));
        room--;
      }
    }
    if (added.length) {
      onStaged((old) => [...old, ...added]);
      // On a computer, Enter now sends them; phones keep their keyboard down.
      if (!window.matchMedia?.("(pointer: coarse)").matches) requestAnimationFrame(() => input.current?.focus());
    }
    if (problems.length) setNotice(problems[0] + (problems.length > 1 ? ` (and ${problems.length - 1} more)` : ""));
  }
  function removeStaged(id: string) {
    const gone = stagedRef.current.find((s) => s.id === id);
    if (gone?.url) URL.revokeObjectURL(gone.url);
    onStaged((old) => old.filter((s) => s.id !== id));
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
          : presenceLabel(other) || (mode === "team" ? "Teammate" : "Stayblz member")
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
      className={`mx-thread mx-card${group ? " is-group" : ""}${dragging ? " is-dragging" : ""}`}
      aria-label={head ? `Chat with ${head.title}` : "Chat"}
      // Dropped files (from the computer, or a photo dragged from Stayblz itself) wait in the message box: never sent
      // until you press Send. Over a chat you can't write in, the drop does nothing (the browser doesn't open it).
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = canAct && !editing ? "copy" : "none";
        if (canAct && !editing) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files ?? []));
      }}
    >
      <header className="mx-thread-head">
        <button type="button" className="mx-icon-btn mx-back" aria-label="Back to chats" onClick={onBack}>
          <ArrowLeftIcon />
        </button>
        <button type="button" className="mx-thread-who" onClick={onInfo} aria-label={head ? `${head.title}: chat info` : "Chat info"} disabled={!thread}>
          {head && <ChatAvatar c={head} size="md" presence={head.kind === "direct" ? (other ? presenceOf(other) : undefined) : null} />}
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
              <button
                type="button"
                className="mx-head-btn is-paddock"
                aria-label="Start a Paddock for this chat"
                title="Start a Paddock: a video meeting for this chat (you can share its link)"
                disabled={calling}
                onClick={() => onCall(true)}
              >
                <VideoIcon size={17} />
                <span>{calling ? "Starting…" : "Paddock"}</span>
              </button>
            )}
            <button type="button" className="mx-head-btn is-info" aria-label="Chat info" aria-pressed={infoOpen} title="Chat info" onClick={onInfo}>
              <InfoIcon size={17} />
              <span>Details</span>
            </button>
          </div>
        )}
      </header>

      {searching && thread && (
        <ThreadSearch
          initialQuery={searchStart}
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
            setSearchStart("");
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
            <span>{pinShown.body ? plainText(pinShown.body) : pinShown.attachment ? `📎 ${pinShown.attachment}` : "Attachment"}</span>
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
                    <ChatAvatar c={thread} size="lg" presence={null} />
                    <div className="mx-intro-text">
                      <span className="mx-intro-kicker">{group ? "Group chat" : mode === "team" ? "Team chat" : "Private chat"}</span>
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
                    </div>
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
                    <Fragment key={item.key}>
                      {item.message.id === unreadFrom && (
                        <div className="mx-unread-line" role="separator">
                          <span>Unread messages</span>
                        </div>
                      )}
                    <MessageRow
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
                      mentions={mentions}
                      meName={meName}
                      h={handlers}
                    />
                    </Fragment>
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
          Drop to add to your message
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
            onAddFiles={addFiles}
            files={staged}
            onRemoveFile={removeStaged}
            mentions={mentions}
            meName={meName}
            onVoice={(file, duration) => {
              if (!canAct) return;
              sendFiles([file], reply, { duration });
              setReply(null);
              requestAnimationFrame(() => toBottom());
            }}
            onPaddock={() => onCall(true)}
            onCommand={onCommand}
            group={group}
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
            mentionable={mentionable}
            inputRef={input}
          />
        )
      )}

      {/* Dialogs go to <body>: this glass card's blur would otherwise trap them inside it. */}
      {createPortal(
        <>
      {viewer && (
        <MediaViewer
          items={viewerList}
          startId={viewer.id}
          fileLoader={fileLoader}
          onClose={() => setViewer(null)}
          onDownload={download}
          onShowInChat={(m) => {
            setViewer(null);
            requestAnimationFrame(() => {
              if (!jump(m.id)) setNotice("That message is further back. Scroll up to load more.");
            });
          }}
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
          onOpenImage={(m) => setViewer(m)}
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
