import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useRacingOverview, {
  sectionKeys,
  type RacingRecord,
  type SectionKey,
} from "../components/landing/useRacingOverview";
import {
  RecordDialog,
  RecordTable,
  sectionNames,
} from "../components/overview/RacingSections";
import MyRacingPanel from "../components/overview/MyRacingPanel";
import { useAuth } from "../auth";
import "../components/overview/overview.css";
import "../components/overview/overview-glass.css";

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
  ["racing-desk", "01", "Entries & results"],
  ["leaderboard", "02", "Leaders"],
  ["daily-insights", "03", "Speed figures"],
  ["stakes", "04", "Stakes"],
  ["my-racing", "05", "My racing"],
  ["racing-notes", "06", "Racing notes"],
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, refreshing, refresh } = useRacingOverview();
  const [params, setParams] = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLocaleLowerCase();
  const [track, setTrack] = useState("");
  const [desk, setDesk] = useState<SectionKey>("racecards");
  const [leader, setLeader] = useState<SectionKey>("horses");
  const [stakes, setStakes] = useState<SectionKey>("stakes");
  const [selected, setSelected] = useState<{
    record: RacingRecord;
    kind: SectionKey;
  } | null>(null);
  const now = useNow();

  const rows = (key: SectionKey) => data?.sections[key] ?? [];
  const tracks = [
    ...new Set(
      sectionKeys.flatMap((key) =>
        rows(key).flatMap((r) => (r.track ? [r.track] : [])),
      ),
    ),
  ].sort();
  const currentTrack = tracks.includes(track) ? track : "";
  const filtered = (key: SectionKey) =>
    rows(key).filter(
      (r) =>
        (!currentTrack || !r.track || r.track === currentTrack) &&
        (!query ||
          [r.name, r.track, r.detail, r.category, r.summary, r.race].some((v) =>
            v?.toLocaleLowerCase().includes(query),
          )),
    );
  const empty =
    !data && refreshing
      ? "Loading published records…"
      : !data && error
        ? "Records are unavailable. Use Refresh to try again."
        : query || currentTrack
          ? "No records match your search or track."
          : "No racing records added yet.";
  const open = (record: RacingRecord, kind: SectionKey) =>
    setSelected({ record, kind });
  const leaders = [...filtered(leader)].sort((a, b) =>
    leader === "horses"
      ? (b.figure ?? -1) - (a.figure ?? -1)
      : (b.wins ?? -1) - (a.wins ?? -1),
  );
  const featured = filtered("stakes")[0] ?? filtered("racecards")[0];
  const featuredKind = filtered("stakes").length ? "stakes" : "racecards";
  const insights = [...filtered("horses")]
    .filter((r) => r.figure !== undefined)
    .sort((a, b) => (b.figure ?? 0) - (a.figure ?? 0));
  const topFigure = insights[0]?.figure;
  const loading = !data && refreshing;

  const stats: { label: string; value: string; hint: string }[] = [
    { label: "Racecards", value: String(filtered("racecards").length), hint: "entries loaded" },
    { label: "Results", value: String(filtered("results").length), hint: "charts loaded" },
    { label: "Stakes", value: String(filtered("stakes").length), hint: "on the schedule" },
    { label: "Top figure", value: topFigure !== undefined ? String(topFigure) : "—", hint: insights[0]?.name ?? "speed figure" },
  ];

  const tabs = (
    keys: SectionKey[],
    active: SectionKey,
    change: (key: SectionKey) => void,
    label: string,
  ) => (
    <div className="gd-seg" role="group" aria-label={label}>
      {keys.map((key) => (
        <button
          type="button"
          key={key}
          aria-pressed={active === key}
          onClick={() => change(key)}
        >
          {sectionNames[key]}
        </button>
      ))}
    </div>
  );
  const table = (kind: SectionKey, records = filtered(kind)) => (
    <div className="gd-table">
      <RecordTable records={records} kind={kind} empty={empty} onOpen={open} />
    </div>
  );

  const statusText = error
    ? `${error}${data ? " Showing last loaded records." : ""}`
    : !data
      ? "Loading racing records…"
      : sectionKeys.every((key) => rows(key).length === 0)
        ? "No racing records have been added yet."
        : `Published records · Checked ${new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="gd">
      {/* ---------- Hero ---------- */}
      <header className="gd-hero gx-glass">
        <div className="gd-hero-main">
          <div className="gd-kicker">
            <span className="gd-pulse" aria-hidden="true" /> Racing overview
          </div>
          <h1>
            Overview<span>.</span>
          </h1>
          <p>Racing information. Your follows. A clearer view of what’s next.</p>
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
        <div
          className={`gd-status${error ? " is-error" : ""}`}
          role={error ? "alert" : "status"}
        >
          <span className="gd-status-dot" aria-hidden="true" />
          <span>{statusText}</span>
        </div>
        <div className="gd-toolbar-controls">
          <label className="gd-select">
            <span>Track</span>
            <select
              aria-label="Filter overview by track"
              value={currentTrack}
              onChange={(e) => setTrack(e.target.value)}
            >
              <option value="">All tracks</option>
              {tracks.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={`gd-btn${refreshing ? " is-busy" : ""}`}
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshIcon />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {query && (
        <div className="gd-search-summary" role="status">
          <div>
            <strong>Search: “{params.get("q")}”</strong>
            <span>
              Search covers the records shown here. Open a section to see all records.
            </span>
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
            id="racing-desk"
            number="01"
            title="Entries & results"
            subtitle="Race entries, results and workouts"
            link="/racing-records/racecards"
          >
            <div className="gd-racing-top">
              <div className="gd-feature">
                <div className="gd-kicker">Upcoming race</div>
                <h3>{featured?.name ?? "Upcoming races"}</h3>
                {featured ? (
                  <ul className="gd-meta">
                    {[featured.track, featured.date, featured.distance, featured.surface]
                      .filter(Boolean)
                      .map((m) => (
                        <li key={String(m)}>{m}</li>
                      ))}
                  </ul>
                ) : (
                  <p>See race entries and upcoming stakes races.</p>
                )}
                {featured ? (
                  <button
                    type="button"
                    className="gd-btn gd-btn-primary"
                    onClick={() => open(featured, featuredKind)}
                  >
                    Race details <Arrow />
                  </button>
                ) : (
                  <Link className="gd-btn gd-btn-primary" to="/racing-records/stakes">
                    Explore stakes <Arrow />
                  </Link>
                )}
              </div>
              <div className="gd-race-links">
                {[
                  ["/racing-records/racecards", "Racecards", "Horses entered and race details"],
                  ["/racing-records/results", "Results & charts", "Race results"],
                  ["/racing-records/workouts", "Workouts", "Training times"],
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
              {tabs(["racecards", "results", "workouts"], desk, setDesk, "Racing records view")}
              <span>Racing records</span>
            </div>
            {table(desk)}
          </Section>

          <Section
            id="leaderboard"
            number="02"
            title="Leaderboard"
            subtitle="Horses, jockeys and trainers"
            link="/racing-records/horses"
          >
            <div className="gd-panel-toolbar">
              {tabs(["horses", "jockeys", "trainers"], leader, setLeader, "Leaderboard view")}
              <span>
                {leader === "horses" ? "By speed figure" : "By wins"} · loaded records
              </span>
            </div>
            {table(leader, leaders)}
          </Section>

          <Section
            id="daily-insights"
            number="03"
            title="Speed figures"
            subtitle="Compare horse performance"
            link="/racing-records/horses"
          >
            {insights.length ? (
              <div className="gd-insights">
                {insights.slice(0, 3).map((r, i) => (
                  <button
                    type="button"
                    key={r.id}
                    className={`gd-insight${i === 0 ? " is-top" : ""}`}
                    onClick={() => open(r, "horses")}
                  >
                    <span className="gd-insight-label">
                      {i === 0 ? "Highest speed figure" : `Rank ${i + 1}`}
                    </span>
                    <strong className="gd-insight-figure">
                      {r.figure}
                      <small>speed fig.</small>
                    </strong>
                    <span
                      className="gd-meter"
                      aria-hidden="true"
                      style={{
                        ["--gd-fill" as string]: `${topFigure ? Math.max(8, ((r.figure ?? 0) / topFigure) * 100) : 0}%`,
                      }}
                    />
                    <b>
                      {r.name} <Arrow />
                    </b>
                    <span className="gd-insight-meta">
                      {r.starts ?? "—"} starts · {r.wins ?? "—"} wins
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="gd-empty">{empty}</p>
            )}
            <p className="gd-footnote">
              Based on the records shown here. This is not a full season ranking.
            </p>
          </Section>

          <Section
            id="stakes"
            number="04"
            title="Stakes schedule"
            subtitle="Stakes entries and results"
            link="/racing-records/stakes"
          >
            <div className="gd-panel-toolbar">
              {tabs(["stakes", "results"], stakes, setStakes, "Stakes view")}
            </div>
            {table(stakes)}
          </Section>

          {/* Section 05 renders its own markup; the wrapper gives it the glass treatment. */}
          <div className="gd-legacy gx-glass">
            <MyRacingPanel />
          </div>

          <Section
            id="racing-notes"
            number="06"
            title="Racing news"
            subtitle="News and race updates"
            link="/racing-records/notes"
          >
            {filtered("notes").length ? (
              <div className="gd-notes">
                {filtered("notes").map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    className="gd-note"
                    onClick={() => open(r, "notes")}
                  >
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
              <p className="gd-empty">{empty}</p>
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
                ["/racing-records/notes", "Race day changes & notices"],
                ["/racing-records/workouts", "Workouts"],
                ["/racing-records/stakes", "Upcoming stakes"],
                ["/racing-records/jockeys", "Jockey statistics"],
                ["/racing-records/trainers", "Trainer statistics"],
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
              Racing records update when new data is added. Race videos,
              past performance reports, betting pools, and paid products are
              not available yet.
            </p>
            <p>
              You can use follows, notes, and personal messages without joining
              a stable. Automatic alerts are not active yet.
            </p>
          </section>
        </aside>
      </div>

      {selected && (
        <RecordDialog {...selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}