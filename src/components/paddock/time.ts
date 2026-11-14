/** Dates and times for meetings, in the viewer's own time zone. */
const time = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function dayWord(d: Date, now = new Date()) {
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

/** "Today at 3:00 PM – 3:45 PM", "Starts in 10 minutes", or "" for a start-now meeting. */
export function meetingTime(scheduledFor: string | null, minutes: number, liveNow = false) {
  if (!scheduledFor) return "";
  const start = new Date(scheduledFor);
  if (!Number.isFinite(start.getTime())) return "";
  const end = new Date(start.getTime() + minutes * 60_000);
  const untilStart = start.getTime() - Date.now();
  if (!liveNow && untilStart > 0 && untilStart < 60 * 60_000) {
    const m = Math.max(1, Math.round(untilStart / 60_000));
    return `Starts in ${m} minute${m === 1 ? "" : "s"} (${time(start)})`;
  }
  return `${dayWord(start)} at ${time(start)} – ${time(end)}`;
}

/** Badge parts for a list row: "NOV" / "18". */
export function dateBadge(iso: string) {
  const d = new Date(iso);
  return { month: d.toLocaleDateString([], { month: "short" }).toUpperCase(), day: String(d.getDate()) };
}

/** Upcoming = scheduled and not yet over (with a little grace). */
export function isUpcoming(scheduledFor: string | null, minutes: number, now = Date.now()) {
  if (!scheduledFor) return false;
  const start = Date.parse(scheduledFor);
  return Number.isFinite(start) && start + minutes * 60_000 + 15 * 60_000 > now;
}

export function ago(iso: string | null, now = Date.now()) {
  if (!iso) return "";
  const ms = Date.parse(iso.replace(/(\.\d{3})\d+/, "$1"));
  if (!Number.isFinite(ms)) return "";
  const minutes = Math.round((now - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const d = new Date(ms);
  return `${dayWord(d)} at ${time(d)}`;
}

/** Local date + time inputs → an ISO instant. */
export function fromInputs(date: string, clock: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(clock)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = clock.split(":").map(Number);
  const at = new Date(y, m - 1, d, h, min);
  return Number.isFinite(at.getTime()) ? at.toISOString() : null;
}
export function toInputs(iso: string | null) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60_000);
  if (!iso) d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, clock: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}
export const timeZoneName = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ");
  } catch {
    return "your time zone";
  }
};
