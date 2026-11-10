import type { Race, Surface } from "./types";

export const surfaceLabels: Record<Surface, string> = {
  dirt: "Dirt",
  turf: "Turf",
  synthetic: "Synthetic",
  all_weather: "All weather",
};
export const raceTypeLabels: Record<string, string> = {
  maiden: "Maiden",
  maiden_claiming: "Maiden claiming",
  claiming: "Claiming",
  allowance: "Allowance",
  optional_claiming: "Optional claiming",
  starter: "Starter",
  stakes: "Stakes",
  handicap: "Handicap",
  trial: "Trial",
  other: "Race",
};
export const breedLabels: Record<string, string> = {
  thoroughbred: "Thoroughbred",
  harness: "Harness",
  quarter_horse: "Quarter Horse",
};
export const conditionLabels: Record<string, string> = {
  "": "Not reported",
  fast: "Fast",
  good: "Good",
  firm: "Firm",
  yielding: "Yielding",
  soft: "Soft",
  sloppy: "Sloppy",
  muddy: "Muddy",
  sealed: "Sealed",
  heavy: "Heavy",
  wet_fast: "Wet fast",
  standard: "Standard",
};

/** Today in the visitor's own time zone, as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
export function shiftDate(iso: string, days: number) {
  const date = new Date(iso + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export const isISODate = (value: string | null): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + "T12:00:00Z"));

export function dateLabel(iso: string, style: "long" | "short" = "long") {
  return new Date(iso + "T12:00:00Z").toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
  });
}
export function money(amount: number | null | undefined, currency = "USD") {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}
export const payout = (amount: number) => amount.toFixed(2);
export const odds = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : `${Number(value.toFixed(2))}-1`;
export const ordinal = (n: number | null | undefined) => {
  if (!n) return "—";
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
};
export function raceTitle(race: Pick<Race, "number" | "name">) {
  return race.name ? `Race ${race.number} · ${race.name}` : `Race ${race.number}`;
}
export function raceFacts(race: Race) {
  return [
    race.grade ? `Grade ${race.grade}` : raceTypeLabels[race.type] ?? "Race",
    race.distance,
    surfaceLabels[race.surface],
    race.purse !== null ? `Purse ${money(race.purse, race.currency)}` : "",
  ].filter(Boolean);
}
export const winPct = (wins: number, starts: number) => (starts ? `${Math.round((100 * wins) / starts)}%` : "—");
