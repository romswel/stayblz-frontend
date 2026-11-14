import { api, API_BASE, ApiError, friendly } from "../../api";

export type Access = "open" | "ask";
export type MeetingRole = "host" | "cohost" | "invited" | "team" | "none" | "guest";
export type PeerRole = "host" | "cohost" | "member" | "guest";

export interface LiveSummary {
  count: number;
  names?: string[];
  full: boolean;
  locked: boolean;
  hostPresent: boolean;
  startedAt?: number | null;
}
export interface Meeting {
  id: string;
  code: string;
  title: string;
  hostName: string;
  scheduledFor: string | null;
  durationMinutes: number;
  access: Access;
  guestsAllowed: boolean;
  stableId: string | null;
  stableName: string | null;
  createdAt: string;
  lastLiveAt: string | null;
  role: MeetingRole;
  removed: boolean;
  lastJoinedAt: string | null;
  /** Host only: who is invited. */
  invitees: { id: string; name: string }[] | null;
  live: LiveSummary;
}
export interface GuestMeeting {
  code: string;
  title: string;
  hostName: string;
  scheduledFor: string | null;
  durationMinutes: number;
  guestsAllowed: boolean;
}
export interface MeetingForm {
  title?: string;
  scheduledFor?: string | null;
  durationMinutes?: number;
  access?: Access;
  guestsAllowed?: boolean;
  stableId?: string | null;
  inviteeIds?: string[];
}
export interface JoinAnswer {
  seat: string;
  peerId: string;
  role: PeerRole;
  pass?: string;
  iceServers: RTCIceServer[];
  relay: boolean;
  maxPeople: number;
}

// ————— In-call wire format (backend lib/paddockRooms.ts) —————
export interface PeerState {
  mic: boolean;
  cam: boolean;
  screen: boolean;
  hand: number | null;
}
export interface WirePeer {
  id: string;
  name: string;
  role: PeerRole;
  guest: boolean;
  state: PeerState;
  joinedAt: number;
}
export interface WireSignal {
  seq: number;
  from: string;
  type: string;
  gen: number;
  data: unknown;
}
export interface FeedItem {
  seq: number;
  kind: "chat" | "reaction" | "notice";
  id: string;
  from: string;
  name: string;
  text: string;
  at: number;
}
export interface Knock {
  id: string;
  name: string;
  guest: boolean;
  at: number;
}
export interface Snapshot {
  version: number;
  now: number;
  you: { id: string; role: PeerRole; state: PeerState; epoch: string };
  room: { title: string; code: string; locked: boolean; startedAt: number; guestsAllowed: boolean; maxPeople: number };
  peers: WirePeer[];
  signals: WireSignal[];
  feed: FeedItem[];
  feedSeq: number;
  knocks: Knock[];
}
export type GoneReason = "left" | "removed" | "ended" | "expired";
/** Sent when joining, so others see the right mic/camera straight away. */
export interface JoinState {
  mic: boolean;
  cam: boolean;
  screen?: boolean;
  hand?: boolean;
}

// ————— Signed-in meeting routes —————
export const paddockApi = {
  home: (signal?: AbortSignal) => api.get<{ meetings: Meeting[]; maxPeople: number }>("/api/paddock", { signal }),
  create: (form: MeetingForm) => api.post<{ meeting: Meeting }>("/api/paddock", form),
  get: (code: string, signal?: AbortSignal) =>
    api.get<{ meeting: Meeting; canJoin: boolean; maxPeople: number }>(`/api/paddock/${code}`, { signal }),
  update: (code: string, form: MeetingForm) => api.patch<{ meeting: Meeting }>(`/api/paddock/${code}`, form),
  remove: (code: string) => api.delete<{ ok: true }>(`/api/paddock/${code}`),
  join: (code: string, peerId: string, replaces?: string, state?: JoinState) =>
    api.post<JoinAnswer>(`/api/paddock/${code}/join`, { peerId, ...(replaces ? { replaces } : {}), ...(state ? { state } : {}) }),
  knock: (code: string) => api.post<{ knock: { id: string; token: string } }>(`/api/paddock/${code}/knock`, {}),
};

// ————— In-call and guest routes: light requests, no cookies, no "slow connection" banner —————
export interface LiveAnswer<T> {
  status: number;
  data: T;
}
/** POST to /api/paddock/live/*. Network trouble comes back as status 0, never a throw (except abort). */
export async function live<T>(
  path: string,
  body: unknown,
  { seat, signal, method = "POST" }: { seat?: string; signal?: AbortSignal; method?: "GET" | "POST" } = {},
): Promise<LiveAnswer<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/paddock/live${path}`, {
      method,
      credentials: "omit",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(seat ? { "X-Paddock-Seat": seat } : {}) },
      ...(method === "POST" ? { body: JSON.stringify(body ?? {}) } : {}),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: 0, data: { error: friendly.network } as T };
  }
  let data: unknown = null;
  if (response.status !== 204) {
    try {
      data = await response.json();
    } catch {
      data = { error: [502, 503, 504].includes(response.status) ? friendly.starting : friendly.server };
    }
  }
  return { status: response.status, data: data as T };
}

export const errorText = (answer: LiveAnswer<unknown>, fallback = friendly.server) => {
  const data = answer.data as { error?: unknown } | null;
  return typeof data?.error === "string" ? data.error : fallback;
};
export const errorCode = (answer: LiveAnswer<unknown>) => {
  const data = answer.data as { code?: unknown } | null;
  return typeof data?.code === "string" ? data.code : "";
};
/** Turn a live answer into data or a friendly ApiError. */
export function must<T>(answer: LiveAnswer<T>): T {
  if (answer.status >= 200 && answer.status < 300) return answer.data;
  throw new ApiError(answer.status, errorText(answer), errorCode(answer) || undefined);
}

export const guestApi = {
  info: async (code: string, signal?: AbortSignal) =>
    must(await live<{ meeting: GuestMeeting; live: LiveSummary; maxPeople: number }>(`/guest/${code}`, null, { method: "GET", signal })),
  knock: async (code: string, name: string) => must(await live<{ knock: { id: string; token: string } }>(`/guest/${code}/knock`, { name })),
};
export const knockApi = {
  status: (id: string, token: string, wait: number, signal?: AbortSignal) =>
    live<{ status: "waiting" | "admitted" | "denied" | "ended" | "full"; hostPresent: boolean; title: string }>(
      `/knock/${id}`,
      { token, wait },
      { signal },
    ),
  join: async (id: string, token: string, peerId: string, state?: JoinState) =>
    must(await live<JoinAnswer>(`/knock/${id}/join`, { token, peerId, state })),
  cancel: (id: string, token: string) => live(`/knock/${id}/cancel`, { token }),
  rejoin: (pass: string, peerId: string, replaces?: string, state?: JoinState) => live<JoinAnswer>("/rejoin", { pass, peerId, replaces, state }),
};

/** "Leave" as the page closes: a beacon still reaches the server. */
export function leaveBeacon(seat: string) {
  try {
    const blob = new Blob([JSON.stringify({ seat })], { type: "application/json" });
    if (navigator.sendBeacon?.(`${API_BASE}/api/paddock/live/leave`, blob)) return;
  } catch {
    /* Fall through. */
  }
  void fetch(`${API_BASE}/api/paddock/live/leave`, {
    method: "POST",
    keepalive: true,
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seat }),
  }).catch(() => undefined);
}
