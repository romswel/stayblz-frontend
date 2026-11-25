import { api } from "../../api";

/** Scheduled updates (backend routes/chatSchedule.ts). Only a few accounts can use it; the rest get "not found". */
export type ScheduleChatKind = "personal" | "team";
export interface ScheduleTarget {
  kind: ScheduleChatKind;
  id: string;
  stableId: string | null;
}
export interface ScheduledNote {
  slot: 1 | 2 | 3;
  body: string;
  enabled: boolean;
  /** "HH:MM", Philippine time. */
  sendAt: string;
  chat: ScheduleTarget | null;
  keepAfterSend: boolean;
  /** The next time it goes out (ISO). */
  nextAt: string;
  /** "Skip next" is on for this time (ISO), or null. */
  skippingAt: string | null;
  updatedAt: string | null;
}
export interface ScheduleChat extends ScheduleTarget {
  title: string;
  group: boolean;
  stableName: string | null;
}
export interface ScheduleLogEntry {
  id: string;
  slot: number;
  /** The scheduled time, or null for "Send now". */
  dueAt: string | null;
  status: "sent" | "empty" | "missed" | "failed";
  chat: ScheduleTarget | null;
  preview: string | null;
  detail: string | null;
  at: string;
}
export interface ScheduleState {
  zone: string;
  lateMinutes: number;
  now: string;
  notes: ScheduledNote[];
  chats: ScheduleChat[];
  chatsError?: boolean;
  history: ScheduleLogEntry[];
}
export type NoteChange = Partial<Pick<ScheduledNote, "body" | "enabled" | "sendAt" | "keepAfterSend">> & {
  chat?: ScheduleTarget | null;
};

const base = "/api/messages/scheduled";
export const scheduleApi = {
  load: (signal?: AbortSignal) => api.get<ScheduleState>(base, { signal }),
  save: (slot: number, change: NoteChange) => api.put<{ note: ScheduledNote }>(`${base}/${slot}`, change),
  skip: (slot: number, skip: boolean) => api.post<{ note: ScheduledNote }>(`${base}/${slot}/skip`, { skip }),
  sendNow: (slot: number) => api.post<{ note: ScheduledNote; entry: ScheduleLogEntry | null }>(`${base}/${slot}/send`, {}),
};

export const sameTarget = (a: ScheduleTarget | null | undefined, b: ScheduleTarget | null | undefined) =>
  !!a && !!b && a.kind === b.kind && a.id === b.id && (a.kind === "personal" || a.stableId === b.stableId);
export const targetKey = (t: ScheduleTarget) => `${t.kind}:${t.stableId ?? ""}:${t.id}`;

/** "21:00" → "9:00 PM". */
export function clockLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
const PH = "Asia/Manila";
export const inPh = (iso: string, withDay = true) =>
  new Date(iso).toLocaleString([], {
    timeZone: PH,
    ...(withDay ? { weekday: "short", month: "short", day: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
export const localTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
/** The viewer isn't on Philippine time (show their own time too). */
export function awayFromPh() {
  try {
    const offset = (zone?: string) => {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", hourCycle: "h23", minute: "numeric", day: "numeric" }).formatToParts(new Date());
      return parts.map((p) => p.value).join("");
    };
    return offset(PH) !== offset(undefined);
  } catch {
    return false;
  }
}
/** "in 3 h 12 min", "in 4 min", "now". */
export function untilText(iso: string, now = Date.now()) {
  const mins = Math.round((Date.parse(iso) - now) / 60_000);
  if (mins <= 0) return "any moment now";
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `in ${h} h${m ? ` ${m} min` : ""}`;
}
