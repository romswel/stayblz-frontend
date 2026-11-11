import type { Page } from "@playwright/test";

// Messenger UI against a small in-memory fake of /api/messages (see backend routes/chat.ts).
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
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

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
    lastMessage: last?.body ?? "",
    lastMessageMine: !!last?.mine,
    lastMessageAt: last?.sentAt ?? ago(60),
    unread: false,
    request: false,
    waiting: false,
    canInvite: false,
    members: [
      { id: me.id, name: me.displayName, me: true, pending: false },
      { id: "other-" + id, name: title, me: false, pending: false },
    ],
    reads: [] as { id: string; name: string; at: string }[],
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
    }),
  };
  const state = {
    threads,
    listCalls: 0,
    posts: [] as { path: string; body: any }[],
    incoming: [] as Msg[],
  };
  await page.addInitScript(() => localStorage.setItem("stayblz.token", "browser-test-token"));
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const json = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    const body = req.method() === "POST" ? req.postDataJSON() : undefined;
    if (req.method() === "POST") state.posts.push({ path, body });
    if (path === "/api/auth/me") return json({ user: me });
    if (path === "/api/messages/unread") return json(unread);
    if (path === "/api/messages" && req.method() === "GET") {
      state.listCalls++;
      return json({
        conversations: Object.values(state.threads).map(({ members, reads, messages, ...preview }) => preview),
      });
    }
    if (path === "/api/messages/direct") {
      if (body.email === "nobody@example.test")
        return json({ code: "no_account", error: "No Stayblz account uses that email." }, 404);
      state.threads[NEW] = chat(NEW, "Friend Person", [], { waiting: true });
      state.threads[NEW].members[1].pending = true;
      return json({ conversation: state.threads[NEW], before: null, now: new Date().toISOString() }, 201);
    }
    const match = path.match(/^\/api\/messages\/([0-9a-f-]{36})(?:\/(.*))?$/);
    const thread = match ? state.threads[match[1]] : undefined;
    if (match && thread) {
      const rest = match[2];
      if (!rest) return json({ conversation: thread, before: null, now: new Date().toISOString() });
      if (rest === "updates") {
        const changed = state.incoming.splice(0);
        thread.messages.push(...changed);
        return json({ conversation: { ...thread, messages: changed }, before: null, now: new Date().toISOString() });
      }
      if (rest === "messages") {
        const quoted = thread.messages.find((m) => m.id === body.replyTo);
        const sent = msg("", body.body, true, 0, {
          replyTo: quoted ? { id: quoted.id, from: quoted.from, body: quoted.body, removed: false } : null,
        });
        thread.messages.push(sent);
        return json({ message: sent }, 201);
      }
      if (rest === "accept") thread.request = false;
      if (["read", "accept", "leave"].includes(rest)) return json({ ok: true });
      const action = rest.match(/^messages\/(.+)\/(react|unsend)$/);
      const target = action && thread.messages.find((m) => m.id === action[1]);
      if (action && target) {
        if (action[2] === "react") target.reactions = [{ emoji: body.emoji, count: 1, mine: true }];
        else Object.assign(target, { removed: true, body: "", reactions: [] });
        return json({ message: target });
      }
    }
    return json({});
  });
  return state;
}

