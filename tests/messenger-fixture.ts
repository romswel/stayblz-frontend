import type { Page } from "@playwright/test";

// Stayblz Chat UI against a small in-memory fake of /api/messages (see backend routes/chat.ts,
// chatPeople.ts, chatFolders.ts).
export const me = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "me@example.test",
  displayName: "Rae Rider",
  role: "member",
  email: "me@example.test",
};
export const ANN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const REQ = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const GRP = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const NEW = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const ANN_USER = "a0000000-0000-4000-8000-00000000000a";
export const GUS_USER = "a0000000-0000-4000-8000-00000000000b";
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
// A 1×1 PNG.
export const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

let seq = 0;
export function msg(from: string, body: string, mine: boolean, minutesAgo: number, extra: Record<string, unknown> = {}) {
  return {
    id: `0000000${++seq}-0000-4000-8000-000000000000`.slice(-36).replace(/^0+/, (z) => "f".repeat(z.length)),
    senderId: mine ? me.id : from,
    from: mine ? me.displayName : from,
    body,
    sentAt: ago(minutesAgo),
    mine,
    removed: false,
    edited: false,
    forwarded: false,
    system: false,
    pinned: false,
    attachment: null as null | { name: string; size: number; type: string; width?: number; height?: number },
    reactions: [] as { emoji: string; count: number; mine: boolean }[],
    replyTo: null as null | { id: string; from: string; body: string; removed: boolean },
    ...extra,
  };
}
export type Msg = ReturnType<typeof msg>;
export function chat(id: string, title: string, messages: Msg[], extra: Record<string, unknown> = {}) {
  const last = messages[messages.length - 1];
  return {
    id,
    kind: "direct",
    title,
    participants: [title],
    otherId: "other-" + id,
    createdBy: me.id,
    lastMessage: last?.body ?? "",
    lastMessageMine: !!last?.mine,
    lastMessageAt: last?.sentAt ?? ago(60),
    lastStatus: last?.mine ? "sent" : null,
    unread: false,
    request: false,
    waiting: false,
    canInvite: false,
    pinned: false,
    archived: false,
    muted: false,
    folderId: null as string | null,
    active: false,
    members: [
      { id: me.id, name: me.displayName, me: true, pending: false, admin: true },
      { id: "other-" + id, name: title, me: false, pending: false, active: false },
    ] as { id: string; name: string; me: boolean; pending: boolean; admin?: boolean; active?: boolean }[],
    reads: [] as { id: string; name: string; at: string }[],
    delivered: [] as { id: string; at: string }[],
    pinnedMessages: [] as { id: string; from: string; body: string; attachment: string | null; pinnedAt: string }[],
    typing: [] as string[],
    direct: { friend: "none", blockedByMe: false, blockedMe: false } as null | Record<string, unknown>,
    messages,
    ...extra,
  };
}
export type Chat = ReturnType<typeof chat>;

