import { paddockApi } from "../paddock/paddockApi";
import type { ChatMode, ChatThread } from "./types";

/** GreenRoom reads this to start with the camera on or off (same key as Paddock's own "last used" setting). */
const PREJOIN_KEY = "stayblz.paddock.prejoin";

/**
 * Call from a chat: makes a Stayblz Paddock meeting with everyone in the chat invited (they join straight in;
 * anyone else has to ask the host), and returns the message to post plus where to go. Voice call = camera off to
 * start. Team chats don't attach the stable: that would let the whole stable in, not just this chat.
 * Free browser-to-browser calls, up to 8 people (see components/paddock).
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
  } catch {
    /* The green room just uses its usual setting. */
  }
  const link = `${window.location.origin}/paddock/${meeting.code}`;
  return {
    code: meeting.code,
    path: `/paddock/${meeting.code}`,
    message: `${video ? "📹 Video" : "📞 Voice"} call on Stayblz Paddock — tap to join: ${link}`,
  };
}
