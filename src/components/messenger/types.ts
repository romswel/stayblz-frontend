/** Shapes returned by /api/messages and /api/team-messages (see backend routes/chat.ts). */
export type ChatMode = "personal" | "team";

/** Quick reactions. Must be allowed by chat_reactions() in the backend migration. */
export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🐎"] as const;
export const MAX_MESSAGE = 4000;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const EDIT_WINDOW_MS = 15 * 60_000;

export interface ChatReaction {
  emoji: string;
  count: number;
  mine: boolean;
}
export interface ChatReply {
  id: string;
  from: string;
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
  otherId?: string | null;
  createdBy?: string | null;
  lastMessage: string;
  lastMessageMine: boolean;
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
  folderId?: string | null;
  /** The other person is on Stayblz Chat right now (one-to-one chats). */
  active?: boolean;
}
export interface ChatMember {
  id: string;
  name: string;
  me: boolean;
  pending: boolean;
  admin?: boolean;
  active?: boolean;
  seenAt?: string | null;
}
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
}
export interface ChatProfile {
  discoverable: boolean;
  showActive: boolean;
  storageUsed: number;
}
