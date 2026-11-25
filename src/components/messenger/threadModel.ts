import { toMs } from "./format";
import type { ChatMessage, ChatPreview, ChatThread } from "./types";

/** Pure helpers for chat data: merging, filling in missing fields, reactions. */

export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return current;
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => toMs(a.sentAt) - toMs(b.sentAt) || a.id.localeCompare(b.id));
}

/** Fill in anything a response left out (an older server, a partial poll) so rendering never breaks. */
export function normalizeMessage(m: Partial<ChatMessage> & { id: string }): ChatMessage {
  return {
    id: m.id,
    senderId: m.senderId ?? (m.mine ? "me" : (m.from ?? "")),
    from: m.from ?? "Member",
    body: m.body ?? "",
    sentAt: m.sentAt ?? new Date(0).toISOString(),
    mine: !!m.mine,
    removed: !!m.removed,
    edited: !!m.edited,
    forwarded: !!m.forwarded,
    system: !!m.system,
    pinned: !!m.pinned,
    attachment: m.attachment && typeof m.attachment === "object" ? m.attachment : null,
    listing:
      m.listing && typeof m.listing === "object" && typeof m.listing.id === "string" && typeof m.listing.name === "string"
        ? m.listing
        : null,
    reactions: Array.isArray(m.reactions) ? m.reactions : [],
    replyTo: m.replyTo ?? null,
  };
}

export function normalizeThread(c: Partial<ChatThread> & { id: string }): ChatThread {
  return {
    id: c.id,
    kind: c.kind ?? "group",
    title: c.title ?? "Chat",
    participants: c.participants ?? [],
    participantIds: c.participantIds ?? [],
    otherId: c.otherId ?? null,
    createdBy: c.createdBy ?? null,
    lastMessage: c.lastMessage ?? "",
    lastMessageMine: !!c.lastMessageMine,
    lastSenderId: c.lastSenderId ?? null,
    lastSenderName: c.lastSenderName ?? null,
    mutedUntil: c.mutedUntil ?? null,
    photo: c.photo ?? null,
    lastMessageAt: c.lastMessageAt ?? "",
    lastStatus: c.lastStatus ?? null,
    unread: !!c.unread,
    request: !!c.request,
    waiting: !!c.waiting,
    canInvite: !!c.canInvite,
    pinned: !!c.pinned,
    archived: !!c.archived,
    muted: !!c.muted,
    folderId: c.folderId ?? null,
    active: !!c.active,
    // Newer servers only: left out (not null) when missing, so an older answer doesn't wipe what the list has.
    ...(c.readAt !== undefined ? { readAt: c.readAt } : {}),
    ...(c.lastReaction !== undefined ? { lastReaction: c.lastReaction } : {}),
    members: c.members ?? [],
    reads: c.reads ?? [],
    delivered: c.delivered ?? [],
    pinnedMessages: c.pinnedMessages ?? [],
    typing: c.typing ?? [],
    direct: c.direct ?? null,
    messages: (c.messages ?? []).map(normalizeMessage),
  };
}

/**
 * The chat-list row for a conversation. A thread keeps presence on its members, not on the chat, so for a one-to-one
 * chat it's copied from the other person; with no member info it's left out, so the list keeps what it had (copying
 * a blank "not active" here is what made the green dot blink off and on while a chat was open).
 */
export function previewOf(thread: ChatThread): ChatPreview {
  const {
    members,
    reads: _reads,
    delivered: _delivered,
    pinnedMessages: _pins,
    typing: _typing,
    direct: _direct,
    messages: _messages,
    active: _active,
    presence: _presence,
    ...preview
  } = thread;
  const other = preview.kind === "direct" ? members?.find((m) => !m.me) : undefined;
  if (!other) return preview;
  if (other.presence !== undefined) return { ...preview, presence: other.presence, active: other.presence === "online" };
  return { ...preview, active: !!other.active };
}

/** Your reaction moves to `emoji`, or is removed when it was already `emoji`. */
export function toggleReaction(m: ChatMessage, emoji: string): ChatMessage {
  const previous = m.reactions.find((r) => r.mine)?.emoji;
  let reactions = m.reactions
    .map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r))
    .filter((r) => r.count > 0);
  if (previous !== emoji) {
    const found = reactions.find((r) => r.emoji === emoji);
    reactions = found
      ? reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r))
      : [...reactions, { emoji, count: 1, mine: true }];
  }
  return { ...m, reactions };
}

export function lastFromOthers(messages: ChatMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) if (!messages[i].mine && !messages[i].status) return messages[i];
  return undefined;
}
