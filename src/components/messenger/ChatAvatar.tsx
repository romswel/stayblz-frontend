import { createContext, useContext } from "react";
import { useFileUrl } from "./AttachmentView";
import type { ChatApi } from "./chatApi";
import { peopleOf } from "./format";
import { Avatar } from "./icons";
import type { ChatPreview } from "./types";

/** The open chat app's API (personal or team), so any avatar can load a members-only group photo. */
export const ChatApiContext = createContext<ChatApi | null>(null);

/** A group's photo as a blob: URL (members only, cached for the visit), or null. */
export function useGroupPhoto(c: Pick<ChatPreview, "id" | "kind" | "photo"> | undefined | null) {
  const chatApi = useContext(ChatApiContext);
  const version = c?.kind === "group" ? (c.photo ?? null) : null;
  const key = version && c ? `gphoto:${chatApi?.mode}:${c.id}:${version}` : null;
  const { url } = useFileUrl(key, key && chatApi ? () => chatApi.photo(c!.id, version!) : null);
  return key ? url : null;
}

/**
 * The right face for a chat: the other person's profile picture (one-to-one), the group's photo, or — for a
 * group without one — two members' faces, Messenger style. Green dot when they're active.
 */
export default function ChatAvatar({ c, size = "md", active }: { c: ChatPreview; size?: "sm" | "md" | "lg" | "xl"; active?: boolean }) {
  const photo = useGroupPhoto(c);
  const group = c.kind === "group";
  return (
    <Avatar
      name={c.title}
      id={group ? null : c.otherId}
      group={group}
      people={group ? peopleOf(c) : undefined}
      src={photo}
      size={size}
      active={active ?? (!group && !!c.active)}
    />
  );
}
