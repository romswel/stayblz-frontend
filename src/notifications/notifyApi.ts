import { api } from "../api";

/** Your notification choices (backend routes/notifications.ts; rows in notification_settings). */
export interface NotificationSettings {
  enabled: boolean;
  chatMessages: boolean;
  chatRequests: boolean;
  /** "@You" in a group, and replies to your messages (even in muted chats). */
  chatMentions?: boolean;
  /** Reactions to your messages. */
  chatReactions?: boolean;
  /** Stayblz Paddock: incoming calls, meetings starting, invitations. */
  paddockCalls: boolean;
  previews: boolean;
  sound: boolean;
  promptedAt: string | null;
  devices: number;
}
export interface PushInfo {
  available: boolean;
  publicKey: string | null;
}
export type SettingsChange = Partial<
  Pick<NotificationSettings, "enabled" | "chatMessages" | "chatRequests" | "chatMentions" | "chatReactions" | "paddockCalls" | "previews" | "sound">
> & {
  prompted?: boolean;
};

export type ChatAlertKind =
  | "message"
  | "request"
  | "mention"
  | "reply"
  | "reaction"
  | "group_added"
  | "friend_request"
  | "friend_accepted"
  | "request_accepted";

/** One saved Stayblz Chat alert (backend chat_alerts; the bell list and on-screen alerts). */
export interface ChatAlert {
  id: string;
  kind: ChatAlertKind;
  chatKind: "personal" | "team" | null;
  chatId: string | null;
  messageId: string | null;
  stableId: string | null;
  actorId: string | null;
  actorName: string;
  title: string | null;
  group: boolean;
  body: string;
  emoji: string | null;
  attachment: { type?: string; name?: string; width?: number; height?: number; duration?: number } | null;
  count: number;
  at: string;
  read: boolean;
}

/** One new message from the menu poll (older backends; newer ones send `alerts`). */
export interface IncomingChat {
  chatId: string;
  kind: "personal" | "team";
  stableId: string | null;
  stableName: string | null;
  group: boolean;
  title: string | null;
  from: string;
  fromId: string | null;
  body: string;
  at: string;
  request: boolean;
}
export interface UnreadAnswer {
  personal: number;
  requests: number;
  team: number;
  incoming?: IncomingChat[];
  alerts?: ChatAlert[];
  alertsUnread?: number | null;
  now?: string;
}

export const notifyApi = {
  settings: (signal?: AbortSignal) => api.get<{ settings: NotificationSettings; push: PushInfo }>("/api/notifications/settings", { signal }),
  save: (changes: SettingsChange) => api.post<{ settings: NotificationSettings; push: PushInfo }>("/api/notifications/settings", changes),
  subscribe: (subscription: PushSubscriptionJSON) => api.post<{ ok: true; devices: number }>("/api/notifications/push/subscribe", subscription),
  unsubscribe: (endpoint: string) => api.post<{ ok: true }>("/api/notifications/push/unsubscribe", { endpoint }),
  test: () => api.post<{ available: boolean; sent: number; devices: number }>("/api/notifications/push/test", {}),
  alerts: (signal?: AbortSignal) => api.get<{ items: ChatAlert[]; unread: number }>("/api/notifications/alerts", { signal }),
  markRead: (ids: string[] | "all") =>
    api.post<{ unread: number }>("/api/notifications/alerts/read", ids === "all" ? { all: true } : { ids }),
};
