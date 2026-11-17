import { api } from "../api";

/** Your notification choices (backend routes/notifications.ts; rows in notification_settings). */
export interface NotificationSettings {
  enabled: boolean;
  chatMessages: boolean;
  chatRequests: boolean;
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
export type SettingsChange = Partial<Pick<NotificationSettings, "enabled" | "chatMessages" | "chatRequests" | "paddockCalls" | "previews" | "sound">> & {
  prompted?: boolean;
};

/** One new message from the menu poll (/api/messages/unread?since=…). */
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
  now?: string;
}

export const notifyApi = {
  settings: (signal?: AbortSignal) => api.get<{ settings: NotificationSettings; push: PushInfo }>("/api/notifications/settings", { signal }),
  save: (changes: SettingsChange) => api.post<{ settings: NotificationSettings; push: PushInfo }>("/api/notifications/settings", changes),
  subscribe: (subscription: PushSubscriptionJSON) => api.post<{ ok: true; devices: number }>("/api/notifications/push/subscribe", subscription),
  unsubscribe: (endpoint: string) => api.post<{ ok: true }>("/api/notifications/push/unsubscribe", { endpoint }),
  test: () => api.post<{ available: boolean; sent: number; devices: number }>("/api/notifications/push/test", {}),
};
