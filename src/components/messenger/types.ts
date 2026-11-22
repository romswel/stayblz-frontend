/** Shapes returned by /api/messages and /api/team-messages (see backend routes/chat.ts). */
export type ChatMode = "personal" | "team";

/** Quick reactions (any emoji works through "+"; the backend accepts any single emoji). */
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "🐎"] as const;
/** Double-tap / double-click a message to send this one. */
export const QUICK_REACTION = "👍";
export const MAX_MESSAGE = 4000;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const EDIT_WINDOW_MS = 15 * 60_000;
/** Voice clips stop recording on their own after this long. */
export const MAX_VOICE_SECONDS = 120;

export interface ChatReaction {
  emoji: string;
  count: number;
  mine: boolean;
  /** Account ids of who reacted (newer servers). */
  ids?: string[];
}
export interface ChatReply {
  id: string;
  from: string;
  /** Who wrote the quoted message (newer servers), for "replied to you". */
  senderId?: string;
  body: string;
  removed: boolean;
  /** File name when the quoted message was a photo or file. */
  attachment?: string | null;
}
export interface ChatAttachment {
  name: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
  /** Voice clips: length in whole seconds. */
  duration?: number;
}
/** The Marketplace listing a "Message seller" message is about (a snapshot from when it was sent). */
export interface ChatListing {
  id: string;
  name: string;
  price: number;
  location: string;
  cover: { id: string; kind: "photo" | "video"; poster: boolean } | null;
  /** "stallion" = a Stayblz Stallions breeding request (links to his page; `fee` is the fee line). */
  kind?: "stallion";
  fee?: string;
}
export interface ChatMessage {
  id: string;
  senderId: string;
  from: string;
  body: string;
  sentAt: string;
  mine: boolean;
  removed: boolean;
  edited: boolean;
  forwarded: boolean;
  /** "Ann added Bob" lines. */
  system: boolean;
  pinned: boolean;
  attachment: ChatAttachment | null;
  /** Sent with "Message seller": the listing card shown under the message. */
  listing?: ChatListing | null;
  reactions: ChatReaction[];
  replyTo: ChatReply | null;
  /** Browser-only: a message in the outbox that the server hasn't confirmed. */
  status?: "sending" | "failed";
  clientId?: string;
  /** Browser-only: a file waiting in the outbox (kept in memory, not on the device). */
  file?: File;
  previewUrl?: string;
}
export type DeliveryStatus = "sent" | "delivered" | "seen";
export interface ChatPreview {
  id: string;
  kind: "direct" | "group";
  title: string;
  /** The other people in the chat (not you). */
  participants: string[];
  /** Their account ids, same order (newer servers). */
  participantIds?: string[];
  otherId?: string | null;
  createdBy?: string | null;
  lastMessage: string;
  lastMessageMine: boolean;
  lastSenderId?: string | null;
  lastSenderName?: string | null;
  lastMessageAt: string;
  lastStatus?: DeliveryStatus | null;
  unread: boolean;
  /** Someone wrote to you and you haven't accepted yet. */
  request: boolean;
  /** You wrote to someone who hasn't accepted yet. */
  waiting: boolean;
  canInvite: boolean;
  pinned?: boolean;
  archived?: boolean;
  muted?: boolean;
  /** Muted for a while: until this time. */
  mutedUntil?: string | null;
  folderId?: string | null;
  /** The other person is on Stayblz Chat right now (one-to-one chats). */
  active?: boolean;
  /** One-to-one chats: Online / Away / Offline (null when either of you hides it; missing on older servers). */
  presence?: Presence | null;
  /** Group photo version (members-only file), or null. */
  photo?: string | null;
}
export interface ChatMember {
  id: string;
  name: string;
  me: boolean;
  pending: boolean;
  admin?: boolean;
  active?: boolean;
  presence?: Presence | null;
  seenAt?: string | null;
}
/** online = using Stayblz now; away = open but idle (or a few minutes ago); offline = gone a while. */
export type Presence = "online" | "away" | "offline";
export interface ChatRead {
  id: string;
  name?: string;
  at: string;
}
export interface PinnedMessage {
  id: string;
  from: string;
  body: string;
  attachment: string | null;
  pinnedAt: string;
}
export interface ChatThread extends ChatPreview {
  members: ChatMember[];
  reads: ChatRead[];
  delivered: ChatRead[];
  pinnedMessages: PinnedMessage[];
  typing: string[];
  direct: { friend: FriendStatus | null; blockedByMe: boolean; blockedMe: boolean } | null;
  messages: ChatMessage[];
}
export interface ThreadResponse {
  conversation: ChatThread;
  before: string | null;
  now: string;
  /** The chat's live version (newer servers): send it back to long-poll for changes. */
  v?: number;
}
export interface UnreadCounts {
  personal: number;
  requests: number;
  team: number;
}
/** Unsent text kept on this device until the server confirms it. */
export interface OutboxItem {
  clientId: string;
  body: string;
  replyTo: ChatReply | null;
  at: string;
}
export interface ChatSettings {
  pinned?: boolean;
  archived?: boolean;
  muted?: boolean;
  /** Mute for a while (15 min … 7 days). */
  muteMinutes?: number;
  unread?: boolean;
  folder?: string | null;
}
export interface ChatFolder {
  id: string;
  name: string;
  position: number;
}

export type FriendStatus = "friends" | "outgoing" | "incoming" | "none";
export interface Person {
  id: string;
  name: string;
  role?: string;
  status?: FriendStatus;
  active?: boolean;
  presence?: Presence | null;
  seenAt?: string | null;
  /** People list: how many chats you share, and when one of them last had a message. */
  sharedChats?: number;
  lastAt?: string | null;
}
export interface ChatProfile {
  discoverable: boolean;
  showActive: boolean;
  storageUsed: number;
}
