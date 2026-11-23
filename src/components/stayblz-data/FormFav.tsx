import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Empty, Icon, Skeletons } from "../community/ui";
import { dateLabel, isISODate, shiftDate, todayISO } from "../racing/format";
import { errorText } from "./detail";
import { formFav, type Meeting, type MeetingRace, type Meetings } from "./formfavApi";
import { RaceDialog, StatsDialog } from "./formfavDialogs";
import { HorsesView, PeopleView } from "./FormFavLists";
import {
  CODES,
  COUNTRIES,
  MAX_DAYS,
  MAX_SPAN,
  MIN_DAYS,
  ZONES,
  Toggles,
  clock,
  listParam,
  listValue,
  regionName,
  type StatsTarget,
} from "./formfavUi";

/**
 * Stayblz Data (FormFav, US + Canada): Meeting (meetings → race form, predictions, results), Horses (A–Z) and Stats
 * (jockeys / trainers A–Z), all through our server. Each view's filters live in the URL.
 */

export type View = "meetings" | "horses" | "stats";

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
      ) : view === "horses" ? (
        <HorsesView params={params} set={set} onStats={setStats} />
      ) : (
        <PeopleView params={params} set={set} onStats={setStats} />
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

