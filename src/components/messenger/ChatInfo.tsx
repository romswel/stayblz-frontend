import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import ConversationInvites from "../my-racing/ConversationInvites";
import AttachmentView from "./AttachmentView";
import type { ChatApi } from "./chatApi";
import { activeLabel, dayLabel, isImage } from "./format";
import { normalizeMessage } from "./threadModel";
import {
  ArchiveIcon,
  Avatar,
  BellIcon,
  BlockIcon,
  CloseIcon,
  DatabaseIcon,
  FolderIcon,
  LeaveIcon,
  MuteIcon,
  PinIcon,
  PlusIcon,
  UnreadIcon,
  UserPlusIcon,
} from "./icons";
import type { ChatFolder, ChatMessage, ChatMode, ChatSettings, ChatThread } from "./types";

function Section({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="mx-info-sec" open={open}>
      <summary>{title}</summary>
      <div className="mx-info-body">{children}</div>
    </details>
  );
}

/**
 * Chat info (the right-hand panel): who's here, pinned messages, media & files, group name and
 * members, and your own options (mute, pin, folder, archive, block, leave).
 */
export default function ChatInfo({
  mode,
  thread,
  chatApi,
  folders,
  userId,
  focus,
  inviteOpen,
  onClose,
  onSetting,
  onLeave,
  onBlock,
  onAddPeople,
  onRemoveMember,
  onRenamed,
  onJump,
  onOpenImage,
  onAbout,
  onNewFolder,
  fileLoader,
}: {
  mode: ChatMode;
  thread: ChatThread;
  chatApi: ChatApi;
  folders: ChatFolder[];
  userId: string;
  focus?: "pinned" | null;
  inviteOpen: boolean;
  onClose: () => void;
  onSetting: (changes: ChatSettings) => void;
  onLeave: () => void;
  onBlock: (block: boolean) => void;
  onAddPeople: () => void;
  onRemoveMember: (id: string, name: string) => void;
  onRenamed: (title: string) => void;
  onJump: (id: string) => void;
  onOpenImage: (m: ChatMessage, url: string) => void;
  onAbout: () => void;
  onNewFolder: () => void;
  fileLoader: (m: ChatMessage) => (() => Promise<Blob>) | null;
}) {
  const direct = thread.kind === "direct";
  const other = thread.members.find((m) => !m.me);
  const admin = thread.createdBy === userId;
  const [media, setMedia] = useState<ChatMessage[] | null>(null);
  const [mediaError, setMediaError] = useState("");
  const [title, setTitle] = useState(thread.title);
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState("");

  const fileCount = thread.messages.filter((m) => m.attachment && !m.removed).length;
  useEffect(() => {
    const c = new AbortController();
    setMedia(null);
    chatApi
      .media(thread.id, c.signal)
      .then((d) => !c.signal.aborted && setMedia((d?.messages ?? []).map(normalizeMessage)))
      .catch((e) => !c.signal.aborted && setMediaError(e instanceof Error ? e.message : "Media couldn't be loaded."));
    return () => c.abort();
  }, [chatApi, thread.id, fileCount]);
  useEffect(() => setTitle(thread.title), [thread.title]);

  async function rename(e: FormEvent) {
    e.preventDefault();
    if (renaming || !title.trim() || title.trim() === thread.title) return;
    setRenaming(true);
    setRenameError("");
    try {
      await chatApi.rename(thread.id, title.trim());
      onRenamed(title.trim());
    } catch (reason) {
      setRenameError(reason instanceof Error ? reason.message : "The name wasn't saved.");
    } finally {
      setRenaming(false);
    }
  }

  const photos = (media ?? []).filter((m) => m.attachment && isImage(m.attachment.type));
  const files = (media ?? []).filter((m) => m.attachment && !isImage(m.attachment.type));
  const status = direct ? (thread.waiting ? "Hasn't accepted yet" : activeLabel(other?.active, other?.seenAt)) : `${thread.members.length} people`;

  return (
    <aside className="mx-info" aria-label="Chat info">
      <div className="mx-info-head">
        <button type="button" className="mx-icon-btn" aria-label="Close chat info" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="mx-info-hero">
        <Avatar name={thread.title} group={!direct} size="lg" active={direct && !!other?.active} />
        <h2>{thread.title}</h2>
        {status && <p>{status}</p>}
        <div className="mx-info-quick">
          <button type="button" onClick={() => onSetting({ muted: !thread.muted })} aria-pressed={!!thread.muted}>
            {thread.muted ? <BellIcon size={18} /> : <MuteIcon size={18} />}
            <span>{thread.muted ? "Unmute" : "Mute"}</span>
          </button>
          <button type="button" onClick={() => onSetting({ pinned: !thread.pinned })} aria-pressed={!!thread.pinned}>
            <PinIcon size={18} />
            <span>{thread.pinned ? "Unpin" : "Pin chat"}</span>
          </button>
          {!direct && (
            <button type="button" onClick={onAddPeople} disabled={thread.request}>
              <UserPlusIcon size={18} />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      <Section title={`Pinned messages${thread.pinnedMessages.length ? ` (${thread.pinnedMessages.length})` : ""}`} open={focus === "pinned"}>
        {!thread.pinnedMessages.length && <p className="mx-hint">Nothing pinned. Use a message's ⋯ menu → Pin to keep it handy here.</p>}
        <ul className="mx-pins">
          {thread.pinnedMessages.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onJump(p.id)}>
                <strong>{p.from}</strong>
                <span>{p.body || (p.attachment ? `📎 ${p.attachment}` : "")}</span>
                <small>{dayLabel(p.pinnedAt)}</small>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {!direct && (
        <Section title={`Members (${thread.members.length})`} open={!focus}>
          <ul className="mx-rows">
            {thread.members.map((m) => (
              <li key={m.id}>
                <Avatar name={m.name} size="xs" active={!!m.active} />
                <span>
                  {m.me ? `${m.name} (you)` : m.name}
                  {m.admin && <small className="mx-tag">Created the group</small>}
                  {m.pending && <small className="mx-tag">Hasn't accepted</small>}
                </span>
                {admin && !m.me && (
                  <button type="button" className="mx-pill" onClick={() => onRemoveMember(m.id, m.name)}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-quiet mx-inline-btn" onClick={onAddPeople} disabled={thread.request}>
            <PlusIcon /> Add people
          </button>
          {mode === "personal" && thread.canInvite && (
            <div className="mx-info-invite">
              <p className="mx-hint">Someone not findable by name? Send them a private invite link.</p>
              <ConversationInvites key={thread.id} conversationId={thread.id} initiallyOpen={inviteOpen} />
            </div>
          )}
        </Section>
      )}

      {!direct && (
        <Section title="Group name">
          <form className="mx-rename" onSubmit={rename}>
            <input aria-label="Group name" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
            <button type="submit" className="btn btn-quiet mx-inline-btn" disabled={renaming || !title.trim() || title.trim() === thread.title}>
              {renaming ? "Saving…" : "Save"}
            </button>
          </form>
          {renameError && <p className="form-error">{renameError}</p>}
          <p className="mx-hint">Everyone in the group sees the new name.</p>
        </Section>
      )}

      <Section title={`Media & files${media ? ` (${media.length})` : ""}`}>
        {mediaError && <p className="form-error">{mediaError}</p>}
        {!media && !mediaError && <p className="mx-hint" role="status">Loading…</p>}
        {media && !media.length && <p className="mx-hint">No photos or files yet.</p>}
        {photos.length > 0 && (
          <div className="mx-media-grid">
            {photos.map((m) => (
              <AttachmentView
                key={m.id}
                a={m.attachment!}
                fileKey={m.id}
                load={fileLoader(m)}
                onOpenImage={(url) => onOpenImage(m, url)}
                onError={setMediaError}
              />
            ))}
          </div>
        )}
        {files.map((m) => (
          <AttachmentView key={m.id} a={m.attachment!} fileKey={m.id} load={fileLoader(m)} onOpenImage={() => undefined} onError={setMediaError} />
        ))}
      </Section>

      <Section title="Privacy & support">
        <div className="mx-info-actions">
          <label className="mx-field">
            <span className="ld-label">
              <span>
                <FolderIcon /> Folder
              </span>
            </span>
            <select
              value={thread.folderId ?? ""}
              onChange={(e) => (e.target.value === "__new" ? onNewFolder() : onSetting({ folder: e.target.value || null }))}
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
              <option value="__new">New folder…</option>
            </select>
          </label>
          <button type="button" className="mx-action-row" onClick={() => onSetting({ unread: true })}>
            <UnreadIcon /> Mark as unread
          </button>
          <button type="button" className="mx-action-row" onClick={() => onSetting({ archived: !thread.archived })}>
            <ArchiveIcon /> {thread.archived ? "Unarchive chat" : "Archive chat"}
          </button>
          {direct && mode === "personal" && other && (
            <button type="button" className="mx-action-row is-danger" onClick={() => onBlock(!thread.direct?.blockedByMe)}>
              <BlockIcon /> {thread.direct?.blockedByMe ? `Unblock ${other.name}` : `Block ${other.name}`}
            </button>
          )}
          <button type="button" className="mx-action-row is-danger" onClick={onLeave}>
            <LeaveIcon /> {thread.request ? "Delete request" : direct ? "Delete chat" : "Leave group"}
          </button>
          <button type="button" className="mx-action-row" onClick={onAbout}>
            <DatabaseIcon /> How chat works on our free plan
          </button>
        </div>
      </Section>
    </aside>
  );
}
