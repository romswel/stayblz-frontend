import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useRacingOverview, { type RacingRecord } from "../components/landing/useRacingOverview";
import { RecordDialog } from "../components/overview/RacingSections";
import MyRacingPanel from "../components/overview/MyRacingPanel";
import YourHorsesPanel from "../components/overview/YourHorsesPanel";
import { useFormFavOverview } from "../components/overview/raceWatch";
import type { DashOpen } from "../components/overview/DashboardDialogs";
import type { OverviewRace, OverviewResult, RaceWhere } from "../components/stayblz-data/formfavApi";
import { clock, pct, regionName } from "../components/stayblz-data/formfavUi";
import { dateLabel } from "../components/racing/format";
import ProfileNudge from "../components/account/ProfileNudge";
import { useAuth } from "../auth";
import "../components/overview/overview.css";
import "../components/overview/overview-glass.css";

const DashboardDialogs = lazy(() => import("../components/overview/DashboardDialogs"));
const codeName = (c: string) => (c === "harness" ? "Harness" : "Thoroughbred");

const Arrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
  </svg>
);

/** A glass card with a numbered heading and a "See all" link. */
function Section({
  id,
  number,
  title,
  subtitle,
  link,
  children,
}: {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  link?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="gd-section gx-glass" aria-labelledby={`${id}-title`}>
      <header className="gd-section-head">
        <span className="gd-num" aria-hidden="true">{number}</span>
        <div className="gd-section-title">
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {link && (
          <Link className="gd-see-all" to={link} aria-label={`See all: ${title}`}>
            <span>See all</span> <Arrow />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/** Ticks once a minute so the header clock stays current. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const JUMPS = [
  ["your-horses", "01", "Your horses"],
  ["racing-desk", "02", "Entries & results"],
  ["leaderboard", "03", "Leaders"],
  ["in-form", "04", "In form"],
  ["stakes", "05", "Stakes"],
  ["my-racing", "06", "My account"],
  ["racing-notes", "07", "Racing news"],
] as const;

type DeskView = "upcoming" | "results";
type LeaderView = "horses" | "jockeys" | "trainers";
const DESK_LABELS: Record<DeskView, string> = { upcoming: "Upcoming", results: "Results" };
const LEADER_LABELS: Record<LeaderView, string> = { horses: "Horses", jockeys: "Jockeys", trainers: "Trainers" };

const whereOfRace = (r: OverviewRace): RaceWhere | null =>
  r.raceNumber === null ? null : { date: r.date, code: r.code, tz: r.timezone, track: r.slug, race: r.raceNumber, country: r.country };
const shortDay = (iso: string) => dateLabel(iso, "short").replace(/,? \d{4}$/, "");
const when = (r: OverviewRace) => [shortDay(r.date), clock(r.startTime)].filter(Boolean).join(" · ");
const placeName = (r: OverviewResult, n: number) => r.placings.find((p) => p.position === n);
/** Entries & results show this many rows; "See all" opens Stayblz Data's meetings for the matching days. */
const DESK_LIMIT = 10;
const shiftDay = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [track, setTrack] = useState("");
  const race = useFormFavOverview(track, version);
  const { data: notesData, error: notesError, refreshing: notesRefreshing, refresh: refreshNotes } = useRacingOverview();
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLocaleLowerCase();
  const [desk, setDesk] = useState<DeskView>("upcoming");
  const [leader, setLeader] = useState<LeaderView>("horses");
  const [stakes, setStakes] = useState<DeskView>("upcoming");
  const [note, setNote] = useState<RacingRecord | null>(null);
  const [dialog, setDialog] = useState<DashOpen | null>(null);
  const now = useNow();

  const data = race.data;
  const has = (...values: (string | null | undefined)[]) =>
    !query || values.some((v) => v?.toLocaleLowerCase().includes(query));
  const raceMatch = (r: OverviewRace) =>
    has(r.track, r.raceName, r.raceClass, ...("placings" in r ? (r as OverviewResult).placings.flatMap((p) => [p.name, p.jockey, p.trainer]) : []));
  const upcoming = (data?.upcoming ?? []).filter(raceMatch);
  const results = (data?.results ?? []).filter(raceMatch);
  const stakesUpcoming = (data?.stakes.upcoming ?? []).filter(raceMatch);
  const stakesResults = (data?.stakes.results ?? []).filter(raceMatch);
  const horseLeaders = (data?.leaders.horses ?? []).filter((h) => has(h.name, h.trainer, h.jockey));
  const peopleLeaders = (kind: "jockeys" | "trainers") => (data?.leaders[kind] ?? []).filter((p) => has(p.name));
  const inForm = (data?.inForm ?? []).filter((h) => has(h.name, h.trainer, h.jockey));
  const notes = (notesData?.sections.notes ?? []).filter((r) => has(r.name, r.category, r.summary));
  const featured = stakesUpcoming[0] ?? upcoming[0];
  // Meetings page: upcoming = today and the next 2 days; results = the last 7 days.
  const dayNow = data?.today ?? localToday();
  const deskAll =
    desk === "upcoming"
      ? `/stayblz-data?from=${dayNow}&to=${shiftDay(dayNow, 2)}`
      : `/stayblz-data?from=${shiftDay(dayNow, -6)}&to=${dayNow}`;
  const deskRows = desk === "upcoming" ? upcoming : results;
  const loading = !data && race.refreshing;
  const disabled = race.enabled === false;

  const empty = loading
    ? "Loading race data…"
    : disabled
      ? "Race data isn't available right now."
      : !data && race.error
        ? "Race data is unavailable. Use Refresh to try again."
        : data?.building
          ? "Race data is still loading on the server. This can take a minute."
          : query
            ? "Nothing matches your search."
            : "Nothing here right now.";
  const openRace = (r: OverviewRace) => {
    const where = whereOfRace(r);
    if (where) setDialog({ kind: "race", where });
  };
  const refresh = () => {
    setVersion((v) => v + 1);
    refreshNotes();
  };

  const topJockey = data?.leaders.jockeys[0];
  const stats: { label: string; value: string; hint: string }[] = [
    { label: "Races today", value: data ? String(data.counts.racesToday) : "—", hint: data ? `${data.counts.meetingsToday} meetings` : "US & Canada" },
    { label: "Results in", value: data ? String(data.counts.resultsToday) : "—", hint: "today" },
    { label: "Stakes ahead", value: data ? String(data.counts.stakesAhead) : "—", hint: "next 2 days" },
    { label: "Top jockey", value: topJockey ? String(topJockey.wins) : "—", hint: topJockey ? `${topJockey.name} · wins` : "last 30 days" },
  ];

  const seg = <K extends string>(keys: K[], labels: Record<K, string>, active: K, change: (key: K) => void, label: string) => (
    <div className="gd-seg" role="group" aria-label={label}>
      {keys.map((key) => (
        <button type="button" key={key} aria-pressed={active === key} onClick={() => change(key)}>
          {labels[key]}
        </button>
      ))}
    </div>
  );

  const raceName = (r: OverviewRace) => (
    <button type="button" className="ov-record-name" onClick={() => openRace(r)} disabled={r.raceNumber === null}>
      {r.raceName ?? `Race ${r.raceNumber ?? ""}`}
      <span>{[r.raceNumber ? `Race ${r.raceNumber}` : null, r.raceClass, r.stakes && !/stake/i.test(r.raceClass ?? "") ? "Stakes" : null].filter(Boolean).join(" · ")}</span>
    </button>
  );
  const upcomingTable = (rows: OverviewRace[], label: string) => (
    <div className="gd-table" role="region" aria-label={label} tabIndex={0}>
      {rows.length ? (
        <table className="ov-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Race</th>
              <th>Track</th>
              <th>Distance</th>
              <th>Runners</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.code}${r.date}${r.slug}${r.raceNumber}`}>
                <td>{when(r)}</td>
                <th scope="row">{raceName(r)}</th>
                <td>
                  {r.track ?? r.slug}
                  <small className="gd-cell-sub">{[codeName(r.code), regionName(r.country)].join(" · ")}</small>
                </td>
                <td>{r.distance ?? "—"}</td>
                <td>{r.runners || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="ov-empty" role="status">{empty}</p>
      )}
    </div>
  );
  const resultsTable = (rows: OverviewResult[], label: string) => (
    <div className="gd-table" role="region" aria-label={label} tabIndex={0}>
      {rows.length ? (
        <table className="ov-table">
          <thead>
            <tr>
              <th>Race</th>
              <th>Winner</th>
              <th>Jockey / driver</th>
              <th>Trainer</th>
              <th>2nd · 3rd</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const win = placeName(r, 1);
              return (
                <tr key={`${r.code}${r.date}${r.slug}${r.raceNumber}`}>
                  <th scope="row">
                    {raceName(r)}
                    <small className="gd-cell-sub">{[shortDay(r.date), r.track ?? r.slug].join(" · ")}</small>
                  </th>
                  <td>
                    {win ? (
                      <button type="button" className="ov-text-button gd-winner" onClick={() => setDialog({ kind: "horse", name: win.name, code: r.code })}>
                        {win.name}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{win?.jockey ?? "—"}</td>
                  <td>{win?.trainer ?? "—"}</td>
                  <td>{[placeName(r, 2)?.name, placeName(r, 3)?.name].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="ov-empty" role="status">{empty}</p>
      )}
    </div>
  );
  const leaderTable = () => {
    const horses = leader === "horses";
    const people = horses ? [] : peopleLeaders(leader);
    const count = horses ? horseLeaders.length : people.length;
    return (
      <div className="gd-table" role="region" aria-label={`${LEADER_LABELS[leader]} leaders`} tabIndex={0}>
        {count ? (
          <table className="ov-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>{horses ? "Starts" : "Rides"}</th>
                <th>Wins</th>
                <th>Win %</th>
              </tr>
            </thead>
            <tbody>
              {horses
                ? horseLeaders.map((h, i) => (
                    <tr key={`${h.code}${h.name}`}>
                      <td>{String(i + 1).padStart(2, "0")}</td>
                      <th scope="row">
                        <button type="button" className="ov-record-name" onClick={() => setDialog({ kind: "horse", name: h.name, code: h.code })}>
                          {h.name}
                          <span>{[codeName(h.code), h.trainer].filter(Boolean).join(" · ")}</span>
                        </button>
                      </th>
                      <td>{h.starts}</td>
                      <td>{h.wins}</td>
                      <td>{pct(h.winRate)}</td>
                    </tr>
                  ))
                : people.map((p, i) => (
                    <tr key={p.name}>
                      <td>{String(i + 1).padStart(2, "0")}</td>
                      <th scope="row">
                        <button
                          type="button"
                          className="ov-record-name"
                          onClick={() => setDialog({ kind: "stats", target: { kind: p.kind, name: p.name, summary: p } })}
                        >
                          {p.name}
                          <span>{p.upcoming ? `${p.upcoming} entered` : `${p.tracks} tracks`}</span>
                        </button>
                      </th>
                      <td>{p.rides}</td>
                      <td>{p.wins}</td>
                      <td>{pct(p.winRate)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        ) : (
          <p className="ov-empty" role="status">{empty}</p>
        )}
      </div>
    );
  };

  const updated = data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  const statusError = !!race.error || disabled;
  const statusText = disabled
    ? "Race data isn't available right now."
    : race.error
      ? `${race.error}${data ? " Showing the last race data loaded." : ""}`
      : !data
        ? "Loading US & Canada race data…"
        : data.building
          ? "Race data is loading on the server for the first time…"
          : `US & Canada race data${updated ? ` · Updated ${updated}` : ""}`;
  const trackOptions = data?.tracks ?? [];

  return (
    <div className="gd">
      <ProfileNudge />
      {/* ---------- Hero ---------- */}
      <header className="gd-hero gx-glass">
        <div className="gd-hero-main">
          <div className="gd-kicker">
            <span className="gd-pulse" aria-hidden="true" /> Racing overview
          </div>
          <h1>
            Overview<span>.</span>
          </h1>
          <p>US &amp; Canada racing. Your horses. A clearer view of what’s next.</p>
        </div>
        <div className="gd-clock">
          <span>{new Intl.DateTimeFormat("en", { weekday: "long" }).format(now)}</span>
          <strong>
            {new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(now)}
          </strong>
          <small>
            {new Intl.DateTimeFormat("en", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(now)}
          </small>
        </div>
        <dl className={`gd-stats${loading ? " is-loading" : ""}`}>
          {stats.map((s) => (
            <div key={s.label} className="gd-stat">
              <dt>{s.label}</dt>
              <dd>
                <strong>{s.value}</strong>
                <small>{s.hint}</small>
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {/* ---------- Toolbar ---------- */}
      <div className="gd-toolbar gx-glass">
        {/* A background data load: announced politely (status), never as an alert. */}
        <div className={`gd-status${statusError ? " is-error" : ""}`} role="status">
          <span className="gd-status-dot" aria-hidden="true" />
          <span>{statusText}</span>
        </div>
        <div className="gd-toolbar-controls">
          <label className="gd-select">
            <span>Track</span>
            <select aria-label="Filter overview by track" value={track} onChange={(e) => setTrack(e.target.value)}>
              <option value="">All tracks</option>
              {track && !trackOptions.some((t) => t.slug === track) && <option value={track}>{track}</option>}
              {trackOptions.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name ?? t.slug}
                  {t.country ? ` (${t.country.toUpperCase()})` : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`gd-btn${race.refreshing || notesRefreshing ? " is-busy" : ""}`}
            onClick={refresh}
            disabled={race.refreshing}
          >
            <RefreshIcon />
            {race.refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {query && (
        <div className="gd-search-summary" role="status">
          <div>
            <strong>Search: “{params.get("q")}”</strong>
            <span>Search covers what's shown here. Open Stayblz Data to search every horse and person.</span>
          </div>
          <button type="button" className="gd-btn gd-btn-ghost" onClick={() => setParams({})}>
            Clear search
          </button>
        </div>
      )}

      {/* ---------- Section jumps ---------- */}
      <nav className="gd-jumps gx-glass" aria-label="Overview sections">
        {JUMPS.map(([id, num, label]) => (
          <a href={`#${id}`} key={id}>
            <span className="gd-jump-num" aria-hidden="true">{num}</span>
            {label}
          </a>
        ))}
      </nav>

      <div className="gd-layout">
        <div className="gd-primary">
          <Section
            id="your-horses"
            number="01"
            title="Your horses"
            subtitle="Tracked in Virtual Stayblz and your own horses: who's entered and how they ran"
            link="/my-racing?tab=virtual"
          >
            <YourHorsesPanel version={version} query={query} onRace={(where) => setDialog({ kind: "race", where })} />
          </Section>

          <Section
            id="racing-desk"
            number="02"
            title="Entries & results"
            subtitle="US & Canada race cards and results"
            link={deskAll}
          >
            <div className="gd-racing-top">
              <div className="gd-feature">
                <div className="gd-kicker">{featured?.stakes ? "Next stakes race" : "Next race"}</div>
                <h3>{featured?.raceName ?? (featured ? `Race ${featured.raceNumber}` : "Upcoming races")}</h3>
                {featured ? (
                  <ul className="gd-meta">
                    {[featured.track, when(featured), featured.distance, featured.raceClass, featured.runners ? `${featured.runners} runners` : null]
                      .filter(Boolean)
                      .map((m) => (
                        <li key={String(m)}>{m}</li>
                      ))}
                  </ul>
                ) : (
                  <p>{loading ? "Loading race data…" : "See today's meetings and race cards in Stayblz Data."}</p>
                )}
                {featured && featured.raceNumber !== null ? (
                  <button type="button" className="gd-btn gd-btn-primary" onClick={() => openRace(featured)}>
                    Race card <Arrow />
                  </button>
                ) : (
                  <Link className="gd-btn gd-btn-primary" to="/stayblz-data">
                    See meetings <Arrow />
                  </Link>
                )}
              </div>
              <div className="gd-race-links">
                {[
                  ["/stayblz-data", "Meetings", "Race cards, form and results"],
                  ["/stayblz-data?tab=horses", "Horses", "Every US & Canada horse A–Z"],
                  ["/stayblz-data?tab=stats", "Jockeys & trainers", "30-day stats"],
                ].map(([to, title, sub]) => (
                  <Link key={to} to={to} className="gd-tile">
                    <span>
                      <strong>{title}</strong>
                      <small>{sub}</small>
                    </span>
                    <Arrow />
                  </Link>
                ))}
              </div>
            </div>
            <div className="gd-panel-toolbar">
              {seg<DeskView>(["upcoming", "results"], DESK_LABELS, desk, setDesk, "Entries and results view")}
              <span>{desk === "upcoming" ? "Next races, soonest first" : "Latest results"}</span>
            </div>
            {desk === "upcoming"
              ? upcomingTable(upcoming.slice(0, DESK_LIMIT), "Upcoming races")
              : resultsTable(results.slice(0, DESK_LIMIT), "Latest results")}
            {deskRows.length > 0 && (
              <div className="gd-table-foot">
                <span>
                  {deskRows.length > DESK_LIMIT
                    ? `Showing ${DESK_LIMIT} ${desk === "upcoming" ? "next races" : "latest results"}`
                    : `${deskRows.length} ${desk === "upcoming" ? (deskRows.length === 1 ? "race" : "races") : deskRows.length === 1 ? "result" : "results"}`}
                </span>
                <Link className="gd-see-all" to={deskAll}>
                  <span>{desk === "upcoming" ? "See all entries" : "See all results"}</span> <Arrow />
                </Link>
              </div>
            )}
          </Section>

          <Section id="leaderboard" number="03" title="Leaders" subtitle="Horses, jockeys and trainers" link="/stayblz-data?tab=stats">
            <div className="gd-panel-toolbar">
              {seg<LeaderView>(["horses", "jockeys", "trainers"], LEADER_LABELS, leader, setLeader, "Leaderboard view")}
              <span>By wins · US &amp; Canada, last 30 days</span>
            </div>
            {leaderTable()}
          </Section>

          <Section id="in-form" number="04" title="In form" subtitle="Horses winning and placing most often" link="/stayblz-data?tab=horses">
            {inForm.length ? (
              <>
                <div className="gd-insights">
                  {inForm.slice(0, 3).map((h, i) => (
                    <button
                      type="button"
                      key={`${h.code}${h.name}`}
                      className={`gd-insight${i === 0 ? " is-top" : ""}`}
                      onClick={() => setDialog({ kind: "horse", name: h.name, code: h.code })}
                    >
                      <span className="gd-insight-label">{i === 0 ? "Most in form" : `Rank ${i + 1}`}</span>
                      <strong className="gd-insight-figure">
                        {h.wins}
                        <small>{h.wins === 1 ? "win" : "wins"} from {h.starts}</small>
                      </strong>
                      <span
                        className="gd-meter"
                        aria-hidden="true"
                        style={{ ["--gd-fill" as string]: `${Math.max(8, Math.round(h.winRate * 100))}%` }}
                      />
                      <b>
                        {h.name} <Arrow />
                      </b>
                      <span className="gd-insight-meta">
                        Form {h.form || "—"} · {pct(h.winRate)} wins
                      </span>
                    </button>
                  ))}
                </div>
                {inForm.length > 3 && (
                  <ol className="gd-form-list" start={4}>
                    {inForm.slice(3).map((h) => (
                      <li key={`${h.code}${h.name}`}>
                        <button type="button" className="ov-text-button" onClick={() => setDialog({ kind: "horse", name: h.name, code: h.code })}>
                          {h.name}
                        </button>
                        <span>
                          {h.wins}–{h.starts} · Form {h.form || "—"}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <p className="gd-empty">{empty}</p>
            )}
            <p className="gd-footnote">
              From US &amp; Canada results over the last 30 days (two runs or more). Form shows the latest finish first.
            </p>
          </Section>

          <Section id="stakes" number="05" title="Stakes" subtitle="Stakes and graded races" link="/stayblz-data">
            <div className="gd-panel-toolbar">
              {seg<DeskView>(["upcoming", "results"], DESK_LABELS, stakes, setStakes, "Stakes view")}
            </div>
            {stakes === "upcoming" ? upcomingTable(stakesUpcoming, "Upcoming stakes races") : resultsTable(stakesResults, "Stakes results")}
          </Section>

          {/* Section 06 renders its own markup; the wrapper gives it the glass treatment. */}
          <div className="gd-legacy gx-glass">
            <MyRacingPanel />
          </div>

          <Section id="racing-notes" number="07" title="Racing news" subtitle="News and race updates" link="/racing-records/notes">
            {notes.length ? (
              <div className="gd-notes">
                {notes.map((r) => (
                  <button type="button" key={r.id} className="gd-note" onClick={() => setNote(r)}>
                    <span className="gd-chip">{r.category ?? "Racing note"}</span>
                    <h3>{r.name}</h3>
                    <p>{r.summary}</p>
                    <span className="gd-note-cta">
                      Read note <Arrow />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="gd-empty">
                {!notesData && notesRefreshing
                  ? "Loading racing news…"
                  : !notesData && notesError
                    ? "Racing news is unavailable. Use Refresh to try again."
                    : query
                      ? "No news matches your search."
                      : "No racing news yet."}
              </p>
            )}
          </Section>
        </div>

        {/* ---------- Right rail ---------- */}
        <aside className="gd-rail" aria-label="Your racing tools">
          <section className="gd-card gd-welcome gx-glass">
            <span className="gd-kicker">Your account</span>
            <h2>
              Welcome back,
              <br />
              <span className="gd-gradient-text">
                {user?.profile?.firstName || user?.displayName || "member"}
              </span>
              .
            </h2>
            <p>View your saved horses, notes, and messages.</p>
            <Link className="gd-btn gd-btn-primary" to="/account">
              Manage your account <Arrow />
            </Link>
          </section>

          <section className="gd-card gx-glass" aria-labelledby="gd-quick">
            <div className="gd-card-head">
              <h2 id="gd-quick">Quick links</h2>
            </div>
            <div className="gd-quick-links">
              {[
                ["/messages", "Messages", "Private conversations"],
                ["/my-racing", "Following", "Horses, jockeys & trainers"],
                ["/my-racing?tab=notes", "My notes", "Notes only you can see"],
                ["/my-racing?tab=alerts", "Alert settings", "Choose which updates you want"],
              ].map(([to, label, sub], i) => (
                <Link key={to} to={to}>
                  <span className="gd-link-num">0{i + 1}</span>
                  <span className="gd-link-text">
                    <strong>{label}</strong>
                    <small>{sub}</small>
                  </span>
                  <span className="gd-link-arrow" aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="gd-card gx-glass" aria-labelledby="gd-latest">
            <div className="gd-card-head">
              <h2 id="gd-latest">Latest information</h2>
            </div>
            <div className="gd-directory">
              {[
                ["/stayblz-data", "Today's meetings & race cards"],
                ["/stayblz-data?tab=horses", "Horses A–Z"],
                ["/stayblz-data?tab=stats", "Jockey statistics"],
                ["/stayblz-data?tab=stats&kind=trainer", "Trainer statistics"],
                ["/my-racing?tab=virtual&vtab=racing", "Track a racing horse"],
                ["/racing-records/notes", "Race day changes & notices"],
              ].map(([to, label]) => (
                <Link key={to} to={to}>
                  {label}
                  <Arrow />
                </Link>
              ))}
            </div>
          </section>

          <section className="gd-card gd-editorial gx-glass" aria-labelledby="gd-stable">
            <span className="gd-kicker">For stable owners and teams</span>
            <h2 id="gd-stable">Stable tools</h2>
            <p>
              Manage horses, training, and team updates. Create a stable or join
              one with an invitation.
            </p>
            <div className="gd-directory">
              <Link to="/workspace">Stable updates <Arrow /></Link>
              <Link to="/inventory">Horse records <Arrow /></Link>
              <Link to="/tracker">Horse tracking <Arrow /></Link>
              <Link to="/team-messages">Team messages <Arrow /></Link>
              <Link to="/stables">Stables and team access <Arrow /></Link>
            </div>
          </section>

          <section className="gd-card gd-availability gx-glass" aria-labelledby="gd-data">
            <div className="gd-card-head">
              <h2 id="gd-data">Data &amp; services</h2>
              <span className="gd-chip gd-chip-warn">Preview</span>
            </div>
            <p>
              Race data covers the United States and Canada: about the last
              30 days and the next 2, updated every 30 minutes. Race videos,
              past performance reports and betting pools are not available yet.
            </p>
            <p>
              You can use follows, notes, and personal messages without joining
              a stable. Automatic alerts are not active yet.
            </p>
          </section>
        </aside>
      </div>

      {note && <RecordDialog record={note} kind="notes" onClose={() => setNote(null)} />}
      {dialog && (
        <Suspense fallback={null}>
          <DashboardDialogs open={dialog} onOpen={setDialog} />
        </Suspense>
      )}
    </div>
  );
}