import type { ReactNode } from "react";
import { initials, tone } from "./format";
import type { DeliveryStatus } from "./types";

const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
export const ComposeIcon = () => <Svg><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>;
export const SendIcon = () => <Svg><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></Svg>;
export const ReplyIcon = () => <Svg size={16}><path d="m9 14-5-5 5-5" /><path d="M4 9h10a6 6 0 0 1 6 6v5" /></Svg>;
export const SmileIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></Svg>;
export const CopyIcon = () => <Svg size={16}><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>;
export const UndoIcon = () => <Svg size={16}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></Svg>;
export const InfoIcon = () => <Svg><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></Svg>;
export const ArrowLeftIcon = () => <Svg><path d="M19 12H5M12 19l-7-7 7-7" /></Svg>;
export const SearchIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const DownIcon = () => <Svg size={16}><path d="M12 5v14M19 12l-7 7-7-7" /></Svg>;
export const DatabaseIcon = () => <Svg size={16}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></Svg>;
export const MoreIcon = () => <Svg size={18}><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></Svg>;
export const PinIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M12 17v5" /><path d="M9 3h6l-1 6 4 3v2H6v-2l4-3Z" /></Svg>;
export const MuteIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M13.7 21a2 2 0 0 1-3.4 0" /><path d="M18.6 13A17 17 0 0 1 18 8M6.3 6.3A5.9 5.9 0 0 0 6 8c0 7-3 9-3 9h14" /><path d="M18 8a6 6 0 0 0-9.3-5" /><path d="m2 2 20 20" /></Svg>;
export const BellIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></Svg>;
export const ArchiveIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4" /></Svg>;
export const FolderIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></Svg>;
export const EditIcon = () => <Svg size={16}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>;
export const ForwardIcon = () => <Svg size={16}><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0-6 6v5" /></Svg>;
export const PaperclipIcon = () => <Svg size={20}><path d="m21.4 11-8.5 8.5a6 6 0 0 1-8.5-8.5l8.5-8.5a4 4 0 0 1 5.7 5.7l-8.5 8.5a2 2 0 0 1-2.8-2.8l7.8-7.8" /></Svg>;
export const GearIcon = () => <Svg><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>;
export const PeopleIcon = ({ size = 18 }: { size?: number }) => <Svg size={size}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></Svg>;
export const ChatsIcon = ({ size = 18 }: { size?: number }) => <Svg size={size}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></Svg>;
export const DownloadIcon = () => <Svg size={16}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></Svg>;
export const BlockIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><circle cx="12" cy="12" r="9" /><path d="m5.7 5.7 12.6 12.6" /></Svg>;
export const LeaveIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Svg>;
export const PlusIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M12 5v14M5 12h14" /></Svg>;
export const CloseIcon = ({ size = 18 }: { size?: number }) => <Svg size={size}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const FileIcon = () => <Svg size={22}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></Svg>;
export const UnreadIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h9" /><circle cx="19" cy="5" r="3" fill="currentColor" /></Svg>;
export const UserMinusIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11h-6" /></Svg>;
export const UserPlusIcon = ({ size = 16 }: { size?: number }) => <Svg size={size}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></Svg>;

/** Initials in a coloured circle, with an optional green "active now" dot. Groups get rounded squares. */
export function Avatar({ name, group = false, size = "md", active = false }: { name: string; group?: boolean; size?: "xs" | "sm" | "md" | "lg"; active?: boolean }) {
  return (
    <span className={`mx-av mx-av-${size} mx-tone-${tone(name)}${group ? " is-group" : ""}`} aria-hidden="true">
      {initials(name)}
      {active && <i className="mx-av-dot" />}
    </span>
  );
}

/** Messenger-style marks for your own messages: ○ sending, ✓ sent, ● delivered, (avatar) seen. */
export function StatusMark({ status, seenBy }: { status: "sending" | "failed" | DeliveryStatus; seenBy?: string }) {
  const label =
    status === "sending" ? "Sending" : status === "failed" ? "Not sent" : status === "sent" ? "Sent" : status === "delivered" ? "Delivered" : `Seen${seenBy ? ` by ${seenBy}` : ""}`;
  if (status === "seen" && seenBy) {
    return (
      <span className="mx-mark is-seen" title={label} role="img" aria-label={label}>
        <Avatar name={seenBy} size="xs" />
      </span>
    );
  }
  return (
    <span className={`mx-mark is-${status}`} title={label} role="img" aria-label={label}>
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        {status === "failed" ? (
          <>
            <circle cx="8" cy="8" r="7" fill="currentColor" />
            <path d="M8 4.5v4.2M8 11.2h.01" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="8" cy="8" r="6.6" fill={status === "delivered" || status === "seen" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.4" />
            {status !== "sending" && (
              <path d="m5 8.2 2 2 4-4.2" fill="none" stroke={status === "delivered" || status === "seen" ? "var(--mx-pane)" : "currentColor"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </>
        )}
      </svg>
    </span>
  );
}
