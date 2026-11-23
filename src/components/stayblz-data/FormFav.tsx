import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Empty, Icon, Skeletons } from "../community/ui";
import { dateLabel, isISODate, shiftDate, todayISO } from "../racing/format";
import { DetailShell, DetailState, errorText, useDetail } from "./detail";
import {
  formFav,
  type Meeting,
  type MeetingRace,
  type Meetings,
  type PersonHit,
  type Country,
  type RaceCode,
  type RaceWhere,
  type RunnerHit,
  type StatRow,
  type Zone,
} from "./formfavApi";

/**
 * Stayblz Data → FormFav (?tab=formfav): meetings and race form, model predictions and results, and jockey / trainer /
 * runner / track-bias stats from FormFav, all through our server. Sub-view, day, code and time zone live in the URL.
 */

type View = "meetings" | "stats";
const CODES: { value: RaceCode; key: string; label: string }[] = [
  { value: "gallops", key: "gallops", label: "Thoroughbreds" },
  { value: "harness", key: "harness", label: "Harness" },
  { value: "greyhounds", key: "greyhounds", label: "Greyhounds" },
];
/** FormFav decides which racing falls on a date by the time zone; Stayblz covers North America. */
const ZONES: { value: Zone; key: string; label: string }[] = [
  { value: "America/New_York", key: "ny", label: "New York" },
  { value: "America/Los_Angeles", key: "la", label: "Los Angeles" },
];
const COUNTRIES: { value: Country; key: string; label: string }[] = [
  { value: "us", key: "us", label: "United States" },
  { value: "ca", key: "ca", label: "Canada" },
];
/** Longest day range one search covers (the server's limit too). */
const MAX_SPAN = 7;
const MIN_DAYS = -30;
const MAX_DAYS = 7;

