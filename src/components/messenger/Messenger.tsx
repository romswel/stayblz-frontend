import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { createRequestId } from "../../requestId";
import { setViewingChat } from "../../notifications/viewing";
import { useWorkspace } from "../../workspace";
import { useConfirm } from "../ui/Confirm";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import { downloadFile, Lightbox } from "./AttachmentView";
import { CHAT_NAME, TEAM_CHAT_NAME } from "./brand";
import { startChatCall } from "./callLink";
import { ChatApiContext } from "./ChatAvatar";
import ChatInfo from "./ChatInfo";
import ChatSettingsDialog from "./ChatSettingsDialog";
import ChatSidebar, { type ChatAction } from "./ChatSidebar";
import ChatThread from "./ChatThread";
import { notifyChatsChanged, peopleApi, useChatApi } from "./chatApi";
import { setChatLimits } from "./files";
import ForwardDialog from "./ForwardDialog";
import { FreePlanBanner, FreePlanDialog } from "./FreePlanNotice";
import InviteAccept from "./InviteAccept";
import NewChatDialog from "./NewChatDialog";
import PeoplePanel from "./PeoplePanel";
import { AddPeopleDialog, FolderNameDialog, MuteDialog, RenameDialog } from "./SmallDialogs";
import type { ChatFolder, ChatMessage, ChatMode, ChatPreview, ChatSettings, ThreadResponse } from "./types";
import { useChatList } from "./useChatList";
import { normalizeThread, previewOf, useThread } from "./useThread";
import "./messenger.css";
import "./thread.css";
import "./panels.css";
import "./chat-identity.css";

/** The app fills the window under the site header, so the message box is always on screen. */
function useFitToWindow() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = el.getBoundingClientRect().top + window.scrollY;
        el.style.setProperty("--mx-fit", `${Math.max(460, Math.round(window.innerHeight - top))}px`);
      });
    };
    fit();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(fit) : null;
    observer?.observe(document.body);
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);
  return ref;
}

const INFO_KEY = "stayblz.chat.infoOpen";
/** Below this width Chat info covers the conversation instead of being a third column (see messenger.css). */
const INFO_OVERLAY = "(max-width: 1499px)";
const readInfoPref = () => {
  try {
    return localStorage.getItem(INFO_KEY) === "1";
  } catch {
    return false;
  }
};

type Dialog =
  | null
  | { kind: "new" | "settings" | "about" | "add" | "rename" }
  | { kind: "mute"; chat: Pick<ChatPreview, "id" | "title"> }
  | { kind: "folder"; folder?: ChatFolder; assignTo?: string }
  | { kind: "forward"; message: ChatMessage };

/**
 * Stayblz Chat: chat list | conversation | chat info, three glass cards filling the window. On phones the list
 * is the page and the conversation (and its info) open full screen. The open chat lives in the URL
 * (/messages/:chatId), so Back, links, notifications and refresh work.
 */
