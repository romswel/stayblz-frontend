import { useEffect, useMemo, useState, type ReactNode } from "react";
import BackButton from "../ui/BackButton";
import ChatListItem from "./ChatListItem";
import {
  ArchiveIcon,
  BellIcon,
  ChatsIcon,
  ComposeIcon,
  FolderIcon,
  GearIcon,
  LeaveIcon,
  MuteIcon,
  PeopleIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  UnreadIcon,
} from "./icons";
import type { MenuEntry } from "./Menu";
import type { ChatFolder, ChatMode, ChatPreview } from "./types";

export type ChatAction =
  | "pin" | "unpin" | "read" | "unread" | "mute" | "unmute" | "archive" | "unarchive" | "delete" | `folder:${string}`;

type Filter = "all" | "unread" | "groups" | "requests" | "archived" | `folder:${string}`;

/**
 * Left column: title + actions, Chats | People switch, search, filter tabs (All, Unread, Groups,
 * your folders, Requests, Archived), pinned chats first, and a ⋯ menu on every chat.
 */
export default function ChatSidebar({
  mode,
  title,
  basePath,
  items,
  status,
  error,
  stale,
  activeId,
  folders,
  people,
  notice,
  onRetry,
  onNewChat,
  onSettings,
  onNewFolder,
  onAction,
}: {
  mode: ChatMode;
  title: string;
  basePath: string;
  items: ChatPreview[];
  status: "loading" | "ready" | "error";
  error: string;
  stale: boolean;
  activeId?: string;
  folders: ChatFolder[];
  /** The People tab (personal chat only). */
  people?: ReactNode;
  notice?: ReactNode;
  onRetry: () => void;
  onNewChat: () => void;
  onSettings: () => void;
  /** Pass a chat id to put that chat in the new folder. */
  onNewFolder: (assignTo?: string) => void;
  onAction: (c: ChatPreview, action: ChatAction) => void;
}) {
  const [tab, setTab] = useState<"chats" | "people">("chats");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => {
    if (filter.startsWith("folder:") && !folders.some((f) => `folder:${f.id}` === filter)) setFilter("all");
  }, [filter, folders]);
  const requests = items.filter((c) => c.request).length;
  const unread = items.filter((c) => c.unread && !c.request && !c.archived).length;
  const archived = items.filter((c) => c.archived && !c.request).length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (filter === "requests") {
        if (!c.request) return false;
      } else if (filter === "archived") {
        if (!c.archived || c.request) return false;
      } else {
        if (c.request || (c.archived && !q)) return false;
        if (filter === "unread" && !c.unread) return false;
        if (filter === "groups" && c.kind !== "group") return false;
        if (filter.startsWith("folder:") && c.folderId !== filter.slice(7)) return false;
      }
      if (!q) return true;
      return [c.title, c.lastMessage, ...c.participants].some((s) => s.toLowerCase().includes(q));
    });
  }, [items, query, filter]);
  const pinned = filter === "all" && !query ? shown.filter((c) => c.pinned) : [];
  const rest = pinned.length ? shown.filter((c) => !c.pinned) : shown;
  const now = Date.now();

  const menu = (c: ChatPreview): MenuEntry[] => [
    c.pinned
      ? { label: "Unpin chat", icon: <PinIcon />, onSelect: () => onAction(c, "unpin") }
      : { label: "Pin chat", icon: <PinIcon />, onSelect: () => onAction(c, "pin") },
    c.unread
      ? { label: "Mark as read", icon: <ChatsIcon size={16} />, onSelect: () => onAction(c, "read") }
      : { label: "Mark as unread", icon: <UnreadIcon />, onSelect: () => onAction(c, "unread") },
    c.muted
      ? { label: "Unmute", icon: <BellIcon />, onSelect: () => onAction(c, "unmute") }
      : { label: "Mute", icon: <MuteIcon />, onSelect: () => onAction(c, "mute") },
    c.archived
      ? { label: "Unarchive", icon: <ArchiveIcon />, onSelect: () => onAction(c, "unarchive") }
      : { label: "Archive", icon: <ArchiveIcon />, onSelect: () => onAction(c, "archive") },
    { section: "Move to folder" },
    ...folders.map<MenuEntry>((f) => ({
      label: f.name,
      icon: <FolderIcon />,
      checked: c.folderId === f.id,
      onSelect: () => onAction(c, `folder:${c.folderId === f.id ? "none" : f.id}`),
    })),
    { label: folders.length ? "New folder…" : "Create a folder…", icon: <PlusIcon />, onSelect: () => onNewFolder(c.id) },
    { section: " " },
    {
      label: c.request ? "Delete request" : c.kind === "direct" ? "Delete chat" : "Leave group",
      icon: <LeaveIcon />,
      danger: true,
      onSelect: () => onAction(c, "delete"),
    },
  ];

  const tabs: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread", count: unread },
    { key: "groups", label: "Groups" },
    ...folders.map((f) => ({ key: `folder:${f.id}` as Filter, label: f.name })),
    ...(mode === "personal" ? [{ key: "requests" as Filter, label: "Requests", count: requests }] : []),
    ...(archived || filter === "archived" ? [{ key: "archived" as Filter, label: "Archived" }] : []),
  ];

  return (
    <aside className="mx-side" aria-label={`${title} chats`}>
      <div className="mx-side-head">
        <BackButton iconOnly className="mx-side-back" />
        <h1>{title}</h1>
        <div className="mx-side-actions">
          <button type="button" className="mx-round" aria-label="Chat settings" title="Chat settings" onClick={onSettings}>
            <GearIcon />
          </button>
          <button type="button" className="mx-round" aria-label="New chat" title="New chat" onClick={onNewChat}>
            <ComposeIcon />
          </button>
        </div>
      </div>

      {people && (
        <div className="mx-switch" role="tablist" aria-label="Show">
          <button type="button" role="tab" aria-selected={tab === "chats"} onClick={() => setTab("chats")}>
            <ChatsIcon size={16} /> Chats
            {unread + requests > 0 && <span className="mx-chip-count">{unread + requests}</span>}
          </button>
          <button type="button" role="tab" aria-selected={tab === "people"} onClick={() => setTab("people")}>
            <PeopleIcon size={16} /> People
          </button>
        </div>
      )}

      {tab === "people" && people ? (
        <div className="mx-side-body">{people}</div>
      ) : (
        <>
          <div className="mx-list-tools">
            <label className="mx-search">
              <SearchIcon />
              <input type="search" placeholder="Search chats" aria-label="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <div className="mx-filters" role="group" aria-label="Filter chats">
              {tabs.map((t) => (
                <button key={t.key} type="button" aria-pressed={filter === t.key} onClick={() => setFilter(t.key)}>
                  {t.label}
                  {!!t.count && <span className="mx-chip-count">{t.count}</span>}
                </button>
              ))}
              <button type="button" className="mx-filter-add" aria-label="New folder" title="New folder" onClick={() => onNewFolder()}>
                <PlusIcon size={14} />
              </button>
            </div>
          </div>
          {notice}
          {stale && (
            <p className="mx-list-note" role="status">
              Couldn't refresh. Showing what was loaded.
            </p>
          )}
          <div className="mx-side-body">
            {status === "loading" && (
              <div className="mx-skeletons" aria-label="Loading chats" role="status">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="mx-skeleton">
                    <span />
                    <div>
                      <i />
                      <i />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {status === "error" && (
              <div className="mx-empty" role="alert">
                <p>{error || "Chats could not be loaded."}</p>
                <button type="button" className="btn btn-quiet" onClick={onRetry}>
                  Try again
                </button>
              </div>
            )}
            {status === "ready" && !items.length && (
              <div className="mx-empty">
                <p className="mx-empty-title">No chats yet</p>
                <p>
                  {mode === "team"
                    ? "Message a teammate or start a group for your stable."
                    : "Find people by name in People, or start a chat with someone's account email."}
                </p>
                <button type="button" className="btn btn-primary mx-inline-btn" onClick={onNewChat}>
                  <ComposeIcon /> New chat
                </button>
              </div>
            )}
            {status === "ready" && items.length > 0 && !shown.length && (
              <div className="mx-empty">
                <p>
                  {query
                    ? "No chats match your search."
                    : filter === "requests"
                      ? "No message requests."
                      : filter === "unread"
                        ? "You're all caught up."
                        : filter === "archived"
                          ? "No archived chats."
                          : filter.startsWith("folder:")
                            ? "This folder is empty. Use a chat's ⋯ menu to move it here."
                            : "No chats here."}
                </p>
              </div>
            )}
            {pinned.length > 0 && <p className="mx-list-label">Pinned</p>}
            <ul className="mx-items">
              {pinned.map((c) => (
                <ChatListItem key={c.id} c={c} to={`${basePath}/${c.id}`} active={c.id === activeId} now={now} menu={menu} />
              ))}
            </ul>
            {pinned.length > 0 && rest.length > 0 && <p className="mx-list-label">All chats</p>}
            <ul className="mx-items">
              {rest.map((c) => (
                <ChatListItem key={c.id} c={c} to={`${basePath}/${c.id}`} active={c.id === activeId} now={now} menu={menu} />
              ))}
            </ul>
          </div>
        </>
      )}
    </aside>
  );
}
