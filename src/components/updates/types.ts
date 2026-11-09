// Stayblz Updates: release notes, announcements, news, maintenance and events.
// Posts come from the API (`/api/updates`); admins write them at /admin/updates.

export type UpdateKind = "update" | "announcement" | "news" | "maintenance" | "event";
export type UpdateTag = "new" | "improved" | "fixed" | "security" | "notice";

export interface UpdatePost {
  id: string;
  slug: string;
  kind: UpdateKind;
  title: string;
  summary: string;
  items: { tag: UpdateTag; text: string }[];
  version: string;
  audience: "public" | "members";
  pinned: boolean;
  popup: boolean;
  status: "draft" | "published" | "archived";
  publishedAt: string | null;
  authorLabel: string;
  updatedAt: string;
  createdAt?: string;
  readMinutes: number;
  hasBody: boolean;
  body?: string;
}

export interface UpdateFeed {
  updates: UpdatePost[];
  pinned: UpdatePost[];
  hasMore: boolean;
  signedIn?: boolean;
}

export const kindLabels: Record<UpdateKind, string> = {
  update: "Update",
  announcement: "Announcement",
  news: "News",
  maintenance: "Maintenance",
  event: "Event",
};
/** Filter chips, in the order shown. */
export const kindFilters: { kind: UpdateKind | ""; label: string }[] = [
  { kind: "", label: "All" },
  { kind: "update", label: "Updates" },
  { kind: "announcement", label: "Announcements" },
  { kind: "news", label: "News" },
  { kind: "maintenance", label: "Maintenance" },
  { kind: "event", label: "Events" },
];
export const tagLabels: Record<UpdateTag, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  security: "Security",
  notice: "Notice",
};
export const tagOrder: UpdateTag[] = ["new", "improved", "fixed", "security", "notice"];

export const formatDate = (iso: string | null, withTime = false) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
        ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
      })
    : "Not published";

/** "2 days ago" style label for recent posts; the full date otherwise. */
export function relativeDate(iso: string | null, now = Date.now()) {
  if (!iso) return "Draft";
  const days = Math.floor((now - Date.parse(iso)) / 864e5);
  if (days < 0) return formatDate(iso);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}
