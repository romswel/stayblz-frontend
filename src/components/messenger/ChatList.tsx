import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { previewLine, shortTime } from "./format";
import { Avatar, ComposeIcon, SearchIcon } from "./icons";
import type { ChatMode, ChatPreview } from "./types";

type Filter = "all" | "unread" | "requests";

export default function ChatList({
  mode,
  basePath,
  items,
  status,
  error,
  stale,
  activeId,
  onRetry,
  onNewChat,
}: {
  mode: ChatMode;
  basePath: string;
  items: ChatPreview[];
  status: "loading" | "ready" | "error";
  error: string;
  stale: boolean;
  activeId?: string;
  onRetry: () => void;
  onNewChat: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const requests = items.filter((c) => c.request).length;
  const unread = items.filter((c) => c.unread).length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (filter === "requests" ? !c.request : c.request) return false;
      if (filter === "unread" && !c.unread) return false;
      if (!q) return true;
      return [c.title, c.lastMessage, ...c.participants].some((s) => s.toLowerCase().includes(q));
    });
  }, [items, query, filter]);
  const now = Date.now();

  return (
    <aside className="mx-list" aria-label="Chats">
      <div className="mx-list-tools">
        <label className="mx-search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search chats"
            aria-label="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="mx-filters" role="group" aria-label="Show">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All
          </button>
          <button type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>
            Unread{unread > 0 && <span className="mx-chip-count">{unread}</span>}
          </button>
          {mode === "personal" && (
            <button type="button" aria-pressed={filter === "requests"} onClick={() => setFilter("requests")}>
              Requests{requests > 0 && <span className="mx-chip-count">{requests}</span>}
            </button>
          )}
        </div>
      </div>
      {stale && (
        <p className="mx-list-note" role="status">
          Couldn't refresh. Showing what was loaded.
        </p>
      )}
      <div className="mx-list-body">
        {status === "loading" && (
          <div className="mx-skeletons" aria-label="Loading chats" role="status">
            {[0, 1, 2, 3].map((i) => (
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
                : "Message someone by their account email, or start a group and invite people."}
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
                    : "No chats here."}
            </p>
          </div>
        )}
        <ul className="mx-items">
          {shown.map((c) => (
            <li key={c.id}>
              <Link
                to={`${basePath}/${c.id}`}
                state={{ fromList: true }}
                className={`mx-item${c.id === activeId ? " is-active" : ""}${c.unread ? " is-unread" : ""}`}
                aria-current={c.id === activeId ? "page" : undefined}
                aria-label={`${c.title}${c.unread ? ", unread" : ""}${c.request ? ", message request" : ""}`}
              >
                <Avatar name={c.title} group={c.kind === "group"} />
                <span className="mx-item-text">
                  <span className="mx-item-top">
                    <span className="mx-item-name">{c.title}</span>
                    <span className="mx-item-time">{shortTime(c.lastMessageAt, now)}</span>
                  </span>
                  <span className="mx-item-line">
                    <span className="mx-item-preview">
                      {c.request ? "Wants to message you" : c.waiting && !c.lastMessage ? "Say hello" : previewLine(c)}
                    </span>
                    {c.unread && <span className="mx-dot" aria-hidden="true" />}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
