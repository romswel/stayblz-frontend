import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { useConfirm } from "../ui/Confirm";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import { downloadFile, Lightbox } from "./AttachmentView";
import { CHAT_NAME, TEAM_CHAT_NAME } from "./brand";
import ChatInfo from "./ChatInfo";
import ChatSettingsDialog from "./ChatSettingsDialog";
import ChatSidebar, { type ChatAction } from "./ChatSidebar";
import ChatThread from "./ChatThread";
import { notifyChatsChanged, peopleApi, useChatApi } from "./chatApi";
import ForwardDialog from "./ForwardDialog";
import { FreePlanBanner, FreePlanDialog } from "./FreePlanNotice";
import InviteAccept from "./InviteAccept";
import NewChatDialog from "./NewChatDialog";
import PeoplePanel from "./PeoplePanel";
import { AddPeopleDialog, FolderNameDialog } from "./SmallDialogs";
import type { ChatFolder, ChatMessage, ChatMode, ChatPreview, ChatSettings, ThreadResponse } from "./types";
import { useChatList } from "./useChatList";
import { normalizeThread, previewOf, useThread } from "./useThread";
import "./messenger.css";
import "./thread.css";
import "./panels.css";

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
const readInfoPref = () => {
  try {
    return localStorage.getItem(INFO_KEY) === "1";
  } catch {
    return false;
  }
};

type Dialog =
  | null
  | { kind: "new" | "settings" | "about" | "add" }
  | { kind: "folder"; folder?: ChatFolder; assignTo?: string }
  | { kind: "forward"; message: ChatMessage };

/**
 * Stayblz Chat: chat list | conversation | chat info, filling the window. On phones the list is
 * the page and the conversation (and its info) open full screen. The open chat lives in the URL
 * (/messages/:chatId), so Back, links and refresh work.
 */
export default function Messenger({ mode }: { mode: ChatMode }) {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
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
  const [infoFocus, setInfoFocus] = useState<"pinned" | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [viewer, setViewer] = useState<{ url: string; m: ChatMessage } | null>(null);
  const appRef = useFitToWindow();
  // On narrower screens Chat info covers the conversation, so it closes when you switch chats
  // (unless it was just opened on purpose, e.g. to invite people to a new group).
  const keepInfo = useRef(false);
  useEffect(() => {
    if (keepInfo.current) {
      keepInfo.current = false;
      return;
    }
    if (window.matchMedia("(max-width: 1199px)").matches) setInfoOpen(false);
  }, [chatId]);

  useEffect(() => {
    const c = new AbortController();
    peopleApi
      .folders(c.signal)
      .then((d) => !c.signal.aborted && setFolders(Array.isArray(d?.folders) ? d.folders : []))
      .catch(() => undefined);
    return () => c.abort();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);
  const toggleInfo = (section?: "pinned") => {
    const next = section ? true : !infoOpen;
    setInfoFocus(section ?? null);
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
      setInfoOpen(true);
      setInfoFocus(null);
    }
    open(data.conversation.id);
  }

  /** Your own per-chat settings, shown at once and saved in the background. */
  async function applySetting(c: Pick<ChatPreview, "id">, changes: ChatSettings) {
    const local: Partial<ChatPreview> = {};
    if ("pinned" in changes) local.pinned = changes.pinned;
    if ("muted" in changes) local.muted = changes.muted;
    if ("archived" in changes) local.archived = changes.archived;
    if ("unread" in changes) local.unread = changes.unread;
    if ("folder" in changes) local.folderId = changes.folder ?? null;
    const before = list.items.find((x) => x.id === c.id);
    list.patch(c.id, local);
    thread.setThread((old) => (old && old.id === c.id ? { ...old, ...local } : old));
    try {
      await chatApi.settings(c.id, changes);
      notifyChatsChanged();
      if (changes.archived) setToast("Chat archived. New messages bring it back.");
      if (changes.muted) setToast("Muted. It won't count in your unread badge.");
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
      mute: { muted: true },
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
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
    if (window.matchMedia("(max-width: 1199px)").matches) setInfoOpen(false);
  };

  const team = mode === "team";
  const preview = chatId ? list.items.find((c) => c.id === chatId) : undefined;
  const showInfo = infoOpen && !!chatId && !!thread.thread;
  return (
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
            draft={drafts[chatId] ?? ""}
            onDraft={(text) => setDrafts((old) => ({ ...old, [chatId]: text }))}
            onBack={back}
            onInfo={toggleInfo}
            infoOpen={showInfo}
            onAccept={() => void accept()}
            onDecline={() => thread.thread && void leave(thread.thread)}
            onUnblock={() => void block(false)}
            onForward={(m) => setDialog({ kind: "forward", message: m })}
            fileLoader={fileLoader}
            busy={busy}
          />
        ) : (
          <div className="mx-pick-chat">
            <p className="mx-empty-title">{name}</p>
            <p>Choose a chat, or start a new one. {team ? "" : "Find people by name in People."}</p>
          </div>
        )}
      </div>

      {showInfo && thread.thread && (
        <div className="mx-info-pane">
          <ChatInfo
            mode={mode}
            thread={thread.thread}
            chatApi={chatApi}
            folders={folders}
            userId={user?.id ?? ""}
            focus={infoFocus}
            inviteOpen={inviteOpen}
            onClose={() => toggleInfo()}
            onSetting={(changes) => thread.thread && void applySetting(thread.thread, changes)}
            onLeave={() => thread.thread && void leave(thread.thread)}
            onBlock={(on) => void block(on)}
            onAddPeople={() => setDialog({ kind: "add" })}
            onRemoveMember={(id, who) => void removeMember(id, who)}
            onRenamed={(title) => {
              thread.setThread((old) => (old ? { ...old, title } : old));
              list.patch(thread.thread!.id, { title });
            }}
            onJump={jumpTo}
            onOpenImage={(m, url) => setViewer({ m, url })}
            onAbout={() => setDialog({ kind: "about" })}
            onNewFolder={() => setDialog({ kind: "folder", assignTo: thread.thread!.id })}
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
  );
}
