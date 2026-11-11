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

/** Divider between message groups: "2:14 PM", "Yesterday 2:14 PM", "Tue 2:14 PM", "Nov 3, 2:14 PM". */
export function stamp(iso: string, now = new Date()): string {
  const ms = toMs(iso);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  if (sameDay(d, now)) return time(d);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return `Yesterday ${time(d)}`;
  if (now.getTime() - ms < 6 * 24 * 3600 * 1000) return `${d.toLocaleDateString([], { weekday: "short" })} ${time(d)}`;
  const date = d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  return `${date}, ${time(d)}`;
}

export const fullTime = (iso: string) => {
  const ms = toMs(iso);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : "";
};

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
  | { type: "divider"; key: string; label: string }
  | { type: "message"; key: string; message: ChatMessage; first: boolean; last: boolean };

const GROUP_GAP = 5 * 60 * 1000;
const DIVIDER_GAP = 30 * 60 * 1000;

/** Messages grouped like a messenger: same sender within 5 minutes stack; a time line after 30 minutes. */
export function buildTimeline(messages: ChatMessage[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let previous: ChatMessage | null = null;
  messages.forEach((message, index) => {
    const at = toMs(message.sentAt);
    const gap = previous ? at - toMs(previous.sentAt) : Infinity;
    const divider = !previous || gap > DIVIDER_GAP;
    if (divider) items.push({ type: "divider", key: `d-${message.id}`, label: stamp(message.sentAt) });
    const next = messages[index + 1];
    const first = divider || !previous || previous.senderId !== message.senderId || gap > GROUP_GAP;
    const last =
      !next ||
      next.senderId !== message.senderId ||
      toMs(next.sentAt) - at > GROUP_GAP ||
      toMs(next.sentAt) - at > DIVIDER_GAP;
    items.push({ type: "message", key: message.clientId ? `c-${message.clientId}` : message.id, message, first, last });
    previous = message;
  });
  return items;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

/** Plain text with web links made clickable. Nothing else is interpreted. */
export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a key={start} href={match[0]} target="_blank" rel="noopener noreferrer nofollow">
        {match[0]}
      </a>,
    );
    last = start + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The one-line preview under a chat's name. */
export function previewLine(c: { lastMessage: string; lastMessageMine: boolean; kind: string }): string {
  if (!c.lastMessage) return "No messages yet";
  return c.lastMessageMine ? `You: ${c.lastMessage}` : c.lastMessage;
}
