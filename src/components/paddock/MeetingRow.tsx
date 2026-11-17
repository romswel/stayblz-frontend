import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Menu, { type MenuEntry } from "../messenger/Menu";
import { useConfirm } from "../ui/Confirm";
import { meetingLink } from "./brand";
import { downloadIcs } from "./ics";
import { CalendarIcon, CopyIcon, LinkIcon, MoreIcon, PeopleIcon } from "./icons";
import type { Meeting } from "./paddockApi";
import { ago, dateBadge, meetingTime, timeRange } from "./time";

const roleText: Record<Meeting["role"], string> = {
  host: "You're the host",
  cohost: "Co-host",
  invited: "Invited",
  team: "Team meeting",
  none: "",
  guest: "",
};

/** One meeting on the Paddock home: a card (agenda, live) or a compact row (recent, coming up). */
export default function MeetingRow({
  meeting,
  onEdit,
  onDelete,
  inCall,
  compact = false,
  past = false,
}: {
  meeting: Meeting;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  inCall: boolean;
  compact?: boolean;
  past?: boolean;
}) {
  const confirm = useConfirm();
  const more = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const live = meeting.live.count > 0;
  const badge = meeting.scheduledFor ? dateBadge(meeting.scheduledFor) : null;
  const when = meeting.scheduledFor
    ? compact
      ? meetingTime(meeting.scheduledFor, meeting.durationMinutes, live)
      : timeRange(meeting.scheduledFor, meeting.durationMinutes)
    : live
      ? "Happening now"
      : meeting.lastJoinedAt
        ? `Last joined ${ago(meeting.lastJoinedAt)}`
        : `Created ${ago(meeting.createdAt)}`;
  const items: MenuEntry[] = [
    {
      label: copied ? "Link copied" : "Copy meeting link",
      icon: <CopyIcon />,
      onSelect: () => void copy(),
    },
  ];
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
  async function copy() {
    try {
      await navigator.clipboard?.writeText(meetingLink(meeting.code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* The link is still in the menu and the meeting page. */
    }
  }
  const names = meeting.live.names ?? [];
  return (
    <li className={`pd-meeting${live ? " is-live" : ""}${compact ? " is-compact" : ""}${past ? " is-past" : ""}`}>
      {compact && (
        <span className={`pd-date${live ? " is-live" : badge ? "" : " is-link"}`} aria-hidden="true">
          {live ? (
            <i className="pd-pulse" />
          ) : badge ? (
            <>
              <small>{badge.month}</small>
              {badge.day}
            </>
          ) : (
            <LinkIcon size={18} />
          )}
        </span>
      )}
      <div className="pd-meeting-text">
        <span className="pd-meeting-when">
          {live && !compact && <i className="pd-pulse" aria-hidden="true" />}
          {when}
        </span>
        <Link to={`/paddock/${meeting.code}`} className="pd-meeting-title">
          {meeting.title}
        </Link>
        <span className="pd-meeting-meta">
          {meeting.role === "host" ? "You host" : `Host: ${meeting.hostName}`}
          {meeting.stableName && <> · {meeting.stableName}</>}
          {roleText[meeting.role] && meeting.role !== "host" && <span className="pd-tag">{roleText[meeting.role]}</span>}
          {live && (
            <span className="pd-tag is-live">
              <PeopleIcon size={13} /> {meeting.live.count} in the call
              {!compact && names.length ? `: ${names.slice(0, 3).join(", ")}${meeting.live.count > 3 ? "…" : ""}` : ""}
            </span>
          )}
          {inCall && <span className="pd-tag is-accent">You're in this call</span>}
        </span>
      </div>
      <div className="pd-meeting-actions">
        <Link className={`pd-btn ${live || inCall ? "is-primary" : "is-quiet"} is-small pd-row-join`} to={`/paddock/${meeting.code}`}>
          {inCall ? "Return" : "Join"}
        </Link>
        <button
          ref={more}
          type="button"
          className="pd-icon-btn"
          aria-label={`More for ${meeting.title}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          <MoreIcon size={18} />
        </button>
      </div>
      {menu && <Menu anchor={more.current} label={`More for ${meeting.title}`} items={items} onClose={() => setMenu(false)} />}
    </li>
  );
}
