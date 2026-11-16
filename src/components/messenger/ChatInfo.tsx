import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { prepareAvatar } from "../account/avatars";
import ConversationInvites from "../my-racing/ConversationInvites";
import ChatAvatar from "./ChatAvatar";
import type { ChatApi } from "./chatApi";
import { activeLabel, muteLabel } from "./format";
import {
  ArchiveIcon,
  Avatar,
  BellIcon,
  BlockIcon,
  ChevronIcon,
  ChevronRightIcon,
  CloseIcon,
  DatabaseIcon,
  EditIcon,
  FileIcon,
  FolderIcon,
  ImageIcon,
  LeaveIcon,
  LinkIcon,
  MicIcon,
  MoreIcon,
  MuteIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UnreadIcon,
  UserIcon,
  UserPlusIcon,
} from "./icons";
import InfoMedia, { type MediaTab } from "./InfoMedia";
import Menu from "./Menu";
import type { ChatFolder, ChatMessage, ChatMode, ChatSettings, ChatThread } from "./types";

/** A Messenger-style collapsible section; opens and closes with a short height animation. */
function Section({ title, open: initial = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initial);
  return (
    <section className={`mx-info-sec${open ? " is-open" : ""}`}>
      <button type="button" className="mx-info-sec-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <ChevronIcon />
      </button>
      {/* Closed sections are out of the tab order (inert) while their height animates to zero. */}
      <div className="mx-info-sec-body" {...(open ? {} : { inert: "" })}>
        <div className="mx-info-body">{children}</div>
      </div>
    </section>
  );
}

/**
 * Chat info (right-hand panel), Messenger style: face, name, status, quick buttons (Profile, Mute, Search), then
 * Chat info · Customize chat · Chat members · Media, files and links · Privacy & support.
 */
