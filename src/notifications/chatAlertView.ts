import { firstName } from "../components/messenger/format";
import { plainText } from "../components/messenger/chatFormat";
import { isRacingAlert, isServerWordedAlert, type ChatAlert, type ChatAlertKind, type IncomingChat, type NotificationSettings } from "./notifyApi";

/**
 * How a Stayblz Chat alert reads on screen (corner card, bell list, system notification). Same words as the
 * phone's push notification (backend lib/chatAlerts.ts alertWords), so every place agrees.
 */
export interface AlertView {
  title: string;
  body: string;
  url: string;
  /** A photo message's file (personal chats; team files need the stable header, which an <img> can't send). */
  image?: string;
  /** Small badge on the face: 🎉 for a reaction, @ for a mention, ↩ for a reply… */
  badge?: string;
}

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text);

export function summaryOf(body: string, attachment: ChatAlert["attachment"]) {
  // Chat formatting marks and "@highlight" dropped, spoilers kept hidden, a GIF link reads "GIF".
  const text = plainText(body).replace(/\s+/g, " ").trim();
  if (text) return clip(text, 140);
  const type = attachment?.type ?? "";
  if (type.startsWith("image/")) return "📷 Sent a photo";
  if (type.startsWith("audio/")) return "🎤 Sent a voice message";
  if (type.startsWith("video/")) return "🎬 Sent a video";
  if (attachment) return "📎 Sent a file";
  return "Sent a message";
}

export function alertUrl(a: Pick<ChatAlert, "kind" | "chatKind" | "chatId" | "messageId" | "stableId">) {
  if (a.kind === "friend_request" || a.kind === "friend_accepted" || !a.chatId) return "/messages?people=1";
  const params = new URLSearchParams();
  if (a.chatKind === "team" && a.stableId) params.set("stable", a.stableId);
  if (a.messageId && a.kind !== "message" && a.kind !== "request") params.set("m", a.messageId);
  const query = params.toString();
  return `${a.chatKind === "team" ? "/team-messages" : "/messages"}/${a.chatId}${query ? `?${query}` : ""}`;
}

/** A racing alert's words are written by the server (SQL racing_notify), same as its push. */
const RACING_BADGE: Record<string, string> = { race_entry: "🏇", race_scratch: "✕", race_result: "🏁", workout: "⏱", race_change: "⇄" };
const sameSitePath = (link: string | null | undefined) => (link && /^\/[A-Za-z0-9]/.test(link) ? link : "/my-racing");

export function viewOf(a: ChatAlert, previews: boolean): AlertView {
  if (a.kind === "billing")
    return { title: a.title || "Stayblz Billing", body: a.body, url: a.link && /^\/[A-Za-z0-9]/.test(a.link) ? a.link : "/billing", badge: "$" };
  if (a.kind === "horse")
    return {
      title: a.title || "My horses",
      body: a.actorName ? `${a.actorName}: ${a.body}` : a.body,
      url: a.link && /^\/[A-Za-z0-9]/.test(a.link) ? a.link : "/account/horses",
      badge: "🐎",
    };
  if (isRacingAlert(a.kind))
    return { title: a.title || a.actorName || "Racing update", body: a.body, url: sameSitePath(a.link), badge: RACING_BADGE[a.kind] };
  const who = a.actorName || "Stayblz member";
  const where = a.group && a.title ? ` in ${clip(a.title, 60)}` : "";
  const said = summaryOf(a.body, a.attachment);
  const url = alertUrl(a);
  const image =
    previews && a.chatKind === "personal" && a.chatId && a.messageId && a.attachment?.type?.startsWith("image/")
      ? `/api/messages/${a.chatId}/files/${a.messageId}`
      : undefined;
  switch (a.kind) {
    case "message":
      if (!previews) return { title: a.group && a.title ? a.title : who, body: a.count > 1 ? `${a.count} new messages` : "New message", url };
      return a.group
        ? { title: a.title || "Group chat", body: `${firstName(who)}: ${said}`, url, image }
        : { title: who, body: a.count > 1 ? `${said} · ${a.count} new` : said, url, image };
    case "request":
      return { title: who, body: previews ? `Message request: ${said}` : "Wants to send you a message", url, image, badge: "✉" };
    case "mention":
      return { title: `${who} mentioned you${where}`, body: previews ? said : "Tap to see the message", url, image, badge: "@" };
    case "reply":
      return { title: `${who} replied to you${where}`, body: previews ? said : "Tap to see the reply", url, image, badge: "↩" };
    case "reaction":
      return {
        title: `${who} reacted ${a.emoji ?? ""} to your message`.replace(/\s+/g, " "),
        body: previews ? `“${clip(said, 100)}”` : "Tap to see it",
        url,
        image,
        badge: a.emoji ?? "♥",
      };
    case "group_added":
      return { title: `${who} added you to ${a.title ? clip(a.title, 60) : "a group"}`, body: "Tap to open the chat.", url, badge: "+" };
    case "friend_request":
      return { title: `${who} wants to be friends`, body: "Accept or decline in Stayblz Chat → People.", url, badge: "+" };
    case "friend_accepted":
      return { title: `${who} accepted your friend request`, body: "You can message each other any time.", url, badge: "✓" };
    case "request_accepted":
      return { title: `${who} accepted your message request`, body: "Your messages now go straight to their chats.", url, badge: "✓" };
  }
}

/** Which notification switch an alert kind follows (matches SQL chat_alert_allowed). */
export function allowedBy(settings: NotificationSettings, kind: ChatAlertKind) {
  if (!settings.enabled) return false;
  if (isServerWordedAlert(kind)) return true; // racing: My racing → Alert settings; billing: always (money matters)
  if (kind === "message" || kind === "group_added") return settings.chatMessages;
  if (kind === "mention" || kind === "reply") return settings.chatMentions !== false;
  if (kind === "reaction") return settings.chatReactions !== false;
  return settings.chatRequests;
}

/** Older backends send `incoming` (new messages only): read them as message / request alerts. */
export function fromIncoming(item: IncomingChat): ChatAlert {
  return {
    id: `${item.kind}:${item.chatId}`,
    kind: item.request ? "request" : "message",
    chatKind: item.kind,
    chatId: item.chatId,
    messageId: null,
    stableId: item.stableId,
    actorId: item.fromId,
    actorName: item.from,
    title: item.title,
    group: item.group,
    body: item.body,
    emoji: null,
    attachment: null,
    count: 1,
    at: item.at,
    read: false,
  };
}