export default function Messenger({ mode }: { mode: ChatMode }) {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const { user } = useAuth();
  const { active: stable, stables, select } = useWorkspace();
  const confirm = useConfirm();
  const name = mode === "team" ? TEAM_CHAT_NAME : CHAT_NAME;
  const basePath = mode === "team" ? "/team-messages" : "/messages";
  const chatApi = useChatApi(mode);
  const list = useChatList(chatApi);
  const thread = useThread(chatApi, chatId, {
    userId: user?.id ?? "",
    displayName: user?.displayName ?? "You",
    onPreview: list.upsert,
    onPatch: list.patch,
  });
  // Unsent replies per chat, kept on this device until sent (cleared on log out).
  const [drafts, setDrafts] = useDraft<Record<string, string>>(accountDraftKey(user?.id, `messages.${mode}`), {}, {
    isEmpty: (all) => Object.values(all).every((text) => !text.trim()),
  });
  const [dialog, setDialog] = useState<Dialog>(null);
  const [infoOpen, setInfoOpen] = useState(readInfoPref);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [calling, setCalling] = useState(false);
  const [toast, setToast] = useState("");
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [viewer, setViewer] = useState<{ url: string; m: ChatMessage } | null>(null);
  const [searchSignal, setSearchSignal] = useState(0);
  const [pinnedSignal, setPinnedSignal] = useState(0);
  const appRef = useFitToWindow();
  // On narrower screens Chat info covers the conversation, so it closes when you switch chats
  // (unless it was just opened on purpose, e.g. to invite people to a new group).
  const keepInfo = useRef(false);
  useEffect(() => {
    if (keepInfo.current) {
      keepInfo.current = false;
      return;
    }
    if (window.matchMedia(INFO_OVERLAY).matches) setInfoOpen(false);
  }, [chatId]);

  // Notifications skip the chat you're looking at.
  useEffect(() => {
    setViewingChat(chatId ? `${mode}:${chatId}` : null);
    return () => setViewingChat(null);
  }, [chatId, mode]);

  // A team-chat link from a notification says which stable it belongs to.
  const stableParam = search.get("stable");
  useEffect(() => {
    if (!stableParam || mode !== "team") return;
    if (stables.some((s) => s.id === stableParam) && stable?.id !== stableParam) select(stableParam);
    if (stables.length) {
      search.delete("stable");
      setSearch(search, { replace: true });
    }
  }, [stableParam, mode, stables, stable?.id, select, search, setSearch]);

  useEffect(() => {
    const c = new AbortController();
    peopleApi
      .folders(c.signal)
      .then((d) => !c.signal.aborted && setFolders(Array.isArray(d?.folders) ? d.folders : []))
      .catch(() => undefined);
    // The real file limits (bigger when the server stores files in Cloudflare R2).
    peopleApi
      .profile(c.signal)
      .then((d) => !c.signal.aborted && setChatLimits(d?.limits))
      .catch(() => undefined);
    return () => c.abort();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);
  const toggleInfo = (next = !infoOpen) => {
    setInfoOpen(next);
    try {
      localStorage.setItem(INFO_KEY, next ? "1" : "0");
    } catch {
      /* Remembered for this visit only. */
    }
  };

  const open = useCallback((id: string) => navigate(`${basePath}/${id}`, { state: { fromList: true } }), [basePath, navigate]);
  const back = () => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) navigate(-1);
    else navigate(basePath, { replace: true });
  };
  function opened(data: ThreadResponse, { invite }: { invite: boolean }) {
    list.upsert(previewOf(normalizeThread(data.conversation)));
    setInviteOpen(invite);
    setDialog(null);
    if (invite) {
      keepInfo.current = true;
      toggleInfo(true);
    }
    open(data.conversation.id);
  }

  /** Your own per-chat settings, shown at once and saved in the background. */
  async function applySetting(c: Pick<ChatPreview, "id">, changes: ChatSettings) {
    const local: Partial<ChatPreview> = {};
    if ("pinned" in changes) local.pinned = changes.pinned;
    if ("muted" in changes) {
      local.muted = changes.muted;
      local.mutedUntil = null;
    }
    if (changes.muteMinutes) {
      local.muted = true;
      local.mutedUntil = new Date(Date.now() + changes.muteMinutes * 60_000).toISOString();
    }
    if ("archived" in changes) local.archived = changes.archived;
    if ("unread" in changes) local.unread = changes.unread;
    if ("folder" in changes) local.folderId = changes.folder ?? null;
    const before = list.items.find((x) => x.id === c.id);
    list.patch(c.id, local);
    thread.setThread((old) => (old && old.id === c.id ? { ...old, ...local } : old));
    try {
      const saved = await chatApi.settings(c.id, changes);
      if ("mutedUntil" in (saved?.settings ?? {})) {
        const sync = { muted: !!saved.settings.muted, mutedUntil: saved.settings.mutedUntil ?? null };
        list.patch(c.id, sync);
        thread.setThread((old) => (old && old.id === c.id ? { ...old, ...sync } : old));
      }
      notifyChatsChanged();
      if (changes.archived) setToast("Chat archived. New messages bring it back.");
      if (changes.muted || changes.muteMinutes) setToast("Muted. No alerts, and it won't count in your unread badge.");
      if (changes.muted === false) setToast("Notifications are back on for this chat.");
    } catch (reason) {
      if (before) list.patch(c.id, before);
      thread.setThread((old) => (old && old.id === c.id && before ? { ...old, ...before } : old));
      setToast(reason instanceof Error ? reason.message : "That setting wasn't saved.");
    }
  }

  async function leave(c: Pick<ChatPreview, "id" | "title" | "kind" | "request">) {
    if (busy) return;
    const direct = c.kind === "direct";
    const ok = await confirm({
      title: c.request ? "Delete this request?" : direct ? "Delete this chat?" : "Leave this group?",
      message: c.request
        ? `${c.title} won't be told. The chat disappears from your list.`
        : direct
          ? "It's removed from your list. The other person keeps their copy."
          : "You'll stop getting messages and can only come back if someone adds you.",
      confirmLabel: c.request ? "Delete request" : direct ? "Delete chat" : "Leave group",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await chatApi.leave(c.id);
      list.remove(c.id);
      setDialog(null);
      notifyChatsChanged();
      if (c.id === chatId) navigate(basePath, { replace: true });
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onAction(c: ChatPreview, action: ChatAction) {
    if (action === "delete") return void leave(c);
    if (action === "mute") return setDialog({ kind: "mute", chat: c });
    if (action === "read") {
      list.patch(c.id, { unread: false });
      return void chatApi.read(c.id).then(notifyChatsChanged, () => undefined);
    }
    if (action.startsWith("folder:")) {
      const id = action.slice(7);
      return void applySetting(c, { folder: id === "none" ? null : id });
    }
    const map: Record<string, ChatSettings> = {
      pin: { pinned: true },
      unpin: { pinned: false },
      unread: { unread: true },
      unmute: { muted: false },
      archive: { archived: true },
      unarchive: { archived: false },
    };
    void applySetting(c, map[action]);
  }

  async function accept() {
    const current = thread.thread;
    if (!current || busy) return;
    setBusy(true);
    try {
      await chatApi.accept(current.id);
      thread.setThread((old) => (old && old.id === current.id ? { ...old, request: false } : old));
      list.patch(current.id, { request: false });
      notifyChatsChanged();
    } catch (reason) {
      thread.setNotice(reason instanceof Error ? reason.message : "Request could not be accepted.");
    } finally {
      setBusy(false);
    }
  }

  async function block(on: boolean) {
    const current = thread.thread;
    const other = current?.members.find((m) => !m.me);
    if (!current || !other || busy) return;
    if (on) {
      const ok = await confirm({
        title: `Block ${other.name}?`,
        message: "They won't be able to message you or find you, and you won't be able to message them. They aren't told. You can unblock them in Settings.",
        confirmLabel: "Block",
        tone: "danger",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await peopleApi.block(other.id, on);
      thread.setThread((old) =>
        old && old.id === current.id ? { ...old, direct: { friend: "none", blockedMe: false, ...old.direct, blockedByMe: on } } : old,
      );
      setToast(on ? `${other.name} is blocked.` : `${other.name} is unblocked.`);
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(id: string, who: string) {
    const current = thread.thread;
    if (!current) return;
    const ok = await confirm({ title: `Remove ${who}?`, message: "They'll leave the group and stop getting its messages.", confirmLabel: "Remove", tone: "danger" });
    if (!ok) return;
    try {
      await chatApi.removeMember(current.id, id);
      thread.retry();
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "They couldn't be removed.");
    }
  }

  async function messageMember(id: string) {
    try {
      opened(await peopleApi.chatWith(id), { invite: false });
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "The chat could not be opened.");
    }
  }

  /** Voice or video call: a Stayblz Paddock meeting with everyone here invited, its link posted in the chat. */
  async function call(video: boolean) {
    const current = thread.thread;
    if (!current || calling) return;
    setCalling(true);
    try {
      const made = await startChatCall(current, mode, video);
      // Sent straight away (not through the outbox), because this page closes as the call opens.
      await chatApi.send(current.id, made.message, createRequestId(), null).then(notifyChatsChanged, () => undefined);
      navigate(made.path);
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : "The call couldn't be started. Try again.");
    } finally {
      setCalling(false);
    }
  }

  async function saveFolder(nameText: string, folder?: ChatFolder, assignTo?: string) {
    if (folder) {
      const { folder: saved } = await peopleApi.renameFolder(folder.id, nameText);
      setFolders((old) => old.map((f) => (f.id === saved.id ? saved : f)));
    } else {
      const { folder: created } = await peopleApi.createFolder(nameText);
      setFolders((old) => [...old, created]);
      if (assignTo) void applySetting({ id: assignTo }, { folder: created.id });
    }
    setDialog(folder ? { kind: "settings" } : null);
  }
  async function deleteFolder(f: ChatFolder) {
    await peopleApi.deleteFolder(f.id);
    setFolders((old) => old.filter((x) => x.id !== f.id));
    for (const c of list.items) if (c.folderId === f.id) list.patch(c.id, { folderId: null });
  }

  const fileLoader = useCallback(
    (m: ChatMessage) => (m.status || !chatId ? null : () => chatApi.file(chatId, m.id)),
    [chatApi, chatId],
  );
  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return setToast("That message is further back. Scroll up in the chat to load it.");
    if (window.matchMedia(INFO_OVERLAY).matches) toggleInfo(false);
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
  };

  // Links from notifications: ?m=<message> shows that message (a mention, reply or reaction);
  // ?people=1 opens People (friend requests).
  const messageParam = search.get("m");
  const loadedId = thread.thread?.id;
  useEffect(() => {
    if (!messageParam || !chatId || loadedId !== chatId) return;
    const timer = window.setTimeout(() => {
      jumpTo(messageParam);
      setSearch(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("m");
          return next;
        },
        { replace: true },
      );
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageParam, chatId, loadedId]);
  const [peopleSignal, setPeopleSignal] = useState(0);
  const peopleParam = search.get("people");
  useEffect(() => {
    if (!peopleParam) return;
    if (mode === "personal") setPeopleSignal((n) => n + 1);
    setSearch(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("people");
        return next;
      },
      { replace: true },
    );
  }, [peopleParam, mode, setSearch]);

  const team = mode === "team";
  const preview = chatId ? list.items.find((c) => c.id === chatId) : undefined;
  const showInfo = infoOpen && !!chatId && !!thread.thread;
  // Escape closes Chat info when it covers the conversation (not while a dialog or menu is open on top).
  useEffect(() => {
    if (!showInfo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !window.matchMedia(INFO_OVERLAY).matches) return;
      if (document.querySelector(".modal, .mx-menu, .mx-popover")) return;
      toggleInfo(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  const narrowInfo = () => window.matchMedia(INFO_OVERLAY).matches;
  return (
    <ChatApiContext.Provider value={chatApi}>
      <div ref={appRef} className={`mx${chatId ? " mx-has-thread" : ""}${showInfo ? " mx-has-info" : ""}`}>
        <ChatSidebar
          mode={mode}
          title={name}
          basePath={basePath}
          items={list.items}
          status={list.status}
          error={list.error}
          stale={list.stale}
          activeId={chatId}
          folders={folders}
          onRetry={list.retry}
          onNewChat={() => setDialog({ kind: "new" })}
          onSettings={() => setDialog({ kind: "settings" })}
          onNewFolder={(assignTo) => setDialog({ kind: "folder", assignTo })}
          onAction={onAction}
          openPeople={peopleSignal}
          people={team ? undefined : <PeoplePanel onOpen={(data) => opened(data, { invite: false })} />}
          notice={
            <>
              {!team && <InviteAccept onJoined={(id) => open(id)} />}
              <FreePlanBanner onMore={() => setDialog({ kind: "about" })} />
            </>
          }
        />

        <div className="mx-thread-pane">
          {chatId ? (
            <ChatThread
              key={chatId}
              mode={mode}
              state={thread}
              preview={preview}
              meId={user?.id ?? ""}
              draft={drafts[chatId] ?? ""}
              onDraft={(text) => setDrafts((old) => ({ ...old, [chatId]: text }))}
              onBack={back}
              onInfo={() => toggleInfo()}
              infoOpen={showInfo}
              searchSignal={searchSignal}
              pinnedSignal={pinnedSignal}
              onAccept={() => void accept()}
              onDecline={() => thread.thread && void leave(thread.thread)}
              onUnblock={() => void block(false)}
              onForward={(m) => setDialog({ kind: "forward", message: m })}
              onCall={(video) => void call(video)}
              calling={calling}
              fileLoader={fileLoader}
              busy={busy}
            />
          ) : (
            <div className="mx-pick-chat mx-card">
              <span className="mx-pick-art" aria-hidden="true">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
                  <path d="M8 9h8M8 13h5" />
                </svg>
              </span>
              <p className="mx-empty-title">{name}</p>
              <p>Pick a chat, or start a new one. {team ? "" : "Find people by name in People."}</p>
              <button type="button" className="btn btn-primary mx-inline-btn" onClick={() => setDialog({ kind: "new" })}>
                New chat
              </button>
            </div>
          )}
        </div>

        {showInfo && thread.thread && (
          <div className="mx-info-pane">
            <ChatInfo
              key={thread.thread.id}
              mode={mode}
              thread={thread.thread}
              chatApi={chatApi}
              folders={folders}
              userId={user?.id ?? ""}
              inviteOpen={inviteOpen}
              onClose={() => toggleInfo(false)}
              onSetting={(changes) => thread.thread && void applySetting(thread.thread, changes)}
              onMute={() => thread.thread && setDialog({ kind: "mute", chat: thread.thread })}
              onLeave={() => thread.thread && void leave(thread.thread)}
              onBlock={(on) => void block(on)}
              onAddPeople={() => setDialog({ kind: "add" })}
              onRemoveMember={(id, who) => void removeMember(id, who)}
              onMessageMember={(id) => void messageMember(id)}
              onRename={() => setDialog({ kind: "rename" })}
              onPhotoChanged={(photo) => {
                const id = thread.thread!.id;
                thread.setThread((old) => (old && old.id === id ? { ...old, photo } : old));
                list.patch(id, { photo });
                setToast(photo ? "Group photo updated." : "Group photo removed.");
              }}
              onSearch={() => {
                if (narrowInfo()) toggleInfo(false);
                setSearchSignal((n) => n + 1);
              }}
              onPinned={() => setPinnedSignal((n) => n + 1)}
              onJump={jumpTo}
              onOpenImage={(m, url) => setViewer({ m, url })}
              onAbout={() => setDialog({ kind: "about" })}
              onNewFolder={() => setDialog({ kind: "folder", assignTo: thread.thread!.id })}
              onError={setToast}
              fileLoader={fileLoader}
            />
          </div>
        )}

        {toast && (
          <div className="mx-toast" role="status">
            {toast}
          </div>
        )}

        {dialog?.kind === "new" && user && (
          <NewChatDialog mode={mode} chatApi={chatApi} userId={user.id} onClose={() => setDialog(null)} onOpened={opened} />
        )}
        {dialog?.kind === "settings" && (
          <ChatSettingsDialog
            name={name}
            folders={folders}
            onNewFolder={() => setDialog({ kind: "folder" })}
            onRenameFolder={(f) => setDialog({ kind: "folder", folder: f })}
            onDeleteFolder={deleteFolder}
            onAbout={() => setDialog({ kind: "about" })}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog?.kind === "folder" && (
          <FolderNameDialog
            initial={dialog.folder?.name}
            onSave={(text) => saveFolder(text, dialog.folder, dialog.assignTo)}
            onClose={() => setDialog(dialog.folder ? { kind: "settings" } : null)}
          />
        )}
        {dialog?.kind === "mute" && (
          <MuteDialog
            title={dialog.chat.title}
            onClose={() => setDialog(null)}
            onMute={(minutes) => {
              const chat = dialog.chat;
              setDialog(null);
              void applySetting(chat, minutes ? { muteMinutes: minutes } : { muted: true });
            }}
          />
        )}
        {dialog?.kind === "rename" && thread.thread && (
          <RenameDialog
            initial={thread.thread.title}
            onClose={() => setDialog(null)}
            onSave={async (title) => {
              const id = thread.thread!.id;
              await chatApi.rename(id, title);
              thread.setThread((old) => (old && old.id === id ? { ...old, title } : old));
              list.patch(id, { title });
              setDialog(null);
            }}
          />
        )}
        {dialog?.kind === "forward" && chatId && (
          <ForwardDialog
            chatApi={chatApi}
            fromId={chatId}
            message={dialog.message}
            chats={list.items}
            onClose={() => setDialog(null)}
            onDone={(n) => {
              setDialog(null);
              setToast(n > 1 ? `Forwarded to ${n} chats.` : "Forwarded.");
              notifyChatsChanged();
            }}
          />
        )}
        {dialog?.kind === "add" && thread.thread && (
          <AddPeopleDialog
            mode={mode}
            chatApi={chatApi}
            chatId={thread.thread.id}
            memberIds={thread.thread.members.map((m) => m.id)}
            onClose={() => setDialog(null)}
            onAdded={() => {
              setDialog(null);
              thread.retry();
            }}
          />
        )}
        {dialog?.kind === "about" && <FreePlanDialog onClose={() => setDialog(null)} />}
        {viewer && viewer.m.attachment && (
          <Lightbox
            url={viewer.url}
            name={viewer.m.attachment.name}
            onClose={() => setViewer(null)}
            onDownload={() => {
              const load = fileLoader(viewer.m);
              if (load) void downloadFile(viewer.m.attachment!.name, load).catch(() => setToast("That file couldn't be downloaded."));
            }}
          />
        )}
      </div>
    </ChatApiContext.Provider>
  );
}