export async function fakeServer(page: Page, unread = { personal: 0, requests: 0, team: 0 }) {
  const threads: Record<string, Chat> = {
    [ANN]: chat(ANN, "Ann Ames", [msg("Ann Ames", "Gallops at six?", false, 30), msg("", "I'll be there", true, 20)], {
      reads: [{ id: "other-ann", name: "Ann Ames", at: ago(5) }],
    }),
    [GRP]: chat(GRP, "Saturday syndicate", [msg("Bo Burke", "Who's driving?", false, 90)], {
      kind: "group",
      participants: ["Bo Burke", "Cy Cole"],
      direct: null,
      members: [
        { id: me.id, name: me.displayName, me: true, pending: false, admin: true },
        { id: "bo", name: "Bo Burke", me: false, pending: false },
        { id: "cy", name: "Cy Cole", me: false, pending: false },
      ],
    }),
  };
  const state = {
    threads,
    listCalls: 0,
    posts: [] as { path: string; body: any }[],
    incoming: [] as Msg[],
    typing: [] as string[],
    folders: [] as { id: string; name: string; position: number }[],
    friends: { friends: [] as any[], incoming: [] as any[], outgoing: [] as any[] },
    people: [
      { id: ANN_USER, name: "Ann Ames", role: "trainer", status: "none" },
      { id: GUS_USER, name: "Gus Grant", role: "owner", status: "none" },
    ],
    profile: { discoverable: true, showActive: true, storageUsed: 1_200_000 },
    blocked: [] as { id: string; name: string }[],
  };
  const now = () => new Date().toISOString();
  const preview = ({ members, reads, delivered, pinnedMessages, typing, direct, messages, ...rest }: Chat) => rest;

  await page.addInitScript(() => localStorage.setItem("stayblz.token", "browser-test-token"));
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    const isUpload = /\/attachments$/.test(path);
    const body = req.method() === "POST" && !isUpload ? req.postDataJSON() : undefined;
    if (req.method() === "POST") state.posts.push({ path: path + url.search, body });
    if (path === "/api/auth/me") return json({ user: me });
    if (path === "/api/messages/unread") return json(unread);
    if (path === "/api/messages" && req.method() === "GET") {
      state.listCalls++;
      return json({ conversations: Object.values(state.threads).map(preview) });
    }
    // Folders
    if (path === "/api/messages/folders") {
      if (req.method() === "POST") {
        const folder = { id: `f0000000-0000-4000-8000-00000000000${state.folders.length + 1}`, name: body.name, position: state.folders.length };
        state.folders.push(folder);
        return json({ folder }, 201);
      }
      return json({ folders: state.folders });
    }
    // People
    if (path === "/api/messages/people/friends") return json(state.friends);
    if (path === "/api/messages/people/search") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      return json({ people: state.people.filter((p) => p.name.toLowerCase().includes(q)) });
    }
    if (path === "/api/messages/people/profile") {
      if (req.method() === "POST") Object.assign(state.profile, body);
      return json({ profile: state.profile });
    }
    if (path === "/api/messages/people/blocks") return json({ blocked: state.blocked });
    const friend = path.match(/^\/api\/messages\/people\/friends\/([^/]+)\/(request|accept|decline|remove)$/);
    if (friend) {
      const person = state.people.find((p) => p.id === friend[1]);
      if (person) person.status = friend[2] === "request" ? "outgoing" : friend[2] === "accept" ? "friends" : "none";
      return json({ status: person?.status ?? "none" });
    }
    const block = path.match(/^\/api\/messages\/people\/blocks\/([^/]+)$/);
    if (block) return json({ blocked: body.block });
    const start = path.match(/^\/api\/messages\/people\/([^/]+)\/chat$/);
    if (start) {
      const person = state.people.find((p) => p.id === start[1])!;
      state.threads[NEW] = chat(NEW, person.name, [], { waiting: person.status !== "friends" });
      return json({ conversation: state.threads[NEW], before: null, now: now() }, 201);
    }
    if (path === "/api/messages/direct") {
      if (body.email === "nobody@example.test") return json({ code: "no_account", error: "No Stayblz account uses that email." }, 404);
      state.threads[NEW] = chat(NEW, "Friend Person", [], { waiting: true });
      state.threads[NEW].members[1].pending = true;
      return json({ conversation: state.threads[NEW], before: null, now: now() }, 201);
    }
    if (path === "/api/messages" && req.method() === "POST") {
      state.threads[NEW] = chat(NEW, body.title, [], { kind: "group", participants: [], canInvite: true, direct: null, members: [chat(NEW, "x", []).members[0]] });
      return json({ conversation: state.threads[NEW], before: null, now: now() }, 201);
    }

    const match = path.match(/^\/api\/messages\/([0-9a-f-]{36})(?:\/(.*))?$/);
    const thread = match ? state.threads[match[1]] : undefined;
    if (match && thread) {
      const rest = match[2];
      if (!rest) return json({ conversation: thread, before: null, now: now() });
      if (rest === "updates") {
        const changed = state.incoming.splice(0);
        thread.messages.push(...changed);
        return json({ conversation: { ...thread, typing: state.typing, messages: changed }, before: null, now: now() });
      }
      if (rest === "messages") {
        const quoted = thread.messages.find((m) => m.id === body.replyTo);
        const sent = msg("", body.body, true, 0, {
          replyTo: quoted ? { id: quoted.id, from: quoted.from, body: quoted.body, removed: false } : null,
        });
        thread.messages.push(sent);
        return json({ message: sent }, 201);
      }
      if (rest === "attachments") {
        const sent = msg("", "", true, 0, {
          attachment: {
            name: url.searchParams.get("name") ?? "file",
            size: (req.postDataBuffer() ?? Buffer.alloc(0)).length,
            type: req.headers()["content-type"],
            width: Number(url.searchParams.get("width")) || undefined,
            height: Number(url.searchParams.get("height")) || undefined,
          },
        });
        thread.messages.push(sent);
        return json({ message: sent }, 201);
      }
      const file = rest.match(/^files\/(.+)$/);
      if (file) return route.fulfill({ status: 200, body: PNG, headers: { "Content-Type": "image/png" } });
      if (rest === "media") return json({ messages: thread.messages.filter((m) => m.attachment && !m.removed) });
      if (rest === "search") {
        const q = (url.searchParams.get("q") ?? "").toLowerCase();
        return json({ messages: thread.messages.filter((m) => m.body.toLowerCase().includes(q)).reverse() });
      }
      if (rest === "settings") {
        if ("pinned" in body) thread.pinned = body.pinned;
        if ("muted" in body) thread.muted = body.muted;
        if ("archived" in body) thread.archived = body.archived;
        if ("unread" in body) thread.unread = body.unread;
        if ("folder" in body) thread.folderId = body.folder;
        return json({ settings: { pinned: thread.pinned, muted: thread.muted, archived: thread.archived, unread: thread.unread, folderId: thread.folderId } });
      }
      if (rest === "accept") thread.request = false;
      if (rest === "rename") thread.title = body.title;
      if (["read", "accept", "leave", "typing", "rename"].includes(rest)) return json({ ok: true });
      const action = rest.match(/^messages\/(.+)\/(react|unsend|edit|pin|forward)$/);
      const target = action && thread.messages.find((m) => m.id === action[1]);
      if (action && target) {
        if (action[2] === "react") target.reactions = [{ emoji: body.emoji, count: 1, mine: true }];
        else if (action[2] === "edit") Object.assign(target, { body: body.body, edited: true });
        else if (action[2] === "pin") {
          target.pinned = body.pin;
          thread.pinnedMessages = body.pin ? [{ id: target.id, from: target.from, body: target.body, attachment: null, pinnedAt: now() }] : [];
        } else if (action[2] === "forward") {
          for (const to of body.to) state.threads[to]?.messages.push(msg("", target.body, true, 0, { forwarded: true }));
          return json({ results: body.to.map((to: string) => ({ to, ok: true })) });
        } else Object.assign(target, { removed: true, body: "", attachment: null, reactions: [] });
        return json({ message: target });
      }
    }
    return json({});
  });
  return state;
}