type StatsTarget =
  | { kind: "jockey" | "trainer"; name: string; code?: RaceCode }
  | { kind: "runner"; id: number; name: string }
  | { kind: "track"; slug: string; name: string; code: RaceCode; country: string };

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`);
const n = (v: unknown) => (typeof v === "number" ? v.toLocaleString() : "—");
const text = (v: unknown) => (typeof v === "string" && v ? v : "—");
const label = (v: string | null | undefined) =>
  v
    ? v
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase())
    : "—";
function clock(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function regionName(code: string | null) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames(undefined, { type: "region" }).of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

export default function FormFav({ view }: { view: View }) {
  const [params, setParams] = useSearchParams();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [stats, setStats] = useState<StatsTarget | null>(null);

  useEffect(() => {
    let live = true;
    setStatusError("");
    formFav
      .status()
      .then((s) => live && setEnabled(s.enabled))
      .catch((e) => live && setStatusError(errorText(e, "FormFav couldn't be reached.")));
    return () => {
      live = false;
    };
  }, [attempt]);

  const set = (values: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(values)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  if (statusError)
    return (
      <div className="cm-error" role="alert">
        {statusError}{" "}
        <button type="button" className="cm-link" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </button>
      </div>
    );
  if (enabled === null) return <Skeletons kind="card" count={6} />;
  if (!enabled)
    return (
      <Empty title="FormFav data isn't available right now">
        <p>Check back soon.</p>
      </Empty>
    );

  return (
    <div className="sd-ff">
      {view === "meetings" ? (
        <MeetingsView params={params} set={set} onStats={setStats} />
      ) : (
        <StatsSearch params={params} set={set} onOpen={setStats} />
      )}
      <p className="sd-ff-credit">
        Data:{" "}
        <a href="https://formfav.com" target="_blank" rel="noopener noreferrer">
          FormFav
        </a>
      </p>
      {stats && <StatsDialog target={stats} onClose={() => setStats(null)} />}
    </div>
  );
}

// ── Meetings ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Reads a comma list from the URL, keeping only allowed values (in their usual order); none or nothing valid = all. */
function listParam<T extends string>(raw: string | null, options: { value: T; key: string }[]): T[] {
  const keys = new Set((raw ?? "").split(","));
  const picked = options.filter((o) => keys.has(o.key)).map((o) => o.value);
  return picked.length ? picked : options.map((o) => o.value);
}
/** The URL value for a selection: empty (the default) when everything is picked. */
function listValue<T extends string>(value: T[], options: { value: T; key: string }[]) {
  return value.length === options.length ? "" : options.filter((o) => value.includes(o.value)).map((o) => o.key).join(",");
}

/** A row of on/off buttons where one, several or all can be on (at least one always stays on). */
function Toggles<T extends string>({
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

function MeetingsView({
  params,
  set,
  onStats,
}: {
  params: URLSearchParams;
  set: (values: Record<string, string>) => void;
  onStats: (t: StatsTarget) => void;
}) {
  const today = todayISO();
  const min = shiftDate(today, MIN_DAYS);
  const max = shiftDate(today, MAX_DAYS);
  const inWindow = (v: string | null): v is string => isISODate(v) && v >= min && v <= max;
  const rawFrom = params.get("from");
  const from = inWindow(rawFrom) ? rawFrom : today;
  const lastTo = [max, shiftDate(from, MAX_SPAN - 1)].sort()[0];
  const rawTo = params.get("to");
  const to = inWindow(rawTo) && rawTo >= from && rawTo <= lastTo ? rawTo : from;
  const codes = listParam(params.get("codes"), CODES);
  const zones = listParam(params.get("tz"), ZONES);
  const countries = listParam(params.get("country"), COUNTRIES);
  const [filter, setFilter] = useState("");
  const [data, setData] = useState<Meetings | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<{ meeting: Meeting; race: MeetingRace } | null>(null);
  const multiDay = from !== to;
  const query = `${from}|${to}|${codes}|${zones}|${countries}`;

  useEffect(() => {
    const ctrl = new AbortController();
    setData(null);
    setError("");
    formFav
      .meetings({ from, to, codes, zones, countries }, ctrl.signal)
      .then((m) => !ctrl.signal.aborted && setData(m))
      .catch((e) => !ctrl.signal.aborted && setError(errorText(e, "The meetings couldn't be loaded.")));
    return () => ctrl.abort();
    // `query` stands for from/to/codes/zones/countries (arrays are rebuilt on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, attempt]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (data?.meetings ?? []).filter((m) => !q || (m.track ?? "").toLowerCase().includes(q));
  }, [data, filter]);

  const setFrom = (value: string) => {
    if (!inWindow(value)) return;
    // Keep the range valid: To moves with From when it would end up before it or too far after it.
    const keepTo = to >= value && to <= shiftDate(value, MAX_SPAN - 1);
    set({ from: value === today ? "" : value, to: keepTo && to !== value ? to : "" });
  };
  const setTo = (value: string) => {
    if (!inWindow(value)) return;
    if (value < from) return set({ from: value === today ? "" : value, to: "" });
    set({ to: value === from || value > lastTo ? "" : value });
  };

  return (
    <>
      <div className="cm-toolbar gx-glass sd-ff-toolbar">
        <div className="sd-ff-days">
          <label className="cm-select">
            <span>From</span>
            <input type="date" value={from} min={min} max={max} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="cm-select">
            <span>To</span>
            <input type="date" value={to} min={from} max={lastTo} onChange={(e) => setTo(e.target.value)} />
          </label>
          {multiDay && (
            <button type="button" className="cm-btn cm-btn-sm cm-btn-ghost" onClick={() => set({ to: "" })}>
              Single day
            </button>
          )}
        </div>
        <Toggles label="Code" options={CODES} value={codes} onChange={(v) => set({ codes: listValue(v, CODES) })} />
        <Toggles label="Day by" options={ZONES} value={zones} onChange={(v) => set({ tz: listValue(v, ZONES) })} />
        <Toggles label="Country" options={COUNTRIES} value={countries} onChange={(v) => set({ country: listValue(v, COUNTRIES) })} />
        <label className="cm-search">
          <Icon.Search />
          <input
            type="search"
            value={filter}
            maxLength={60}
            placeholder="Filter tracks"
            aria-label="Filter tracks"
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <div className="cm-error" role="alert">
          {error}{" "}
          <button type="button" className="cm-link" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      ) : !data ? (
        <Skeletons kind="card" count={6} />
      ) : (
        <>
          {data.partial && (
            <p className="cm-error" role="alert">
              Some meetings couldn't be loaded from FormFav, so this list may be incomplete.{" "}
              <button type="button" className="cm-link" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </button>
            </p>
          )}
          {!shown.length ? (
            <Empty title="No meetings match">
              <p>Try other days, codes, countries or time zones.</p>
            </Empty>
          ) : (
            <section className="sd-list" aria-label="Meetings">
              <p className="sd-count" role="status">
                {multiDay ? `${dateLabel(from, "short")} – ${dateLabel(to, "short")}` : dateLabel(from)} · {shown.length}{" "}
                {shown.length === 1 ? "meeting" : "meetings"}
              </p>
              <div className="cm-grid sd-grid sd-ff-grid">
                {shown.map((m) => (
                  <div key={`${m.date}-${m.raceCode}-${m.country}-${m.slug}`}>
                    <MeetingCard meeting={m} showDate={multiDay} onRace={(race) => setOpen({ meeting: m, race })} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {open && open.meeting.slug && open.race.number !== null && (
        <RaceDialog
          where={{
            date: open.meeting.date,
            code: open.meeting.raceCode,
            tz: open.meeting.timezone,
            track: open.meeting.slug,
            race: open.race.number,
            country: open.meeting.country ?? "us",
          }}
          onClose={() => setOpen(null)}
          onStats={(t) => {
            setOpen(null);
            onStats(t);
          }}
        />
      )}
    </>
  );
}

function MeetingCard({ meeting, showDate, onRace }: { meeting: Meeting; showDate: boolean; onRace: (r: MeetingRace) => void }) {
  const [expanded, setExpanded] = useState(false);
  const first = clock(meeting.races.find((r) => r.startTime)?.startTime ?? null);
  const listId = `ff-${meeting.date}-${meeting.raceCode}-${meeting.country}-${meeting.slug}`;
  const code = CODES.find((c) => c.value === meeting.raceCode)?.label;
  return (
    <div className="sd-card sd-ff-meeting gx-glass">
      <button
        type="button"
        className="sd-ff-meeting-head"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((x) => !x)}
      >
        <span className="sd-card-top">
          <span className="sd-track">
            {regionName(meeting.country)}
          </span>
          {(first || showDate) && (
            <span className="sd-time">
              {[showDate ? dateLabel(meeting.date, "short").replace(/,? \d{4}$/, "") : null, first ? `First ${first}` : null]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </span>
        <strong className="sd-title">{meeting.track ?? meeting.slug}</strong>
        <span className="sd-facts">
          {meeting.races.length} {meeting.races.length === 1 ? "race" : "races"}
          {code && ` · ${code}`}
        </span>
        {meeting.abandoned && <span className="sd-pill is-off">Abandoned</span>}
        <span className="sd-ff-chevron" aria-hidden="true">
          <Icon.Right />
        </span>
      </button>
      {expanded && (
        <ul className="sd-ff-races" id={listId}>
          {meeting.races.map((r) => (
            <li key={r.number}>
              <button type="button" onClick={() => onRace(r)} disabled={r.number === null}>
                <span className="sd-ff-rno">R{r.number}</span>
                <span className="sd-ff-rmain">
                  <span>{r.name ?? `Race ${r.number}`}</span>
                  <small>
                    {[clock(r.startTime), r.distance, r.raceClass, r.runners !== null ? `${r.runners} runners` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                {r.abandoned && <span className="sd-pill is-off">Abandoned</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Race ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

type RaceView = "form" | "predictions" | "result";

function RaceDialog({ where, onClose, onStats }: { where: RaceWhere; onClose: () => void; onStats: (t: StatsTarget) => void }) {
  const { data, error, retry } = useDetail(() => formFav.race(where));
  const [view, setView] = useState<RaceView>("form");
  const form = data?.form;
  const person = (kind: "jockey" | "trainer", name: string | null) =>
    name ? (
      <button type="button" className="cm-link" onClick={() => onStats({ kind, name, code: where.code })}>
        {name}
      </button>
    ) : (
      "—"
    );
  return (
    <DetailShell label={form ? `${form.track} race ${form.raceNumber}` : "Race"} onClose={onClose}>
      {!data || !form ? (
        <DetailState error={error} retry={retry} />
      ) : (
        <>
          <header className="sd-detail-head">
            <span className="sd-track">
              {form.track} · Race {form.raceNumber} · {dateLabel(where.date, "short")}
              {clock(form.startTime) && ` · ${clock(form.startTime)}`}
            </span>
            <h2>{form.raceName ?? `Race ${form.raceNumber}`}</h2>
            <p className="sd-facts">
              {[
                form.distance,
                form.raceClass,
                form.condition,
                form.weather,
                form.prizeMoney && /^\d+$/.test(form.prizeMoney)
                  ? `${Number(form.prizeMoney).toLocaleString()} prize money`
                  : form.prizeMoney,
                form.numberOfRunners !== null ? `${form.numberOfRunners} runners` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {form.abandoned && <span className="sd-pill is-off">Abandoned</span>}
            <p className="sd-ff-actions">
              <button
                type="button"
                className="cm-btn cm-btn-sm"
                onClick={() =>
                  onStats({ kind: "track", slug: where.track, name: form.track ?? where.track, code: where.code, country: where.country })
                }
              >
                Track bias
              </button>
            </p>
          </header>

          <nav className="cm-seg" aria-label="Race views">
            <button type="button" aria-pressed={view === "form"} onClick={() => setView("form")}>
              Form
            </button>
            <button type="button" aria-pressed={view === "predictions"} onClick={() => setView("predictions")}>
              Predictions
            </button>
            <button type="button" aria-pressed={view === "result"} onClick={() => setView("result")}>
              Result
            </button>
          </nav>

          {view === "form" && (
            <Table
              head={["#", "Runner", "Bar", "Jockey", "Trainer", "Wt", "Form", "Win", "Place"]}
              rows={form.runners.map((r) => ({
                key: `${r.number}-${r.name}`,
                scratched: r.scratched,
                cells: [
                  r.number ?? "—",
                  <>
                    <strong>{r.name ?? "—"}</strong>
                    {(r.age || r.sex) && <small> {[r.age ? `${r.age}yo` : null, r.sex].filter(Boolean).join(" ")}</small>}
                    {r.badges.length > 0 && (
                      <span className="sd-ff-badges">
                        {r.badges.map((b, i) => (
                          <span key={i} className={`sd-ff-badge${b.sentiment === "-" ? " is-neg" : ""}`} title={b.detail ?? undefined}>
                            {b.label}
                          </span>
                        ))}
                      </span>
                    )}
                  </>,
                  r.barrier ?? "—",
                  person("jockey", r.jockey),
                  person("trainer", r.trainer),
                  r.weight ?? "—",
                  <code>{r.form ?? "—"}</code>,
                  pct(r.stats?.overall?.winPercent),
                  pct(r.stats?.overall?.placePercent),
                ],
              }))}
              empty="No runners listed yet."
            />
          )}

          {view === "predictions" &&
            (data.predictions && data.predictions.runners.length ? (
              <>
                <p className="sd-muted">
                  FormFav model
                  {data.predictions.confidence && ` · ${label(data.predictions.confidence)} confidence`}
                  {data.predictions.predictedAt && ` · predicted ${new Date(data.predictions.predictedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
                </p>
                <Table
                  head={["Rank", "#", "Runner", "Win", "Place"]}
                  rows={[...data.predictions.runners]
                    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                    .map((p) => ({
                      key: `${p.number}-${p.name}`,
                      cells: [
                        p.rank ?? "—",
                        p.number ?? "—",
                        <strong>{p.name ?? "—"}</strong>,
                        <Bar value={p.winProb} />,
                        <Bar value={p.placeProb} />,
                      ],
                    }))}
                />
              </>
            ) : (
              <p className="sd-muted">No predictions for this race. FormFav predicts races with enough data, close to race day.</p>
            ))}

          {view === "result" &&
            (data.results && data.results.placings.length ? (
              <>
                <p className="sd-muted">
                  {label(data.results.status)} result{data.results.revised && " (revised)"}
                </p>
                <Table
                  head={["Fin", "#", "Runner", "Margin", "SP", "Jockey"]}
                  rows={[...data.results.placings]
                    .sort((a, b) => (a.scratched ? 1 : 0) - (b.scratched ? 1 : 0) || (a.position ?? 99) - (b.position ?? 99))
                    .map((p) => ({
                      key: `${p.number}-${p.name}`,
                      scratched: p.scratched,
                      cells: [
                        p.scratched ? "SCR" : (p.position ?? "—"),
                        p.number ?? "—",
                        <strong>{p.name ?? "—"}</strong>,
                        p.margin ?? "—",
                        p.startingPrice !== null ? `$${p.startingPrice.toFixed(2)}` : "—",
                        person("jockey", p.jockey),
                      ],
                    }))}
                />
              </>
            ) : (
              <p className="sd-muted">No result yet.</p>
            ))}
        </>
      )}
    </DetailShell>
  );
}

