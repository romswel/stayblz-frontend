import type { ReactNode } from "react";
import type { Country, PersonRow, RaceCode, StatRow, Zone } from "./formfavApi";

/** Shared pieces of Stayblz Data → FormFav: filter options, formatting, on/off toggles and small tables. */

export const CODES: { value: RaceCode; key: string; label: string }[] = [
  { value: "gallops", key: "gallops", label: "Thoroughbreds" },
  { value: "harness", key: "harness", label: "Harness" },
  { value: "greyhounds", key: "greyhounds", label: "Greyhounds" },
];
/** FormFav decides which racing falls on a date by the time zone; Stayblz covers North America. */
export const ZONES: { value: Zone; key: string; label: string }[] = [
  { value: "America/New_York", key: "ny", label: "New York" },
  { value: "America/Los_Angeles", key: "la", label: "Los Angeles" },
];
export const COUNTRIES: { value: Country; key: string; label: string }[] = [
  { value: "us", key: "us", label: "United States" },
  { value: "ca", key: "ca", label: "Canada" },
];
/** Longest day range one search covers (the server's limit too). */
export const MAX_SPAN = 7;
export const MIN_DAYS = -30;
export const MAX_DAYS = 7;

export type StatsTarget =
  | { kind: "jockey" | "trainer"; name: string; code?: RaceCode; summary?: PersonRow }
  | { kind: "runner"; id: number; name: string }
  | { kind: "track"; slug: string; name: string; code: RaceCode; country: string };

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`);
export const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString() : "—");
export const text = (v: unknown) => (typeof v === "string" && v ? v : "—");
export const label = (v: string | null | undefined) =>
  v
    ? v
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())
    : "—";
export function clock(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
export function regionName(code: string | null) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export function listParam<T extends string>(raw: string | null, options: { value: T; key: string }[]): T[] {
  const keys = new Set((raw ?? "").split(","));
  const picked = options.filter((o) => keys.has(o.key)).map((o) => o.value);
  return picked.length ? picked : options.map((o) => o.value);
}
/** The URL value for a selection: empty (the default) when everything is picked. */
export function listValue<T extends string>(value: T[], options: { value: T; key: string }[]) {
  return value.length === options.length ? "" : options.filter((o) => value.includes(o.value)).map((o) => o.key).join(",");
}

/** A row of on/off buttons where one, several or all can be on (at least one always stays on). */
export function Toggles<T extends string>({
  label: name,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  return (
    <div className="sd-ff-filter" role="group" aria-label={name}>
      <span className="sd-ff-filter-label" aria-hidden="true">
        {name}
      </span>
      <div className="cm-seg">
        {options.map((o) => {
          const on = value.includes(o.value);
          const last = on && value.length === 1;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              title={last ? "At least one stays selected" : undefined}
              onClick={() => {
                if (last) return;
                onChange(options.map((x) => x.value).filter((v) => (v === o.value ? !on : value.includes(v))));
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


export function Bar({ value }: { value: number | null }) {
  const w = Math.max(0, Math.min(1, value ?? 0)) * 100;
  return (
    <span className="sd-ff-bar">
      <span className="sd-ff-bar-track" aria-hidden="true">
        <span style={{ width: `${w}%` }} />
      </span>
      {pct(value)}
    </span>
  );
}

export function Table({
  head,
  rows,
  empty = "Nothing to show.",
}: {
  head: string[];
  rows: { key: string; cells: ReactNode[]; scratched?: boolean }[];
  empty?: string;
}) {
  if (!rows.length) return <p className="sd-muted">{empty}</p>;
  return (
    <div className="sd-table-wrap">
      <table className="sd-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.scratched ? "is-scratched" : undefined}>
              {r.cells.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


export function Facts({ items }: { items: [string, ReactNode][] }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== "—");
  if (!shown.length) return null;
  return (
    <dl className="sd-ff-facts">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}


export const rateCols = (r: StatRow) => [n(r.totalStarts), n(r.wins), pct(r.winRate as number | null), pct(r.placeRate as number | null)];
