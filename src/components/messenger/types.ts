/** Shapes returned by /api/messages and /api/team-messages (see backend routes/chat.ts). */
export type ChatMode = "personal" | "team";

/** Must match chat_reactions() in the backend migration. */
export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🐎"] as const;
export const MAX_MESSAGE = 4000;

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
}
export interface ChatMessage {
  id: string;
  senderId: string;
  from: string;
  body: string;
  sentAt: string;
  mine: boolean;
  removed: boolean;
  reactions: ChatReaction[];
  replyTo: ChatReply | null;
  /** Browser-only: a message in the outbox that the server hasn't confirmed. */
  status?: "sending" | "failed";
  clientId?: string;
}
export interface ChatPreview {
  id: string;
  kind: "direct" | "group";
  title: string;
  /** The other people in the chat (not you). */
  participants: string[];
  lastMessage: string;
  lastMessageMine: boolean;
  lastMessageAt: string;
  unread: boolean;
  /** Someone wrote to you and you haven't accepted yet. */
  request: boolean;
  /** You wrote to someone who hasn't accepted yet. */
  waiting: boolean;
  canInvite: boolean;
}
export interface ChatMember {
  id: string;
  name: string;
  me: boolean;
  pending: boolean;
}
export interface ChatRead {
  id: string;
  name: string;
  at: string;
}
export interface ChatThread extends ChatPreview {
  members: ChatMember[];
  reads: ChatRead[];
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
/** Unsent message kept on this device until the server confirms it. */
export interface OutboxItem {
  clientId: string;
  body: string;
  replyTo: ChatReply | null;
  at: string;
}