function Bar({ value }: { value: number | null }) {
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

function Table({
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

// ── Stats search ──────────────────────────────────────────────────────────────────────────────────────────────────────

type Kind = "jockey" | "trainer" | "runner";
const KINDS: { value: Kind; label: string }[] = [
  { value: "jockey", label: "Jockeys" },
  { value: "trainer", label: "Trainers" },
  { value: "runner", label: "Runners" },
];

function StatsSearch({
  params,
  set,
  onOpen,
}: {
  params: URLSearchParams;
  set: (values: Record<string, string>) => void;
  onOpen: (t: StatsTarget) => void;
}) {
  const kind = KINDS.find((k) => k.value === params.get("kind"))?.value ?? "jockey";
  const codes = kind === "runner" ? CODES : CODES.filter((c) => c.value !== "greyhounds");
  const code = (codes.find((c) => c.value === params.get("code"))?.value ?? "gallops") as RaceCode;
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ people?: PersonHit[]; runners?: RunnerHit[] } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    setHits(null);
    setError("");
    if (query.length < 3) return;
    const ctrl = new AbortController();
    const job =
      kind === "runner"
        ? formFav.searchRunners(query, code, ctrl.signal).then((r) => ({ runners: r.results }))
        : formFav.searchPeople(kind, query, code, ctrl.signal).then((r) => ({ people: r.results }));
    job
      .then((h) => !ctrl.signal.aborted && setHits(h))
      .catch((e) => !ctrl.signal.aborted && setError(errorText(e, "The search couldn't be finished.")));
    return () => ctrl.abort();
  }, [query, kind, code, attempt]);

  const count = hits ? (hits.people?.length ?? hits.runners?.length ?? 0) : 0;
  return (
    <>
      <div className="cm-toolbar gx-glass sd-ff-toolbar">
        <nav className="cm-seg" aria-label="Stats for">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              aria-pressed={kind === k.value}
              onClick={() => set({ kind: k.value === "jockey" ? "" : k.value })}
            >
              {k.label}
            </button>
          ))}
        </nav>
        <label className="cm-select">
          <span>Code</span>
          <select value={code} onChange={(e) => set({ code: e.target.value === "gallops" ? "" : e.target.value })}>
            {codes.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="cm-search">
          <Icon.Search />
          <input
            type="search"
            value={q}
            maxLength={100}
            placeholder={`Search ${KINDS.find((k) => k.value === kind)!.label.toLowerCase()} by name`}
            aria-label={`Search ${kind}s`}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      {query.length < 3 ? (
        <Empty title="Search FormFav stats">
          <p>Type at least 3 letters of a name.</p>
        </Empty>
      ) : error ? (
        <div className="cm-error" role="alert">
          {error}{" "}
          <button type="button" className="cm-link" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      ) : !hits ? (
        <Skeletons kind="card" count={4} />
      ) : !count ? (
        <Empty title="No matches">
          <p>Try another spelling.</p>
        </Empty>
      ) : (
        <section className="sd-list" aria-label="Search results">
          <p className="sd-count" role="status">
            {count} {count === 1 ? "match" : "matches"}
          </p>
          <div className="cm-grid sd-grid">
            {hits.people?.map((p, i) =>
              p.name ? (
                <div key={`${p.name}-${i}`}>
                  <button
                    type="button"
                    className="sd-card gx-glass"
                    onClick={() => onOpen({ kind: kind as "jockey" | "trainer", name: p.name!, code })}
                  >
                    <span className="sd-track">{kind}</span>
                    <strong className="sd-title">{p.name}</strong>
                    <span className="sd-facts">{n(p.totalStarts)} starts</span>
                    {p.ambiguous && <span className="sd-pill">Shared name: stats may mix people</span>}
                  </button>
                </div>
              ) : null,
            )}
            {hits.runners?.map((r) =>
              r.id !== null && r.name ? (
                <div key={r.id}>
                  <button type="button" className="sd-card gx-glass" onClick={() => onOpen({ kind: "runner", id: r.id!, name: r.name! })}>
                    <span className="sd-card-top">
                      <span className="sd-track">{r.country ?? "Runner"}</span>
                      {r.lastRaceDate && <span className="sd-time">Last {dateLabel(r.lastRaceDate, "short")}</span>}
                    </span>
                    <strong className="sd-title">{r.name}</strong>
                    <span className="sd-facts">
                      {[r.sire && r.dam ? `${r.sire} × ${r.dam}` : r.sire, r.totalStarts !== null ? `${r.totalStarts} starts` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                </div>
              ) : null,
            )}
          </div>
        </section>
      )}
    </>
  );
}

// ── Stats dialog ──────────────────────────────────────────────────────────────────────────────────────────────────────

function StatsDialog({ target, onClose }: { target: StatsTarget; onClose: () => void }) {
  const key = target.kind === "runner" ? `r${target.id}` : target.kind === "track" ? `t${target.slug}` : `${target.kind}${target.name}`;
  return (
    <DetailShell label={target.name} onClose={onClose}>
      {target.kind === "runner" ? (
        <RunnerStatsView key={key} id={target.id} />
      ) : target.kind === "track" ? (
        <TrackBiasView key={key} target={target} />
      ) : (
        <PersonStatsView key={key} target={target} />
      )}
    </DetailShell>
  );
}

const rateCols = (r: StatRow) => [n(r.totalStarts), n(r.wins), pct(r.winRate as number | null), pct(r.placeRate as number | null)];

function PersonStatsView({ target }: { target: { kind: "jockey" | "trainer"; name: string; code?: RaceCode } }) {
  const { data, error, retry } = useDetail(() =>
    formFav.person(target.kind, target.name, target.code === "greyhounds" ? undefined : target.code),
  );
  if (!data) return <DetailState error={error} retry={retry} />;
  return (
    <>
      <header className="sd-detail-head">
        <span className="sd-track">{target.kind}</span>
        <h2>{data.name ?? target.name}</h2>
        <p className="sd-facts">
          {n(data.totalStarts)} starts · {n(data.totalWins)} wins · {pct(data.winRate)} win · {pct(data.placeRate)} place
        </p>
        {(data.bestCondition || data.worstCondition) && (
          <p className="sd-facts">
            Best on {text(data.bestCondition)} · weakest on {text(data.worstCondition)}
          </p>
        )}
        {data.ambiguous && <span className="sd-pill">Shared name: these stats may mix people</span>}
      </header>
      <h3>Tracks</h3>
      <Table
        head={["Track", "Starts", "Wins", "Win", "Place"]}
        rows={(data.tracks ?? []).map((r, i) => ({ key: `${r.venue}-${i}`, cells: [text(r.venue), ...rateCols(r)] }))}
        empty="Not enough data."
      />
      {data.conditions && data.conditions.length > 0 && (
        <>
          <h3>Track conditions</h3>
          <Table
            head={["Condition", "Starts", "Wins", "Win", "Place"]}
            rows={data.conditions.map((r, i) => ({ key: `${r.condition}-${i}`, cells: [text(r.condition), ...rateCols(r)] }))}
          />
        </>
      )}
    </>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
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

function RunnerStatsView({ id }: { id: number }) {
  const { data, error, retry } = useDetail(() => formFav.runner(id));
  if (!data) return <DetailState error={error} retry={retry} />;
  const r = data.runner ?? {};
  const c = data.career ?? {};
  return (
    <>
      <header className="sd-detail-head">
        <span className="sd-track">Runner{typeof r.country === "string" ? ` · ${r.country}` : ""}</span>
        <h2>{text(r.name)}</h2>
        <p className="sd-facts">
          {[
            typeof r.age === "number" ? `${r.age}yo` : null,
            typeof r.sex === "string" ? label(r.sex) : null,
            typeof r.sire === "string" ? `${r.sire} × ${text(r.dam)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="sd-facts">
          {n(c.totalStarts)} starts · {n(c.wins)}-{n(c.seconds)}-{n(c.thirds)} · {pct(c.winRate as number | null)} win ·{" "}
          {pct(c.placeRate as number | null)} place
          {typeof r.lastRaceDate === "string" && ` · last start ${dateLabel(r.lastRaceDate, "short")}`}
        </p>
      </header>
      <Facts
        items={[
          ["Form trend", data.formTrend ? label(data.formTrend.trendDirection as string) : null],
          ["Last 5 win rate", data.formTrend ? pct(data.formTrend.last5WinRate as number | null) : null],
          ["Class rating", data.classProfile ? `${n(data.classProfile.currentRating)} (peak ${n(data.classProfile.peakRating)})` : null],
          ["Class trend", data.classProfile ? label(data.classProfile.trend as string) : null],
          ["Running style", data.runningStyle ? label(data.runningStyle.finishingStyle as string) : null],
          ["Gate speed", data.runningStyle ? label(data.runningStyle.gateSpeed as string) : null],
          ["Trials", data.trialForm ? `${n(data.trialForm.totalTrials)} (${n(data.trialForm.trialWins)} won)` : null],
        ]}
      />
      <h3>Distances</h3>
      <Table
        head={["Distance", "Starts", "Wins", "Win", "Place"]}
        rows={(data.distances ?? []).map((d, i) => ({
          key: `${d.distanceMeters}-${i}`,
          cells: [typeof d.distanceMeters === "number" ? `${d.distanceMeters}m` : "—", ...rateCols(d)],
        }))}
        empty="Not enough data."
      />
      {data.venues && data.venues.length > 0 && (
        <>
          <h3>Tracks</h3>
          <Table
            head={["Track", "Starts", "Wins", "Win", "Place"]}
            rows={data.venues.map((v, i) => ({ key: `${v.venue}-${i}`, cells: [text(v.venue), ...rateCols(v)] }))}
          />
        </>
      )}
      {data.conditions && data.conditions.length > 0 && (
        <>
          <h3>Track conditions</h3>
          <Table
            head={["Condition", "Starts", "Wins", "Win", "Place"]}
            rows={data.conditions.map((v, i) => ({ key: `${v.condition}-${i}`, cells: [label(v.condition as string), ...rateCols(v)] }))}
          />
        </>
      )}
      {data.jockeys && data.jockeys.length > 0 && (
        <>
          <h3>Jockeys</h3>
          <Table
            head={["Jockey", "Starts", "Wins", "Win", "Place"]}
            rows={data.jockeys.map((v, i) => ({ key: `${v.jockeyName}-${i}`, cells: [text(v.jockeyName), ...rateCols(v)] }))}
          />
        </>
      )}
      {data.sire && (
        <>
          <h3>Sire</h3>
          <Facts
            items={[
              ["Sire", text(data.sire.sireName)],
              ["Progeny", n(data.sire.totalProgeny)],
              ["Progeny win rate", pct(data.sire.winRate as number | null)],
              ["Best distance", text(data.sire.bestDistanceCategory)],
              ["Debut win rate", pct(data.sire.debutWinRate as number | null)],
            ]}
          />
        </>
      )}
    </>
  );
}

function TrackBiasView({ target }: { target: { slug: string; name: string; code: RaceCode; country: string } }) {
  const { data, error, retry } = useDetail(() => formFav.trackBias(target.slug, target.code, target.country));
  if (!data) return <DetailState error={error} retry={retry} />;
  const pp = (v: unknown) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)} pts` : "—");
  return (
    <>
      <header className="sd-detail-head">
        <span className="sd-track">Track bias</span>
        <h2>{data.venue ?? target.name}</h2>
        <p className="sd-facts">
          {n(data.totalRaces)} races · expected win rate {pct(data.expectedWinRate)} · bias {label(data.biasStrength)}
        </p>
        <p className="sd-facts">
          Strongest barrier {data.strongestBarrier ?? "—"} · weakest {data.weakestBarrier ?? "—"}
        </p>
      </header>
      <h3>Barriers</h3>
      <Table
        head={["Barrier", "Starts", "Wins", "Win", "Place", "Edge"]}
        rows={(data.barriers ?? []).map((b, i) => ({
          key: `${b.barrierNumber}-${i}`,
          cells: [n(b.barrierNumber), ...rateCols(b), pp(b.advantage)],
        }))}
        empty="Not enough data."
      />
      {data.distances.length > 0 && (
        <>
          <h3>By distance</h3>
          <Table
            head={["Distance", "Races", "Strongest", "Weakest", "Bias"]}
            rows={data.distances.map((d, i) => ({
              key: `${d.category}-${i}`,
              cells: [
                `${text(d.category)}${d.minDistance !== null ? ` (${d.minDistance}–${d.maxDistance ?? ""}m)` : ""}`,
                n(d.totalRaces),
                d.strongestBarrier ?? "—",
                d.weakestBarrier ?? "—",
                label(d.biasStrength),
              ],
            }))}
          />
        </>
      )}
    </>
  );
}
