import type { Page, Route } from "@playwright/test";

// A small in-memory fake of /api/paddock (backend routes/paddock.ts + paddockLive.ts, lib/paddockRooms.ts),
// shared by every page in a test so real browser-to-browser calls can be set up between them.
export interface FakeUser {
  id: string;
  username: string;
  displayName: string;
  role: "member";
  email: string;
}
const user = (id: string, displayName: string): FakeUser => ({ id, username: `${id}@example.test`, displayName, role: "member", email: `${id}@example.test` });
export const HANA = user("a1111111-1111-4111-8111-111111111111", "Hana Host");
export const IVY = user("b2222222-2222-4222-8222-222222222222", "Ivy Invitee");
export const SAM = user("c3333333-3333-4333-8333-333333333333", "Sam Stranger");

/** Chromium with a fake camera/mic (a moving test pattern and a beep) and no permission prompts. */
export const FAKE_MEDIA = {
  permissions: ["camera", "microphone"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
      // Let two pages on this machine connect directly (no .local name lookups in headless).
      "--disable-features=WebRtcHideLocalIpsWithMdns",
    ],
  },
};

interface PeerState {
  mic: boolean;
  cam: boolean;
  screen: boolean;
  hand: number | null;
}
interface Peer {
  id: string;
  name: string;
  accountId: string | null;
  guestId: string | null;
  role: "host" | "cohost" | "member" | "guest";
  joinedAt: number;
  state: PeerState;
  inbox: { seq: number; from: string; type: string; gen: number; data: unknown }[];
  nextSeq: number;
  epoch: string;
  seat: string;
  waiter: (() => void) | null;
}
interface Knock {
  id: string;
  token: string;
  code: string;
  accountId: string | null;
  guestId: string | null;
  name: string;
  at: number;
  status: "waiting" | "admitted" | "denied" | "ended";
}
interface FeedItem {
  seq: number;
  kind: "chat" | "reaction" | "notice";
  id: string;
  from: string;
  name: string;
  text: string;
  at: number;
}
interface Room {
  peers: Map<string, Peer>;
  knocks: Map<string, Knock>;
  admitted: Set<string>;
  feed: FeedItem[];
  feedSeq: number;
  version: number;
  locked: boolean;
  startedAt: number;
}
export interface FakeMeeting {
  id: string;
  code: string;
  title: string;
  hostId: string;
  hostName: string;
  scheduledFor: string | null;
  durationMinutes: number;
  access: "open" | "ask";
  guestsAllowed: boolean;
  invitees: string[];
  cohosts: string[];
  createdAt: string;
  removed: string[];
  attended: string[];
}

const LETTERS = "abcdefghjkmnpqrstuvwxyz";
const randomCode = () =>
  Array.from({ length: 9 }, (_, i) => (i === 4 ? "-" : LETTERS[Math.floor(Math.random() * LETTERS.length)])).join("");
const randomHex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");

