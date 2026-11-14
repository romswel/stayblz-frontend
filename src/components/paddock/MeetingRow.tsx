import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Menu, { type MenuEntry } from "../messenger/Menu";
import { useConfirm } from "../ui/Confirm";
import { meetingLink } from "./brand";
import { downloadIcs } from "./ics";
import { CalendarIcon, CopyIcon, LinkIcon, MoreIcon, PeopleIcon } from "./icons";
import type { Meeting } from "./paddockApi";
import { ago, dateBadge, meetingTime } from "./time";

const roleText: Record<Meeting["role"], string> = {
  host: "You're the host",
  cohost: "You're a co-host",
  invited: "You're invited",
  team: "Team meeting",
  none: "",
  guest: "",
};

export default function MeetingRow({ meeting, onEdit, onDelete, inCall }: { meeting: Meeting; onEdit: () => void; onDelete: () => Promise<void>; inCall: boolean }) {
  const confirm = useConfirm();
  const more = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const live = meeting.live.count > 0;
  const badge = meeting.scheduledFor ? dateBadge(meeting.scheduledFor) : null;
  const when = meetingTime(meeting.scheduledFor, meeting.durationMinutes, live);
  const items: MenuEntry[] = [];
  if (meeting.scheduledFor)
    items.push({
      label: "Add to calendar (.ics)",
      icon: <CalendarIcon />,
      onSelect: () => downloadIcs({ ...meeting, scheduledFor: meeting.scheduledFor! }),
    });
  if (meeting.role === "host") {
    items.push({ label: meeting.scheduledFor ? "Edit meeting" : "Schedule or edit", onSelect: onEdit });
    items.push({
      label: "Delete meeting",
      danger: true,
      onSelect: async () => {
        const sure = await confirm({
          title: `Delete “${meeting.title}”?`,
          message: live
            ? "The call ends for everyone now, and the link stops working."
            : "The link stops working and the meeting disappears from everyone's list.",
          confirmLabel: "Delete meeting",
          tone: "danger",
        });
        if (sure) await onDelete();
      },
    });
  }
  return (
    <li className={`pd-row${live ? " is-live" : ""}`}>
      <span className={`pd-date${live ? " is-live" : badge ? "" : " is-now"}`} aria-hidden="true">
        {live ? (
          <>
            <i className="pd-pulse" />
            LIVE
          </>
        ) : badge ? (
          <>
            <small>{badge.month}</small>
            {badge.day}
          </>
        ) : (
          <LinkIcon size={20} />
        )}
      </span>
      <div className="pd-row-text">
        <Link to={`/paddock/${meeting.code}`} className="pd-row-title">
          {meeting.title}
        </Link>
        <p className="pd-row-meta">
          {when || (meeting.lastJoinedAt ? `Last joined ${ago(meeting.lastJoinedAt)}` : `Created ${ago(meeting.createdAt)}`)}
          {" · "}
          {meeting.role === "host" ? "You host" : `Host: ${meeting.hostName}`}
          {meeting.stableName && <> · {meeting.stableName}</>}
        </p>
        <p className="pd-row-tags">
          {roleText[meeting.role] && <span className="pd-tag">{roleText[meeting.role]}</span>}
          {live && (
            <span className="pd-tag is-live">
              <PeopleIcon size={13} /> {meeting.live.count} in the call
              {meeting.live.names?.length ? `: ${meeting.live.names.slice(0, 3).join(", ")}${meeting.live.count > 3 ? "…" : ""}` : ""}
            </span>
          )}
          {inCall && <span className="pd-tag is-gold">You're in this call</span>}
        </p>
      </div>
      <div className="pd-row-actions">
        <Link className={`btn ${live || inCall ? "btn-primary" : "btn-quiet"} pd-row-join`} to={`/paddock/${meeting.code}`}>
          {inCall ? "Return" : "Join"}
        </Link>
        <button
          type="button"
          className="pd-icon-btn"
          aria-label={copied ? "Link copied" : `Copy link for ${meeting.title}`}
          title={copied ? "Copied" : "Copy link"}
          onClick={() =>
            void navigator.clipboard?.writeText(meetingLink(meeting.code)).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            })
          }
        >
          <CopyIcon />
        </button>
        {items.length > 0 && (
          <button ref={more} type="button" className="pd-icon-btn" aria-label={`More for ${meeting.title}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <MoreIcon size={18} />
          </button>
        )}
      </div>
      {menu && <Menu anchor={more.current} label={`More for ${meeting.title}`} items={items} onClose={() => setMenu(false)} />}
    </li>
  );
}