export default function ChatInfo({
  mode,
  thread,
  chatApi,
  folders,
  userId,
  inviteOpen,
  onClose,
  onSetting,
  onMute,
  onLeave,
  onBlock,
  onAddPeople,
  onRemoveMember,
  onMessageMember,
  onRename,
  onPhotoChanged,
  onSearch,
  onPinned,
  onJump,
  onOpenImage,
  onAbout,
  onNewFolder,
  onError,
  fileLoader,
}: {
  mode: ChatMode;
  thread: ChatThread;
  chatApi: ChatApi;
  folders: ChatFolder[];
  userId: string;
  inviteOpen: boolean;
  onClose: () => void;
  onSetting: (changes: ChatSettings) => void;
  onMute: () => void;
  onLeave: () => void;
  onBlock: (block: boolean) => void;
  onAddPeople: () => void;
  onRemoveMember: (id: string, name: string) => void;
  onMessageMember: (id: string) => void;
  onRename: () => void;
  onPhotoChanged: (photo: string | null) => void;
  onSearch: () => void;
  onPinned: () => void;
  onJump: (id: string) => void;
  onOpenImage: (m: ChatMessage, url: string) => void;
  onAbout: () => void;
  onNewFolder: () => void;
  onError: (text: string) => void;
  fileLoader: (m: ChatMessage) => (() => Promise<Blob>) | null;
}) {
  const navigate = useNavigate();
  const direct = thread.kind === "direct";
  const other = thread.members.find((m) => !m.me);
  const admin = thread.createdBy === userId;
  const [sub, setSub] = useState<MediaTab | null>(null);
  const [memberMenu, setMemberMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileCount = thread.messages.filter((m) => m.attachment && !m.removed).length;
  const status = direct ? (thread.waiting ? "Hasn't accepted yet" : activeLabel(other?.active, other?.seenAt)) : `${thread.members.length} members`;

  async function changePhoto(file: File | undefined) {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    try {
      const blob = await prepareAvatar(file);
      const { photo } = await chatApi.setPhoto(thread.id, blob);
      onPhotoChanged(photo);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "The photo wasn't saved.");
    } finally {
      setPhotoBusy(false);
    }
  }
  async function removePhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    try {
      await chatApi.removePhoto(thread.id);
      onPhotoChanged(null);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "The photo wasn't removed.");
    } finally {
      setPhotoBusy(false);
    }
  }

  if (sub)
    return (
      <aside className="mx-info mx-card" aria-label="Chat info">
        <InfoMedia
          chatId={thread.id}
          chatApi={chatApi}
          tab={sub}
          onTab={setSub}
          onBack={() => setSub(null)}
          onJump={onJump}
          onOpenImage={onOpenImage}
          fileLoader={fileLoader}
          refreshKey={fileCount}
        />
      </aside>
    );

  const picked = memberMenu ? thread.members.find((m) => m.id === memberMenu.id) : undefined;
  return (
    <aside className="mx-info mx-card" aria-label="Chat info">
      <div className="mx-info-head">
        <button type="button" className="mx-icon-btn" aria-label="Close chat info" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      <div className="mx-info-hero">
        <ChatAvatar c={thread} size="xl" active={direct && !!other?.active} />
        <h2>{thread.title}</h2>
        {status && <p>{status}</p>}
        {thread.muted && <p className="mx-info-muted">{muteLabel(thread.mutedUntil)}</p>}
        <div className="mx-info-quick">
          {direct && mode === "personal" && other && (
            <Link to={`/community/people/${other.id}`} className="mx-quick">
              <span>
                <UserIcon />
              </span>
              Profile
            </Link>
          )}
          <button type="button" className="mx-quick" onClick={() => (thread.muted ? onSetting({ muted: false }) : onMute())} aria-pressed={!!thread.muted}>
            <span>{thread.muted ? <BellIcon size={18} /> : <MuteIcon size={18} />}</span>
            {thread.muted ? "Unmute" : "Mute"}
          </button>
          <button type="button" className="mx-quick" onClick={onSearch}>
            <span>
              <SearchIcon size={18} />
            </span>
            Search
          </button>
        </div>
      </div>

      <Section title="Chat info">
        <button type="button" className="mx-action-row" onClick={onPinned}>
          <PinIcon size={18} /> View pinned messages
          {thread.pinnedMessages.length > 0 && <span className="mx-row-count">{thread.pinnedMessages.length}</span>}
        </button>
        <button type="button" className="mx-action-row" onClick={() => onSetting({ pinned: !thread.pinned })}>
          <PinIcon size={18} /> {thread.pinned ? "Unpin this chat from the top" : "Pin this chat to the top"}
        </button>
      </Section>

      {!direct && (
        <Section title="Customize chat">
          <button type="button" className="mx-action-row" onClick={onRename} disabled={thread.request}>
            <EditIcon size={18} /> Change chat name
          </button>
          <button type="button" className="mx-action-row" onClick={() => photoInput.current?.click()} disabled={thread.request || photoBusy}>
            <ImageIcon size={18} /> {photoBusy ? "Saving photo…" : thread.photo ? "Change photo" : "Add a group photo"}
          </button>
          {thread.photo && (
            <button type="button" className="mx-action-row" onClick={() => void removePhoto()} disabled={photoBusy}>
              <TrashIcon size={18} /> Remove photo
            </button>
          )}
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            aria-hidden="true"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void changePhoto(file);
            }}
          />
        </Section>
      )}

      {!direct && (
        <Section title={`Chat members (${thread.members.length})`} open>
          <ul className="mx-rows mx-members">
            {thread.members.map((m) => (
              <li key={m.id}>
                <Avatar name={m.name} id={m.id} size="sm" active={!!m.active} />
                <span>
                  {m.me ? `${m.name} (you)` : m.name}
                  <small>{m.admin ? "Created the group" : m.pending ? "Hasn't accepted" : m.active ? "Active now" : "Member"}</small>
                </span>
                {!m.me && (
                  <button
                    type="button"
                    className="mx-icon-btn"
                    aria-label={`Options for ${m.name}`}
                    aria-haspopup="menu"
                    onClick={(e) => setMemberMenu({ id: m.id, anchor: e.currentTarget })}
                  >
                    <MoreIcon />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="mx-action-row" onClick={onAddPeople} disabled={thread.request}>
            <UserPlusIcon size={18} /> Add people
          </button>
          {mode === "personal" && thread.canInvite && (
            <div className="mx-info-invite">
              <p className="mx-hint">Someone not findable by name? Send them a private invite link.</p>
              <ConversationInvites key={thread.id} conversationId={thread.id} initiallyOpen={inviteOpen} />
            </div>
          )}
        </Section>
      )}
      {memberMenu && picked && (
        <Menu
          anchor={memberMenu.anchor}
          label={`Options for ${picked.name}`}
          onClose={() => setMemberMenu(null)}
          items={[
            ...(mode === "personal"
              ? [
                  { label: "Message", icon: <PlusIcon />, onSelect: () => onMessageMember(picked.id) },
                  { label: "View profile", icon: <UserIcon size={16} />, onSelect: () => navigate(`/community/people/${picked.id}`) },
                ]
              : []),
            ...(admin ? [{ label: "Remove from group", icon: <LeaveIcon />, danger: true, onSelect: () => onRemoveMember(picked.id, picked.name) }] : []),
          ]}
        />
      )}

      <Section title="Media, files and links">
        <button type="button" className="mx-action-row" onClick={() => setSub("media")}>
          <ImageIcon size={18} /> Media <ChevronRightIcon />
        </button>
        <button type="button" className="mx-action-row" onClick={() => setSub("files")}>
          <FileIcon size={18} /> Files <ChevronRightIcon />
        </button>
        <button type="button" className="mx-action-row" onClick={() => setSub("voice")}>
          <MicIcon size={18} /> Voice clips <ChevronRightIcon />
        </button>
        <button type="button" className="mx-action-row" onClick={() => setSub("links")}>
          <LinkIcon size={18} /> Links <ChevronRightIcon />
        </button>
      </Section>

      <Section title="Privacy & support">
        <button type="button" className="mx-action-row" onClick={() => (thread.muted ? onSetting({ muted: false }) : onMute())}>
          {thread.muted ? <BellIcon size={18} /> : <MuteIcon size={18} />}
          <span className="mx-action-text">
            Chat notifications
            <small>{thread.muted ? muteLabel(thread.mutedUntil) : "On"}</small>
          </span>
        </button>
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
          <UnreadIcon size={18} /> Mark as unread
        </button>
        <button type="button" className="mx-action-row" onClick={() => onSetting({ archived: !thread.archived })}>
          <ArchiveIcon size={18} /> {thread.archived ? "Unarchive chat" : "Archive chat"}
        </button>
        {direct && mode === "personal" && other && (
          <button type="button" className="mx-action-row is-danger" onClick={() => onBlock(!thread.direct?.blockedByMe)}>
            <BlockIcon size={18} /> {thread.direct?.blockedByMe ? `Unblock ${other.name}` : `Block ${other.name}`}
          </button>
        )}
        <button type="button" className="mx-action-row is-danger" onClick={onLeave}>
          <LeaveIcon size={18} /> {thread.request ? "Delete request" : direct ? "Delete chat" : "Leave group"}
        </button>
        <button type="button" className="mx-action-row" onClick={onAbout}>
          <DatabaseIcon /> How chat works on our free plan
        </button>
      </Section>
    </aside>
  );
}
