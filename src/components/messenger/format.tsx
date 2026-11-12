import type { ReactNode } from "react";
import type { ChatMessage } from "./types";

/** Postgres sends microseconds; trim to milliseconds so every browser parses it. */
export function toMs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  return Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
}

const time = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Chat list: "now", "5m", "3h", "Tue", "Nov 3". */
export function shortTime(iso: string, now = Date.now()): string {
  const ms = toMs(iso);
  if (!Number.isFinite(ms)) return "";
  const minutes = Math.floor((now - ms) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  const d = new Date(ms);
  if (minutes < 7 * 24 * 60) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Day line between messages: "Today", "Yesterday", "Monday", "Tue, Nov 3", "Nov 3, 2025". */
export function dayLabel(iso: string, now = new Date()): string {
  const ms = toMs(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], {
    weekday: d.getFullYear() === now.getFullYear() ? "short" : undefined,
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

export const clock = (iso: string) => {
  const ms = toMs(iso);
  return Number.isFinite(ms) ? time(new Date(ms)) : "";
};
export const fullTime = (iso: string) => {
  const ms = toMs(iso);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : "";
};

/** "Active now", "Active 5m ago", "Active 2h ago". */
export function activeLabel(active?: boolean, seenAt?: string | null, now = Date.now()): string {
  if (active) return "Active now";
  const ms = toMs(seenAt);
  if (!Number.isFinite(ms)) return "";
  const minutes = Math.max(1, Math.round((now - ms) / 60000));
  return minutes < 60 ? `Active ${minutes}m ago` : `Active ${Math.round(minutes / 60)}h ago`;
}

export function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
export const isImage = (type?: string) => !!type && type.startsWith("image/");

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Same name → same avatar colour, from a small brand-friendly set (see messenger.css). */
export function tone(name: string): number {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % 6;
}

export type TimelineItem =
  | { type: "day"; key: string; label: string }
  | { type: "time"; key: string; label: string }
  | { type: "message"; key: string; message: ChatMessage; first: boolean; last: boolean };

const GROUP_GAP = 5 * 60 * 1000;
const TIME_GAP = 30 * 60 * 1000;

/**
 * Messages laid out like a messenger: a day line when the date changes, a time line after a
 * 30-minute pause, and same-sender messages within 5 minutes stacked as one group.
 */
export function buildTimeline(messages: ChatMessage[], now = new Date()): TimelineItem[] {
  const items: TimelineItem[] = [];
  let previous: ChatMessage | null = null;
  messages.forEach((message, index) => {
    const at = toMs(message.sentAt);
    const prevAt = previous ? toMs(previous.sentAt) : NaN;
    const newDay = !previous || !sameDay(new Date(at), new Date(prevAt));
    const pause = !newDay && at - prevAt > TIME_GAP;
    if (newDay) items.push({ type: "day", key: `d-${message.id}`, label: dayLabel(message.sentAt, now) });
    if (newDay || pause) items.push({ type: "time", key: `t-${message.id}`, label: clock(message.sentAt) });
    const next = messages[index + 1];
    const breaks = (a: ChatMessage, b: ChatMessage) =>
      a.system || b.system || a.senderId !== b.senderId || toMs(b.sentAt) - toMs(a.sentAt) > GROUP_GAP ||
      !sameDay(new Date(toMs(a.sentAt)), new Date(toMs(b.sentAt)));
    const first = newDay || pause || !previous || breaks(previous, message);
    const last = !next || breaks(message, next) || toMs(next.sentAt) - at > TIME_GAP;
    items.push({ type: "message", key: message.clientId ? `c-${message.clientId}` : message.id, message, first, last });
    previous = message;
  });
  return items;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** Plain text with web links made clickable, and search matches marked. Nothing else is interpreted. */
export function linkify(text: string, highlight?: string): ReactNode[] {
  const mark = (part: string, key: string): ReactNode[] => {
    const q = highlight?.trim();
    if (!q) return [part];
    const out: ReactNode[] = [];
    const lower = part.toLowerCase();
    const needle = q.toLowerCase();
    let i = 0;
    let at = lower.indexOf(needle);
    while (at !== -1) {
      if (at > i) out.push(part.slice(i, at));
      out.push(<mark key={`${key}-${at}`}>{part.slice(at, at + q.length)}</mark>);
      i = at + q.length;
      at = lower.indexOf(needle, i);
    }
    if (i < part.length) out.push(part.slice(i));
    return out;
  };
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) out.push(...mark(text.slice(last, start), `t${last}`));
    out.push(
      <a key={start} href={match[0]} target="_blank" rel="noopener noreferrer nofollow">
        {match[0]}
      </a>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) out.push(...mark(text.slice(last), `t${last}`));
  return out;
}

/** The one-line preview under a chat's name. */
export function previewLine(c: { lastMessage: string; lastMessageMine: boolean }): string {
  if (!c.lastMessage) return "No messages yet";
  return c.lastMessageMine ? `You: ${c.lastMessage}` : c.lastMessage;
}
