import { memo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { previewLine, shortTime } from "./format";
import { Avatar, MoreIcon, MuteIcon, PinIcon, StatusMark } from "./icons";
import Menu, { type MenuEntry } from "./Menu";
import type { ChatPreview } from "./types";

/** One chat in the list: avatar (+ active dot), name, last message, time, your send status, and a ⋯ menu. */
function ChatListItem({
  c,
  to,
  active,
  now,
  menu,
}: {
  c: ChatPreview;
  to: string;
  active: boolean;
  now: number;
  menu: (c: ChatPreview) => MenuEntry[];
}) {
  const [open, setOpen] = useState(false);
  const more = useRef<HTMLButtonElement>(null);
  const line = c.request ? "Wants to message you" : c.waiting && !c.lastMessage ? "Say hello" : previewLine(c);
  return (
    <li className={`mx-item-wrap${open ? " is-menu" : ""}`}>
      <Link
        to={to}
        state={{ fromList: true }}
        className={`mx-item${active ? " is-active" : ""}${c.unread ? " is-unread" : ""}`}
        aria-current={active ? "page" : undefined}
        aria-label={`${c.title}${c.unread ? ", unread" : ""}${c.request ? ", message request" : ""}${c.pinned ? ", pinned" : ""}${c.muted ? ", muted" : ""}`}
      >
        <Avatar name={c.title} group={c.kind === "group"} active={!!c.active} />
        <span className="mx-item-text">
          <span className="mx-item-top">
            <span className="mx-item-name">{c.title}</span>
            {c.pinned && (
              <span className="mx-item-flag" title="Pinned">
                <PinIcon size={13} />
              </span>
            )}
            {c.muted && (
              <span className="mx-item-flag" title="Muted">
                <MuteIcon size={13} />
              </span>
            )}
          </span>
          <span className="mx-item-line">
            <span className="mx-item-preview">{line}</span>
            <span className="mx-item-time">· {shortTime(c.lastMessageAt, now)}</span>
          </span>
        </span>
        <span className="mx-item-end">
          {c.unread ? (
            <span className={`mx-dot${c.muted ? " is-muted" : ""}`} aria-hidden="true" />
          ) : c.lastMessageMine && c.lastStatus ? (
            <StatusMark status={c.lastStatus} seenBy={c.lastStatus === "seen" && c.kind === "direct" ? c.title : undefined} />
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
