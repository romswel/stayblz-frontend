import { paddockApi } from "../paddock/paddockApi";
import type { ChatMode, ChatThread } from "./types";

/** GreenRoom reads this to start with the camera on or off (same key as Paddock's own "last used" setting). */
const PREJOIN_KEY = "stayblz.paddock.prejoin";

/**
 * A chat's Paddock: makes a Stayblz Paddock meeting with everyone in the chat invited (they join straight in and
 * are rung; anyone else you share the link with asks the host), and returns the message to post plus where to go.
 * `video` = camera on to start. Team chats don't attach the stable: that would let the whole stable in, not just
 * this chat. Free browser-to-browser meetings, up to 8 people (see components/paddock).
 */
export async function startChatCall(thread: ChatThread, _mode: ChatMode, video: boolean) {
  const others = thread.members.filter((m) => !m.me && !m.pending).map((m) => m.id);
  const title = thread.kind === "group" ? thread.title : `Call with ${thread.members.find((m) => m.me)?.name ?? "me"} & ${thread.title}`;
  const { meeting } = await paddockApi.create({
    title: title.slice(0, 100),
    access: "ask",
    guestsAllowed: false,
    inviteeIds: others.slice(0, 50),
  });
  try {
    localStorage.setItem(PREJOIN_KEY, JSON.stringify({ mic: true, cam: video }));
    // Once the caller is in, the call rings everyone in the chat (engine/call.ts reads this).
    sessionStorage.setItem(`stayblz.paddock.ring.${meeting.code}`, video ? "video" : "voice");
  } catch {
    /* The green room just uses its usual setting; people can still join from the chat message. */
  }
  const link = `${window.location.origin}/paddock/${meeting.code}`;
  return {
    code: meeting.code,
    path: `/paddock/${meeting.code}`,
    // MessageRow shows this as a "Paddock · Join" card; older apps see a plain link.
    message: `📹 Paddock started for this chat — tap to join: ${link}`,
  };
}
