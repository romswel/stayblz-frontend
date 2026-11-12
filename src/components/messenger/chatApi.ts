import { useMemo } from "react";
import { api, apiRaw } from "../../api";
import { useStableApi, useWorkspace } from "../../workspace";
import type {
  ChatAttachment,
  ChatFolder,
  ChatMessage,
  ChatMode,
  ChatPreview,
  ChatProfile,
  ChatSettings,
  FriendStatus,
  Person,
  ThreadResponse,
} from "./types";

/** Tells the menu badge to refresh soon (after reading, sending, accepting or leaving). */
export const notifyChatsChanged = () => window.dispatchEvent(new Event("stayblz:chats-changed"));

/** Personal chats use the plain API; team chats send the selected stable header. */
export function useChatApi(mode: ChatMode) {
  const team = useStableApi();
  const { active } = useWorkspace();
  const stableId = active?.id ?? "";
  return useMemo(() => {
    const client = mode === "team" ? team : api;
    const base = mode === "team" ? "/api/team-messages" : "/api/messages";
    const at = (id: string) => `${base}/${encodeURIComponent(id)}`;
    const msg = (id: string, messageId: string) => `${at(id)}/messages/${encodeURIComponent(messageId)}`;
    const headers: Record<string, string> = mode === "team" ? { "X-Stayblz-Stable": stableId } : {};
    return {
      mode,
      list: (signal?: AbortSignal) => client.get<{ conversations: ChatPreview[] }>(base, { signal }),
      thread: (id: string, options: { signal?: AbortSignal; before?: string } = {}) =>
        client.get<ThreadResponse>(at(id) + (options.before ? `?before=${encodeURIComponent(options.before)}` : ""), {
          signal: options.signal,
        }),
      updates: (id: string, since: string, signal?: AbortSignal) =>
        client.get<ThreadResponse>(`${at(id)}/updates?since=${encodeURIComponent(since)}`, { signal }),
      send: (id: string, body: string, clientId: string, replyTo: string | null) =>
        client.post<{ message: ChatMessage }>(`${at(id)}/messages`, { body, clientId, replyTo }),
      /** One photo or file per message; the body is the raw file. */
      upload: async (id: string, file: Blob, meta: { name: string; type: string; clientId: string; replyTo: string | null; width?: number; height?: number }) => {
        const q = new URLSearchParams({ name: meta.name, clientId: meta.clientId });
        if (meta.replyTo) q.set("replyTo", meta.replyTo);
        if (meta.width && meta.height) {
          q.set("width", String(meta.width));
          q.set("height", String(meta.height));
        }
        const res = await apiRaw(`${at(id)}/attachments?${q}`, {
          method: "POST",
          body: file,
          headers: { "Content-Type": meta.type || file.type || "application/octet-stream", ...headers },
        });
        return (await res.json()) as { message: ChatMessage };
      },
      /** The stored file as a Blob (members only). */
      file: async (id: string, messageId: string, signal?: AbortSignal) =>
        (await apiRaw(`${at(id)}/files/${encodeURIComponent(messageId)}`, { headers, signal })).blob(),
      react: (id: string, messageId: string, emoji: string) => client.post<{ message: ChatMessage }>(`${msg(id, messageId)}/react`, { emoji }),
      edit: (id: string, messageId: string, body: string) => client.post<{ message: ChatMessage }>(`${msg(id, messageId)}/edit`, { body }),
      pin: (id: string, messageId: string, pin: boolean) => client.post<{ message: ChatMessage }>(`${msg(id, messageId)}/pin`, { pin }),
      unsend: (id: string, messageId: string) => client.post<{ message: ChatMessage }>(`${msg(id, messageId)}/unsend`, {}),
      forward: (id: string, messageId: string, to: string[]) =>
        client.post<{ results: { to: string; ok: boolean; error?: string }[] }>(`${msg(id, messageId)}/forward`, { to }),
      read: (id: string) => client.post<{ ok: true }>(`${at(id)}/read`, {}),
      typing: (id: string, on: boolean) => client.post<{ ok: boolean }>(`${at(id)}/typing`, { on }),
      settings: (id: string, changes: ChatSettings) =>
        client.post<{ settings: Record<string, unknown> }>(`${at(id)}/settings`, changes),
      search: (id: string, q: string, signal?: AbortSignal) =>
        client.get<{ messages: ChatMessage[] }>(`${at(id)}/search?q=${encodeURIComponent(q)}`, { signal }),
      media: (id: string, signal?: AbortSignal) => client.get<{ messages: ChatMessage[] }>(`${at(id)}/media`, { signal }),
      rename: (id: string, title: string) => client.post<{ ok: true }>(`${at(id)}/rename`, { title }),
      addMembers: (id: string, ids: string[]) => client.post<{ added: number }>(`${at(id)}/members`, { ids }),
      removeMember: (id: string, member: string) => client.post<{ ok: true }>(`${at(id)}/members/${encodeURIComponent(member)}/remove`, {}),
      leave: (id: string) => client.post<{ ok: true }>(`${at(id)}/leave`, {}),
      accept: (id: string) => client.post<{ ok: true }>(`${at(id)}/accept`, {}),
      /** Personal: by account email. Team: by teammate id. */
      startDirect: (to: string) => client.post<ThreadResponse>(`${base}/direct`, mode === "team" ? { memberId: to } : { email: to }),
      createGroup: (title: string, memberIds: string[] = []) =>
        client.post<ThreadResponse>(base, mode === "team" ? { title, memberIds } : { title }),
    };
  }, [mode, team, stableId]);
}
export type ChatApi = ReturnType<typeof useChatApi>;

/** People, friends, blocks, privacy and folders (always personal, no stable). */
export const peopleApi = {
  search: (q: string, signal?: AbortSignal) =>
    api.get<{ people: Person[] }>(`/api/messages/people/search?q=${encodeURIComponent(q)}`, { signal }),
  friends: (signal?: AbortSignal) =>
    api.get<{ friends: Person[]; incoming: Person[]; outgoing: Person[] }>("/api/messages/people/friends", { signal }),
  friend: (person: string, action: "request" | "accept" | "decline" | "remove") =>
    api.post<{ status: FriendStatus }>(`/api/messages/people/friends/${encodeURIComponent(person)}/${action}`, {}),
  blocks: (signal?: AbortSignal) => api.get<{ blocked: Person[] }>("/api/messages/people/blocks", { signal }),
  block: (person: string, block: boolean) =>
    api.post<{ blocked: boolean }>(`/api/messages/people/blocks/${encodeURIComponent(person)}`, { block }),
  profile: (signal?: AbortSignal) => api.get<{ profile: ChatProfile }>("/api/messages/people/profile", { signal }),
  saveProfile: (changes: Partial<Pick<ChatProfile, "discoverable" | "showActive">>) =>
    api.post<{ profile: ChatProfile }>("/api/messages/people/profile", changes),
  chatWith: (person: string) => api.post<ThreadResponse>(`/api/messages/people/${encodeURIComponent(person)}/chat`, {}),
  folders: (signal?: AbortSignal) => api.get<{ folders: ChatFolder[] }>("/api/messages/folders", { signal }),
  createFolder: (name: string) => api.post<{ folder: ChatFolder }>("/api/messages/folders", { name }),
  renameFolder: (id: string, name: string) =>
    api.post<{ folder: ChatFolder }>(`/api/messages/folders/${encodeURIComponent(id)}/rename`, { name }),
  deleteFolder: (id: string) => api.post<{ ok: true }>(`/api/messages/folders/${encodeURIComponent(id)}/delete`, {}),
};

export type { ChatAttachment };
