import { useMemo } from "react";
import { api } from "../../api";
import { useStableApi } from "../../workspace";
import type { ChatMessage, ChatMode, ChatPreview, ThreadResponse } from "./types";

/** Tells the menu badge to refresh soon (after reading, sending, accepting or leaving). */
export const notifyChatsChanged = () => window.dispatchEvent(new Event("stayblz:chats-changed"));

/** Personal chats use the plain API; team chats send the selected stable header. */
export function useChatApi(mode: ChatMode) {
  const team = useStableApi();
  return useMemo(() => {
    const client = mode === "team" ? team : api;
    const base = mode === "team" ? "/api/team-messages" : "/api/messages";
    const at = (id: string) => `${base}/${encodeURIComponent(id)}`;
    return {
      mode,
      list: (signal?: AbortSignal) => client.get<{ conversations: ChatPreview[] }>(base, { signal }),
      thread: (id: string, options: { signal?: AbortSignal; before?: string } = {}) =>
        client.get<ThreadResponse>(
          at(id) + (options.before ? `?before=${encodeURIComponent(options.before)}` : ""),
          { signal: options.signal },
        ),
      updates: (id: string, since: string, signal?: AbortSignal) =>
        client.get<ThreadResponse>(`${at(id)}/updates?since=${encodeURIComponent(since)}`, { signal }),
      send: (id: string, body: string, clientId: string, replyTo: string | null) =>
        client.post<{ message: ChatMessage }>(`${at(id)}/messages`, { body, clientId, replyTo }),
      react: (id: string, messageId: string, emoji: string) =>
        client.post<{ message: ChatMessage }>(`${at(id)}/messages/${encodeURIComponent(messageId)}/react`, { emoji }),
      unsend: (id: string, messageId: string) =>
        client.post<{ message: ChatMessage }>(`${at(id)}/messages/${encodeURIComponent(messageId)}/unsend`, {}),
      read: (id: string) => client.post<{ ok: true }>(`${at(id)}/read`, {}),
      leave: (id: string) => client.post<{ ok: true }>(`${at(id)}/leave`, {}),
      accept: (id: string) => client.post<{ ok: true }>(`${at(id)}/accept`, {}),
      /** Personal: by account email. Team: by teammate id. */
      startDirect: (to: string) =>
        client.post<ThreadResponse>(`${base}/direct`, mode === "team" ? { memberId: to } : { email: to }),
      createGroup: (title: string, memberIds: string[] = []) =>
        client.post<ThreadResponse>(base, mode === "team" ? { title, memberIds } : { title }),
    };
  }, [mode, team]);
}
export type ChatApi = ReturnType<typeof useChatApi>;