export function paddockServer() {
  const meetings = new Map<string, FakeMeeting>();
  const rooms = new Map<string, Room>();
  const seats = new Map<string, { code: string; peerId: string }>();
  const gone = new Map<string, "left" | "removed" | "ended">();
  const knocks = new Map<string, Knock>();
  const posts: { path: string; body: any }[] = [];

  const roleOf = (m: FakeMeeting, id: string | null) =>
    !id ? "guest" : m.hostId === id ? "host" : m.cohosts.includes(id) ? "cohost" : m.invitees.includes(id) ? "invited" : "none";
  const roomOf = (code: string) => {
    let r = rooms.get(code);
    if (!r) {
      r = { peers: new Map(), knocks: new Map(), admitted: new Set(), feed: [], feedSeq: 0, version: 1, locked: false, startedAt: Date.now() };
      rooms.set(code, r);
    }
    return r;
  };
  const wake = (p: Peer) => {
    const w = p.waiter;
    p.waiter = null;
    w?.();
  };
  const bump = (r: Room) => {
    r.version++;
    r.peers.forEach(wake);
  };
  const summary = (code: string) => {
    const r = rooms.get(code);
    const peers = r ? [...r.peers.values()] : [];
    const hostPresent = peers.some((p) => p.role === "host" || p.role === "cohost");
    return { count: peers.length, names: peers.slice(0, 4).map((p) => p.name), full: peers.length >= 8, locked: !!r?.locked, hostPresent, startedAt: peers.length ? r!.startedAt : null };
  };
  const out = (m: FakeMeeting, id: string | null) => ({
    id: m.id,
    code: m.code,
    title: m.title,
    hostName: m.hostName,
    scheduledFor: m.scheduledFor,
    durationMinutes: m.durationMinutes,
    access: m.access,
    guestsAllowed: m.guestsAllowed,
    stableId: null,
    stableName: null,
    createdAt: m.createdAt,
    lastLiveAt: null,
    role: roleOf(m, id),
    removed: !!id && m.removed.includes(id),
    lastJoinedAt: id && m.attended.includes(id) ? m.createdAt : null,
    invitees: m.hostId === id ? m.invitees.map((i) => ({ id: i, name: i })) : null,
    live: summary(m.code),
  });
  const direct = (m: FakeMeeting, id: string) =>
    ["host", "cohost", "invited"].includes(roleOf(m, id)) || m.access === "open" || !!rooms.get(m.code)?.admitted.has(id);
  const notice = (r: Room, p: Peer, text: string) => r.feed.push({ seq: ++r.feedSeq, kind: "notice", id: `n${r.feedSeq}`, from: p.id, name: p.name, text, at: Date.now() });

  function join(m: FakeMeeting, peerId: string, who: { accountId: string | null; guestId: string | null; name: string }) {
    const r = roomOf(m.code);
    const existing = r.peers.get(peerId);
    if (existing) return { seat: existing.seat, role: existing.role };
    if (r.peers.size >= 8) return null;
    const role = !who.accountId ? "guest" : who.accountId === m.hostId ? "host" : m.cohosts.includes(who.accountId) ? "cohost" : "member";
    const peer: Peer = {
      id: peerId,
      name: who.name,
      accountId: who.accountId,
      guestId: who.guestId,
      role,
      joinedAt: Date.now(),
      state: { mic: false, cam: false, screen: false, hand: null },
      inbox: [],
      nextSeq: 1,
      epoch: randomHex(8),
      seat: randomHex(64),
      waiter: null,
    };
    if (!r.peers.size) r.startedAt = Date.now();
    r.peers.set(peerId, peer);
    seats.set(peer.seat, { code: m.code, peerId });
    if (who.accountId && !m.attended.includes(who.accountId)) m.attended.push(who.accountId);
    notice(r, peer, `${peer.name} joined`);
    bump(r);
    return { seat: peer.seat, role };
  }
  function drop(r: Room, p: Peer, reason: "left" | "removed" | "ended", text?: string) {
    r.peers.delete(p.id);
    seats.delete(p.seat);
    gone.set(p.seat, reason);
    wake(p);
    if (text) notice(r, p, text);
    bump(r);
  }
  const bySeat = (seat: string | undefined) => {
    const at = seat ? seats.get(seat) : undefined;
    const r = at && rooms.get(at.code);
    const p = r?.peers.get(at!.peerId);
    return r && p ? { r, p, m: meetings.get(at!.code)! } : null;
  };
  const snapshot = (r: Room, p: Peer, m: FakeMeeting, feedSince: number) => ({
    version: r.version,
    now: Date.now(),
    you: { id: p.id, role: p.role, state: p.state, epoch: p.epoch },
    room: { title: m.title, code: m.code, locked: r.locked, startedAt: r.startedAt, guestsAllowed: m.guestsAllowed, maxPeople: 8 },
    peers: [...r.peers.values()].map((x) => ({ id: x.id, name: x.name, role: x.role, guest: !x.accountId, state: x.state, joinedAt: x.joinedAt })),
    signals: p.inbox.slice(0, 200),
    feed: r.feed.filter((f) => f.seq > feedSince && (feedSince > 0 || f.kind === "chat")),
    feedSeq: r.feedSeq,
    knocks: p.role === "host" || p.role === "cohost" ? [...r.knocks.values()].filter((k) => k.status === "waiting").map((k) => ({ id: k.id, name: k.name, guest: !k.accountId, at: k.at })) : [],
  });
  const seatAnswer = (seat: string, peerId: string, role: string, pass?: string) => ({ seat, peerId, role, ...(pass ? { pass } : {}), iceServers: [], relay: false, maxPeople: 8 });

  function addMeeting(fields: Partial<FakeMeeting> & { hostId: string; hostName: string }) {
    const m: FakeMeeting = {
      id: crypto.randomUUID(),
      code: randomCode(),
      title: "Paddock meeting",
      scheduledFor: null,
      durationMinutes: 60,
      access: "ask",
      guestsAllowed: true,
      invitees: [],
      cohosts: [],
      createdAt: new Date().toISOString(),
      removed: [],
      attended: [],
      ...fields,
    };
    meetings.set(m.code, m);
    return m;
  }

  async function handle(route: Route, me: FakeUser | null) {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (data: unknown, status = 200) => route.fulfill({ status, json: data });
    let body: any = undefined;
    try {
      body = method !== "GET" ? req.postDataJSON() : undefined;
    } catch {
      body = undefined;
    }
    if (method !== "GET") posts.push({ path, body });
    if (path === "/api/auth/me") return me ? json({ user: me }) : json({ error: "Sign in to continue." }, 401);
    if (path === "/api/auth/refresh") return json({ error: "Sign in to continue." }, 401);
    if (path === "/api/messages/unread") return json({ personal: 0, requests: 0, team: 0 });
    if (path === "/api/workspaces") return json({ stables: [] });
    if (path === "/api/messages/people/friends") return json({ friends: [], incoming: [], outgoing: [] });

    const liveMatch = path.match(/^\/api\/paddock\/live\/(.+)$/);
    if (liveMatch) {
      const rest = liveMatch[1];
      const seat = req.headers()["x-paddock-seat"] ?? body?.seat;
      const goneAnswer = () => {
        const reason = gone.get(seat) ?? "expired";
        const text = { left: "You left the call.", removed: "The host removed you from this call.", ended: "The host ended the call for everyone.", expired: "Your place timed out." }[reason];
        return json({ code: reason, error: text }, 410);
      };
      if (rest === "sync") {
        let found = bySeat(seat);
        if (!found) return goneAnswer();
        if (body.ack > 0 && (!body.epoch || body.epoch === found.p.epoch)) found.p.inbox = found.p.inbox.filter((s) => s.seq > body.ack);
        if (body.wait > 0 && found.r.version <= body.since && !found.p.inbox.length) {
          const peer = found.p;
          wake(peer);
          await new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, Math.min(body.wait, 1500));
            peer.waiter = () => {
              clearTimeout(timer);
              resolve();
            };
          });
          found = bySeat(seat);
          if (!found) return goneAnswer();
        }
        return json(snapshot(found.r, found.p, found.m, body.feedSince ?? 0));
      }
      if (rest === "leave") {
        const found = bySeat(seat);
        if (found) drop(found.r, found.p, "left", `${found.p.name} left`);
        return route.fulfill({ status: 204 });
      }
      const guestInfo = rest.match(/^guest\/([a-z-]+)$/);
      if (guestInfo) {
        const m = meetings.get(guestInfo[1]);
        if (!m) return json({ code: "not_found", error: "There's no meeting with that code." }, 404);
        const s = summary(m.code);
        return json({
          meeting: { code: m.code, title: m.title, hostName: m.hostName, scheduledFor: m.scheduledFor, durationMinutes: m.durationMinutes, guestsAllowed: m.guestsAllowed },
          live: { count: s.count, full: s.full, locked: s.locked, hostPresent: s.hostPresent },
          maxPeople: 8,
        });
      }
      const guestKnock = rest.match(/^guest\/([a-z-]+)\/knock$/);
      if (guestKnock) {
        const m = meetings.get(guestKnock[1]);
        if (!m) return json({ code: "not_found", error: "There's no meeting with that code." }, 404);
        if (!m.guestsAllowed) return json({ code: "guests_off", error: "This meeting doesn't take guests." }, 403);
        const k: Knock = { id: randomHex(24), token: randomHex(64), code: m.code, accountId: null, guestId: randomHex(24), name: String(body.name).trim(), at: Date.now(), status: "waiting" };
        knocks.set(k.id, k);
        const r = roomOf(m.code);
        r.knocks.set(k.id, k);
        bump(r);
        return json({ knock: { id: k.id, token: k.token } }, 201);
      }
      const knockMatch = rest.match(/^knock\/([a-f0-9]+)(\/join|\/cancel)?$/);
      if (knockMatch) {
        const k = knocks.get(knockMatch[1]);
        if (!k || k.token !== body?.token) return json({ code: "gone", error: "This request to join has expired." }, 404);
        if (knockMatch[2] === "/cancel") {
          rooms.get(k.code)?.knocks.delete(k.id);
          knocks.delete(k.id);
          return route.fulfill({ status: 204 });
        }
        if (knockMatch[2] === "/join") {
          if (k.status !== "admitted") return json({ code: "gone", error: "Not admitted." }, 404);
          const m = meetings.get(k.code)!;
          const joined = join(m, body.peerId, k);
          rooms.get(k.code)?.knocks.delete(k.id);
          knocks.delete(k.id);
          if (!joined) return json({ code: "full", error: "This call is full (8 people)." }, 409);
          return json(seatAnswer(joined.seat, body.peerId, joined.role, "fake-pass"));
        }
        if (k.status === "waiting" && body.wait > 0) await new Promise((resolve) => setTimeout(resolve, 300));
        const r = rooms.get(k.code);
        const hostPresent = !!r && [...r.peers.values()].some((p) => p.role === "host" || p.role === "cohost");
        return json({ status: k.status, hostPresent, title: meetings.get(k.code)?.title ?? "" });
      }
      if (rest === "rejoin") return json({ code: "ask", error: "Ask to join again." }, 403);
      const found = bySeat(seat);
      if (!found) return goneAnswer();
      const { r, p } = found;
      if (rest === "send") {
        if (body.state) {
          const s = body.state;
          p.state = { mic: s.mic ?? p.state.mic, cam: s.cam ?? p.state.cam, screen: s.screen ?? p.state.screen, hand: s.hand === undefined ? p.state.hand : s.hand ? (p.state.hand ?? Date.now()) : null };
          bump(r);
        }
        let delivered = 0;
        for (const s of body.signals ?? []) {
          const target = r.peers.get(s.to);
          if (!target || target === p) continue;
          target.inbox.push({ seq: target.nextSeq++, from: p.id, type: s.type, gen: s.gen, data: s.data ?? null });
          wake(target);
          delivered++;
        }
        return json({ delivered });
      }
      if (rest === "chat") {
        if (!r.feed.some((f) => f.kind === "chat" && f.id === body.id && f.from === p.id))
          r.feed.push({ seq: ++r.feedSeq, kind: "chat", id: body.id, from: p.id, name: p.name, text: String(body.text).trim(), at: Date.now() });
        bump(r);
        return json({ ok: true }, 201);
      }
      if (rest === "react") {
        r.feed.push({ seq: ++r.feedSeq, kind: "reaction", id: `r${r.feedSeq}`, from: p.id, name: p.name, text: body.emoji, at: Date.now() });
        bump(r);
        return json({ ok: true }, 201);
      }
      if (rest === "host") {
        if (p.role !== "host" && p.role !== "cohost") return json({ error: "Only the host and co-hosts can do that." }, 403);
        const target = body.peer ? r.peers.get(body.peer) : undefined;
        const control = (t: Peer, action: string) => {
          t.inbox.push({ seq: t.nextSeq++, from: p.id, type: "control", gen: 0, data: { action } });
          if (action === "mute") t.state = { ...t.state, mic: false };
          if (action === "lower-hand") t.state = { ...t.state, hand: null };
          wake(t);
        };
        switch (body.action) {
          case "admit":
          case "deny": {
            const k = r.knocks.get(body.knock);
            if (!k) return json({ error: "That person stopped waiting." }, 404);
            k.status = body.action === "admit" ? "admitted" : "denied";
            if (k.status === "admitted") r.admitted.add(k.accountId ?? `g:${k.guestId}`);
            else r.knocks.delete(k.id);
            bump(r);
            return json({ ok: true });
          }
          case "mute":
          case "lower-hand":
            if (!target) return json({ error: "Not here." }, 404);
            control(target, body.action);
            bump(r);
            return json({ ok: true });
          case "remove":
            if (!target) return json({ error: "Not here." }, 404);
            if (target.accountId) found.m.removed.push(target.accountId);
            drop(r, target, "removed", `${target.name} was removed`);
            return json({ ok: true });
          case "lock":
            r.locked = !!body.on;
            bump(r);
            return json({ ok: true });
          case "end":
            for (const x of [...r.peers.values()]) drop(r, x, "ended");
            rooms.delete(found.m.code);
            return json({ ok: true });
          default:
            return json({ ok: true });
        }
      }
      return json({});
    }

    if (!me) return json({ error: "Sign in to continue." }, 401);
    if (path === "/api/paddock" && method === "GET")
      return json({ meetings: [...meetings.values()].filter((m) => roleOf(m, me.id) !== "none" || m.attended.includes(me.id)).map((m) => out(m, me.id)), maxPeople: 8 });
    if (path === "/api/paddock" && method === "POST") {
      const m = addMeeting({
        hostId: me.id,
        hostName: me.displayName,
        title: body.title ?? "Paddock meeting",
        scheduledFor: body.scheduledFor ?? null,
        durationMinutes: body.durationMinutes ?? 60,
        access: body.access ?? "ask",
        guestsAllowed: body.guestsAllowed ?? true,
        invitees: body.inviteeIds ?? [],
      });
      return json({ meeting: out(m, me.id) }, 201);
    }
    const memberMatch = path.match(/^\/api\/paddock\/([a-z]{4}-[a-z]{4})(\/join|\/knock)?$/);
    if (memberMatch) {
      const m = meetings.get(memberMatch[1]);
      if (!m) return json({ code: "not_found", error: "There's no meeting with that code. Check the code or link and try again." }, 404);
      if (!memberMatch[2]) {
        if (method === "GET") return json({ meeting: out(m, me.id), canJoin: !m.removed.includes(me.id) && direct(m, me.id), maxPeople: 8 });
        if (method === "DELETE") {
          meetings.delete(m.code);
          return json({ ok: true });
        }
        if (method === "PATCH") {
          Object.assign(m, {
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.access ? { access: body.access } : {}),
            ...(body.guestsAllowed !== undefined ? { guestsAllowed: body.guestsAllowed } : {}),
          });
          return json({ meeting: out(m, me.id) });
        }
      }
      if (m.removed.includes(me.id)) return json({ code: "removed", error: "The host removed you from this meeting, so you can't join again." }, 403);
      if (memberMatch[2] === "/join") {
        if (!direct(m, me.id)) return json({ code: "ask", error: "Ask to join, and the host will let you in." }, 403);
        const r = roomOf(m.code);
        if (r.locked && roleOf(m, me.id) !== "host") return json({ code: "locked", error: "The host locked this meeting." }, 403);
        const joined = join(m, body.peerId, { accountId: me.id, guestId: null, name: me.displayName });
        if (!joined) return json({ code: "full", error: "This call is full (8 people)." }, 409);
        return json(seatAnswer(joined.seat, body.peerId, joined.role));
      }
      if (memberMatch[2] === "/knock") {
        const k: Knock = { id: randomHex(24), token: randomHex(64), code: m.code, accountId: me.id, guestId: null, name: me.displayName, at: Date.now(), status: "waiting" };
        knocks.set(k.id, k);
        const r = roomOf(m.code);
        r.knocks.set(k.id, k);
        bump(r);
        return json({ knock: { id: k.id, token: k.token } }, 201);
      }
    }
    return json({});
  }

  /** Point one page (signed in as `me`, or a guest when null) at this fake server. */
  async function attach(page: Page, me: FakeUser | null) {
    if (me) await page.addInitScript((id) => localStorage.setItem("stayblz.token", `token-${id}`), me.id);
    await page.route("**/api/**", (route) => handle(route, me));
  }
  return { meetings, rooms, posts, attach, addMeeting };
}
