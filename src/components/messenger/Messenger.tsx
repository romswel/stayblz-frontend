import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { useWorkspace } from "../../workspace";
import { useConfirm } from "../ui/Confirm";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import ChatDetails from "./ChatDetails";
import ChatList from "./ChatList";
import ChatThread from "./ChatThread";
import { notifyChatsChanged, useChatApi } from "./chatApi";
import { FreePlanBanner, FreePlanDialog } from "./FreePlanNotice";
import { ComposeIcon, DatabaseIcon } from "./icons";
import InviteAccept from "./InviteAccept";
import NewChatDialog from "./NewChatDialog";
import type { ChatMode, ThreadResponse } from "./types";
import { useChatList } from "./useChatList";
import { normalizeThread, previewOf, useThread } from "./useThread";
import "./messenger.css";

/**
 * Messages page: chat list + open chat side by side; on phones the open chat fills the screen.
 * The open chat lives in the URL (/messages/:chatId) so Back, links and refresh work.
 */
/**
 * Desktop: the chat panel fills the window below whatever sits above it (notices, banners), so the
 * message box is always on screen. Re-measured when the window or the page above it changes size.
 */
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
        el.style.setProperty("--mx-fit", `${Math.max(440, Math.round(window.innerHeight - top - 20))}px`);
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

export default function Messenger({ mode }: { mode: ChatMode }) {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { active: stable } = useWorkspace();
  const confirm = useConfirm();
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
  const [dialog, setDialog] = useState<null | "new" | "details" | "about">(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const panesRef = useFitToWindow();

  const open = useCallback(
    (id: string) => navigate(`${basePath}/${id}`, { state: { fromList: true } }),
    [basePath, navigate],
  );
  const back = () => {
    if ((location.state as { fromList?: boolean } | null)?.fromList) navigate(-1);
    else navigate(basePath, { replace: true });
  };

  function opened(data: ThreadResponse, { invite }: { invite: boolean }) {
    list.upsert(previewOf(normalizeThread(data.conversation)));
    setInviteOpen(invite);
    setDialog(invite ? "details" : null);
    open(data.conversation.id);
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

  async function leave() {
    const current = thread.thread;
    if (!current || busy) return;
    const request = current.request;
    const direct = current.kind === "direct";
    const ok = await confirm({
      title: request ? "Delete this request?" : direct ? "Delete this chat?" : "Leave this group?",
      message: request
        ? `${current.title} won't be told. The chat disappears from your list.`
        : direct
          ? "It's removed from your list. The other person keeps their copy."
          : "You'll stop getting messages and can only rejoin with a new invite.",
      confirmLabel: request ? "Delete request" : direct ? "Delete chat" : "Leave group",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await chatApi.leave(current.id);
      list.remove(current.id);
      setDialog(null);
      notifyChatsChanged();
      navigate(basePath, { replace: true });
    } catch (reason) {
      thread.setNotice(reason instanceof Error ? reason.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const team = mode === "team";
  const preview = chatId ? list.items.find((c) => c.id === chatId) : undefined;
  return (
    <div className={`mx${chatId ? " mx-has-thread" : ""}`}>
      <header className="mx-head">
        <div className="mx-head-text">
          <h1>{team ? "Team messages" : "Messages"}</h1>
          <p>
            {team
              ? `Private chats with people in ${stable?.name ?? "your stable"}.`
              : "Private chats about racing. No stable needed — only the people in a chat can read it."}
          </p>
        </div>
        <div className="mx-head-actions">
          <button type="button" className="btn btn-quiet mx-inline-btn" onClick={() => setDialog("about")}>
            <DatabaseIcon /> Free plan
          </button>
          <button type="button" className="btn btn-primary mx-inline-btn" onClick={() => setDialog("new")}>
            <ComposeIcon /> New chat
          </button>
        </div>
      </header>

      {!team && <InviteAccept onJoined={(id) => open(id)} />}
      <FreePlanBanner onMore={() => setDialog("about")} />

      <div className="mx-panes" ref={panesRef}>
        <ChatList
          mode={mode}
          basePath={basePath}
          items={list.items}
          status={list.status}
          error={list.error}
          stale={list.stale}
          activeId={chatId}
          onRetry={list.retry}
          onNewChat={() => setDialog("new")}
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
              onInfo={() => {
                setInviteOpen(false);
                setDialog("details");
              }}
              onAccept={() => void accept()}
              onDecline={() => void leave()}
              busy={busy}
            />
          ) : (
            <div className="mx-pick-chat">
              <p className="mx-empty-title">Pick a chat</p>
              <p>Choose a conversation on the left, or start a new one.</p>
            </div>
          )}
        </div>
      </div>

      {dialog === "new" && user && (
        <NewChatDialog mode={mode} chatApi={chatApi} userId={user.id} onClose={() => setDialog(null)} onOpened={opened} />
      )}
      {dialog === "details" && thread.thread && (
        <ChatDetails
          mode={mode}
          thread={thread.thread}
          inviteOpen={inviteOpen}
          onLeave={() => void leave()}
          onAbout={() => setDialog("about")}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "about" && <FreePlanDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
