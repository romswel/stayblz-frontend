import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api";
import SectionNav from "../SectionNav";
import { conditionLabels, odds, ordinal, payout, raceFacts, raceTitle, shiftDate, dateLabel, todayISO } from "./format";
import type { Race, Runner } from "./types";
import "./racing.css";

export const racingLinks = [
  { to: "/dashboard", label: "Overview" },
  { to: "/entries", label: "Entries" },
  { to: "/results", label: "Results" },
  { to: "/workouts", label: "Workouts" },
  { to: "/stakes", label: "Stakes" },
  { to: "/statistics", label: "Leaders" },
  { to: "/pps", label: "PPs" },
];

export function RacingHead({ eyebrow, title, sub, actions }: { eyebrow: string; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <>
      <header className="page-head rc-head">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
          {sub && <p className="sub">{sub}</p>}
        </div>
        {actions && <div className="rc-head-actions">{actions}</div>}
      </header>
      <SectionNav label="Racing pages" links={racingLinks} />
    </>
  );
}

type LoadState<T> = { data: T | null; loading: boolean; error: string; missing: boolean };
/**
 * Loads one API path. Keeps the last good data visible while reloading, ignores late
 * replies after the path changed, and separates "not published" (404) from errors.
 */
export function useRacing<T>(path: string | null) {
  const [state, setState] = useState<LoadState<T>>({ data: null, loading: !!path, error: "", missing: false });
  const [attempt, setAttempt] = useState(0);
  const current = useRef(path);
  useEffect(() => {
    current.current = path;
    if (!path) return;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "", missing: false }));
    api
      .get<T>(path, { signal: controller.signal })
      .then((data) => {
        if (current.current === path) setState({ data, loading: false, error: "", missing: false });
      })
      .catch((reason) => {
        if (controller.signal.aborted || current.current !== path) return;
        if (reason instanceof ApiError && reason.status === 404)
          setState({ data: null, loading: false, error: "", missing: true });
        else
          setState((s) => ({
            ...s,
            loading: false,
            error: reason instanceof Error ? reason.message : "Racing data could not be loaded.",
          }));
      });
    return () => controller.abort();
  }, [path, attempt]);
  return { ...state, retry: useCallback(() => setAttempt((n) => n + 1), []) };
}

