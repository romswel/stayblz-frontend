import { memo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ChatAvatar from "./ChatAvatar";
import { activityAt, muteLabel, previewLine, shortTime } from "./format";
import { MoreIcon, MuteIcon, PinIcon, StatusMark } from "./icons";
import Menu, { type MenuEntry } from "./Menu";
import type { ChatPreview } from "./types";

/**
 * One chat in the list, Messenger style: face (+ green dot when active), name, "Bo: on my way · 5m",
 * and on the right a blue-green dot when unread, a crossed bell when muted, or your send status / their face
 * when they've seen it. A ⋯ button (on hover, or always on phones) opens the chat's menu.
 */
function ChatListItem({
  c,
  to,
  active,
  replace,
  linkState = { fromList: true },
  now,
  index,
  menu,
}: {
  c: ChatPreview;
  to: string;
  active: boolean;
  /** A chat is already open: switching replaces it in the history, so Back goes to the list (not through every chat). */
  replace: boolean;
  linkState?: unknown;
  now: number;
  /** Position in the list, for a quick staggered entrance on first load. */
  index: number;
  menu: (c: ChatPreview) => MenuEntry[];
}) {
  const [open, setOpen] = useState(false);
  const more = useRef<HTMLButtonElement>(null);
  const line = c.request ? "Wants to message you" : c.waiting && !c.lastMessage ? "Say hello 👋" : previewLine(c);
  const time = shortTime(activityAt(c), now);
  return (
    <li className={`mx-item-wrap${open ? " is-menu" : ""}`} style={{ animationDelay: `${Math.min(index, 12) * 18}ms` }}>
      <Link
        to={to}
        replace={replace}
        state={linkState}
        className={`mx-item${active ? " is-active" : ""}${c.unread ? " is-unread" : ""}`}
        aria-current={active ? "page" : undefined}
        aria-label={`${c.title}${c.unread ? ", unread" : ""}${c.request ? ", message request" : ""}${c.pinned ? ", pinned" : ""}${c.muted ? ", muted" : ""}`}
      >
        <ChatAvatar c={c} />
        <span className="mx-item-text">
          <span className="mx-item-top">
            <span className="mx-item-name">{c.title}</span>
            {c.pinned && (
              <span className="mx-item-flag" title="Pinned">
                <PinIcon size={12} />
              </span>
            )}
          </span>
          <span className="mx-item-line">
            <span className="mx-item-preview">{line}</span>
            {time && <span className="mx-item-time">· {time}</span>}
          </span>
        </span>
        <span className="mx-item-end">
          {c.muted && (
            <span className="mx-item-flag is-muted" title={muteLabel(c.mutedUntil)}>
              <MuteIcon size={15} />
            </span>
          )}
          {c.unread ? (
            <span className={`mx-dot${c.muted ? " is-muted" : ""}`} aria-hidden="true" />
          ) : c.lastMessageMine && c.lastStatus ? (
            <StatusMark
              status={c.lastStatus}
              seenBy={c.lastStatus === "seen" && c.kind === "direct" ? c.title : undefined}
              seenById={c.kind === "direct" ? c.otherId : undefined}
            />
          ) : null}
        </span>
      </Link>
      <button
        ref={more}
        type="button"
        className="mx-item-more"
        aria-label={`Options for ${c.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreIcon />
      </button>
      {open && <Menu anchor={more.current} items={menu(c)} onClose={() => setOpen(false)} label={`Options for ${c.title}`} />}
    </li>
  );
}
export default memo(ChatListItem);