export function LoadNotice({ loading, error, retry, label = "Loading racing data…" }: { loading: boolean; error: string; retry: () => void; label?: string }) {
  if (error)
    return (
      <div className="form-error rc-error" role="alert">
        {error}{" "}
        <button type="button" className="btn btn-quiet" onClick={retry}>
          Try again
        </button>
      </div>
    );
  if (loading)
    return (
      <div className="rc-skeleton" aria-busy="true">
        <p className="sr-only" role="status">
          {label}
        </p>
        <span />
        <span />
        <span />
      </div>
    );
  return null;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rc-empty">
      <span aria-hidden="true">✦</span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Previous/next day buttons plus a date picker. Dates with racing are highlighted in the strip. */
export function DateNav({ date, onChange, racingDates }: { date: string; onChange: (date: string) => void; racingDates?: Set<string> }) {
  const strip = Array.from({ length: 7 }, (_, i) => shiftDate(date, i - 3));
  return (
    <div className="rc-datenav">
      <button type="button" className="rc-day-step" onClick={() => onChange(shiftDate(date, -1))} aria-label="Previous day">
        ‹
      </button>
      <ol className="rc-strip" aria-label="Nearby days">
        {strip.map((day) => (
          <li key={day}>
            <button
              type="button"
              className={`rc-strip-day${day === date ? " is-current" : ""}${racingDates?.has(day) ? " has-racing" : ""}`}
              aria-pressed={day === date}
              aria-label={`${dateLabel(day)}${racingDates?.has(day) ? " (racing)" : ""}`}
              onClick={() => onChange(day)}
            >
              <small>{new Date(day + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}</small>
              <strong>{Number(day.slice(8))}</strong>
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="rc-day-step" onClick={() => onChange(shiftDate(date, 1))} aria-label="Next day">
        ›
      </button>
      <label className="rc-date-pick">
        <span className="sr-only">Choose a date</span>
        <input type="date" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} />
      </label>
      {date !== todayISO() && (
        <button type="button" className="btn btn-quiet rc-today" onClick={() => onChange(todayISO())}>
          Today
        </button>
      )}
    </div>
  );
}

const personLink = (person: Runner["jockey"]) =>
  person ? <Link to={`/racing/people/${person.id}`}>{person.name}</Link> : <span className="rc-muted">—</span>;

/** Entries (before the race) or the result chart (once official). */
export function RaceView({ race, compact = false }: { race: Race; compact?: boolean }) {
  const runners = race.runners ?? [];
  const official = race.status === "official";
  const rider = race.breed === "harness" ? "Driver" : "Jockey";
  return (
    <section className={`rc-race status-${race.status}`} aria-labelledby={`race-${race.id}`}>
      <header className="rc-race-head">
        <div className="rc-race-num" aria-hidden="true">
          {race.number}
        </div>
        <div>
          <h2 id={`race-${race.id}`}>
            {compact ? <Link to={`/racing/races/${race.id}`}>{raceTitle(race)}</Link> : raceTitle(race)}
          </h2>
          <p className="rc-facts">
            {race.postTime && <span>Post {race.postTime}</span>}
            {raceFacts(race).map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
            <span className={`rc-status rc-status-${race.status}`}>
              {official ? "Official" : race.status === "cancelled" ? "Cancelled" : "Entries"}
            </span>
          </p>
          {race.conditions && <p className="rc-conditions">{race.conditions}</p>}
        </div>
      </header>
      {!runners.length ? (
        <p className="rc-muted">No runners have been published for this race yet.</p>
      ) : (
        <div className="table-wrap rc-table-wrap">
          <table className="data rc-table">
            <caption className="sr-only">{official ? "Result" : "Entries"} for {raceTitle(race)}</caption>
            <thead>
              <tr>
                {official && <th scope="col">Fin</th>}
                <th scope="col">#</th>
                <th scope="col">Horse</th>
                <th scope="col">{rider}</th>
                <th scope="col">Trainer</th>
                {!compact && <th scope="col">Owner</th>}
                <th scope="col">Wgt</th>
                {official ? (
                  <>
                    <th scope="col">Lengths</th>
                    <th scope="col">Odds</th>
                  </>
                ) : (
                  <th scope="col">M/L</th>
                )}
              </tr>
            </thead>
            <tbody>
              {runners.map((runner) => (
                <tr key={runner.id} className={runner.scratched ? "is-scratched" : runner.finish === 1 ? "is-winner" : undefined}>
                  {official && <td>{runner.scratched ? "SCR" : ordinal(runner.finish)}</td>}
                  <td>
                    <span className="rc-program">{runner.program}</span>
                  </td>
                  <td>
                    <Link to={`/racing/horses/${runner.horse.id}`} className="rc-horse">
                      {runner.horse.name}
                      {runner.horse.country && <small> ({runner.horse.country})</small>}
                    </Link>
                    {runner.scratched && (
                      <small className="rc-scratch">Scratched{runner.scratchReason ? ` · ${runner.scratchReason}` : ""}</small>
                    )}
                    {!compact && (runner.horse.sire || runner.horse.dam) && (
                      <small className="rc-pedigree">
                        {runner.horse.sire || "?"} – {runner.horse.dam || "?"}
                      </small>
                    )}
                    {official && runner.comment && <small className="rc-pedigree">{runner.comment}</small>}
                  </td>
                  <td>{personLink(runner.jockey)}</td>
                  <td>{personLink(runner.trainer)}</td>
                  {!compact && <td>{personLink(runner.owner)}</td>}
                  <td>{runner.weight ?? "—"}</td>
                  {official ? (
                    <>
                      <td>{runner.finish === 1 ? "—" : runner.lengths ?? "—"}</td>
                      <td>{odds(runner.odds)}</td>
                    </>
                  ) : (
                    <td>{runner.morningLine || "—"}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {official && (race.winningTime || race.condition || race.payouts.length > 0 || race.footnotes) && (
        <div className="rc-chart-foot">
          <dl className="rc-chart-facts">
            {race.winningTime && (
              <div>
                <dt>Winning time</dt>
                <dd>{race.winningTime}</dd>
              </div>
            )}
            {race.condition && (
              <div>
                <dt>Track</dt>
                <dd>{conditionLabels[race.condition] ?? race.condition}</dd>
              </div>
            )}
          </dl>
          {race.payouts.length > 0 && (
            <table className="data rc-payouts">
              <caption>Payouts (per $2 unless stated)</caption>
              <tbody>
                {race.payouts.map((line, n) => (
                  <tr key={n}>
                    <th scope="row">{line.pool}</th>
                    <td>{line.combination}</td>
                    <td>{payout(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {race.footnotes && <p className="rc-footnotes">{race.footnotes}</p>}
        </div>
      )}
    </section>
  );
}

export function useRacingDate(search: URLSearchParams, setSearch: (next: URLSearchParams, opts?: { replace?: boolean }) => void) {
  const raw = search.get("date");
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayISO();
  const setDate = (next: string) => {
    const copy = new URLSearchParams(search);
    copy.set("date", next);
    setSearch(copy, { replace: true });
  };
  return [date, setDate] as const;
}
