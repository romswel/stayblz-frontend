import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import useRacingOverview, {
  sectionKeys,
  type RacingRecord,
  type SectionKey,
} from "../components/landing/useRacingOverview";
import {
  RecordDialog,
  RecordTable,
  OverviewSection,
  sectionNames,
} from "../components/overview/RacingSections";
import MyRacingPanel from "../components/overview/MyRacingPanel";
import { useAuth } from "../auth";
import "../components/overview/overview.css";

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
          ? "No published records match your filters."
          : "No records published yet. New records will appear here automatically.";
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
  const tabs = (
    keys: SectionKey[],
    active: SectionKey,
    change: (key: SectionKey) => void,
  ) => (
    <div className="ov-tabs">
      {keys.map((key) => (
        <button
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
    <RecordTable records={records} kind={kind} empty={empty} onOpen={open} />
  );
  return (
    <div className="overview">
      <header className="ov-heading">
        <div>
          <div className="ov-kicker">YOUR DAILY RACING DESK</div>
          <h1>
            The overview<span>.</span>
          </h1>
          <p>
            Racing information. Your follows. A clearer view of what’s next.
          </p>
        </div>
        <div className="ov-date">
          <span>
            {new Intl.DateTimeFormat("en", { weekday: "long" }).format(
              new Date(),
            )}
          </span>
          <strong>
            {new Intl.DateTimeFormat("en", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </strong>
        </div>
      </header>
      <div className="ov-toolbar">
        <div className="ov-data-state" role={error ? "alert" : "status"}>
          <span className={error ? "ov-dot error" : "ov-dot"} />
          {error
            ? `${error}${data ? " Showing last loaded records." : ""}`
            : !data
              ? "Loading racing records…"
              : `Published records · Checked ${new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
        </div>
        <label>
          Track{" "}
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
        <button className="ws-button" onClick={refresh} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {query && (
        <div className="ov-search-summary">
          <strong>Search: “{params.get("q")}”</strong>
          <span>
            Searching the loaded overview. Open a section for its full published
            list.
          </span>
          <button className="ws-button" onClick={() => setParams({})}>
            Clear search
          </button>
        </div>
      )}
      <nav className="ov-jumps" aria-label="Overview sections">
        {[
          ["racing-desk", "Racing desk"],
          ["leaderboard", "Leaders"],
          ["daily-insights", "Daily insights"],
          ["stakes", "Stakes"],
          ["my-racing", "My racing"],
          ["racing-notes", "Racing notes"],
        ].map(([id, label]) => (
          <a href={`#${id}`} key={id}>
            {label} <span aria-hidden="true">↗</span>
          </a>
        ))}
      </nav>
      <div className="ov-layout">
        <div className="ov-primary">
          <OverviewSection
            id="racing-desk"
            number="01"
            title="At the races"
            subtitle="Entries, results & morning work"
            link="/racing-records/racecards"
          >
            <div className="ov-racing-top">
              <div className="ov-feature">
                <div className="ov-kicker">ON THE RACING CALENDAR</div>
                <h3>
                  {featured?.name ?? "The next chapter starts at the gate."}
                </h3>
                <p>
                  {featured
                    ? [
                        featured.track,
                        featured.date,
                        featured.distance,
                        featured.surface,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "Explore published racecards and upcoming stakes, all in one place."}
                </p>
                {featured ? (
                  <button onClick={() => open(featured, featuredKind)}>
                    Race details ↗
                  </button>
                ) : (
                  <Link to="/racing-records/stakes">Explore stakes ↗</Link>
                )}
              </div>
              <div className="ov-race-links">
                {[
                  [
                    "/racing-records/racecards",
                    "Racecards",
                    "Fields & race conditions",
                  ],
                  [
                    "/racing-records/results",
                    "Results & charts",
                    "Published race outcomes",
                  ],
                  [
                    "/racing-records/workouts",
                    "Workouts",
                    "Morning work & times",
                  ],
                ].map(([to, title, sub]) => (
                  <Link key={to} to={to}>
                    <div>
                      <strong>{title}</strong>
                      <small>{sub}</small>
                    </div>
                    <span>↗</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="ov-panel-toolbar">
              {tabs(["racecards", "results", "workouts"], desk, setDesk)}
              <span>Published overview</span>
            </div>
            {table(desk)}
          </OverviewSection>
          <OverviewSection
            id="leaderboard"
            number="02"
            title="The leaderboard"
            subtitle="Compare the published field"
            link="/racing-records/horses"
          >
            <div className="ov-panel-toolbar">
              {tabs(["horses", "jockeys", "trainers"], leader, setLeader)}
              <span>
                {leader === "horses" ? "By speed figure" : "By wins"} · loaded
                records
              </span>
            </div>
            {table(leader, leaders)}
          </OverviewSection>
          <OverviewSection
            id="daily-insights"
            number="03"
            title="Daily insights"
            subtitle="Find the detail that matters"
            link="/racing-records/horses"
          >
            {insights.length ? (
              <div className="ov-insight-grid">
                {insights.slice(0, 3).map((r, i) => (
                  <button key={r.id} onClick={() => open(r, "horses")}>
                    <span>
                      {i === 0
                        ? "Highest published figure"
                        : "In the published field"}
                    </span>
                    <strong>
                      {r.figure}
                      <small>speed figure</small>
                    </strong>
                    <b>{r.name} ↗</b>
                    <span>
                      {r.starts ?? "—"} starts · {r.wins ?? "—"} wins
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="ov-empty">{empty}</p>
            )}
            <p className="ov-footnote">
              Figures reflect published records in this overview. Rankings are
              not a complete season table or a prediction.
            </p>
          </OverviewSection>
          <OverviewSection
            id="stakes"
            number="04"
            title="The stakes calendar"
            subtitle="Plan the next outing"
            link="/racing-records/stakes"
          >
            <div className="ov-panel-toolbar">
              {tabs(["stakes", "results"], stakes, setStakes)}
            </div>
            {table(stakes)}
          </OverviewSection>
          <MyRacingPanel />
          <OverviewSection
            id="racing-notes"
            number="06"
            title="From the racing desk"
            subtitle="Published news, changes & stories"
            link="/racing-records/notes"
          >
            {filtered("notes").length ? (
              <div className="ov-notes">
                {filtered("notes").map((r) => (
                  <button key={r.id} onClick={() => open(r, "notes")}>
                    <span className="ov-kicker">
                      {r.category ?? "RACING NOTE"}
                    </span>
                    <h3>{r.name}</h3>
                    <p>{r.summary}</p>
                    <span>Read note ↗</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="ov-empty">{empty}</p>
            )}
          </OverviewSection>
        </div>
        <aside className="ov-rail" aria-label="Your racing tools">
          <section className="ov-paper ov-welcome">
            <span className="ov-kicker">A GOOD DAY TO FOLLOW THE FORM</span>
            <h2>
              Welcome back,
              <br />
              {user?.profile?.firstName || user?.displayName || "racing fan"}.
            </h2>
            <p>
              Follow the form, keep your own notes, and pick up your racing
              conversations.
            </p>
            <Link to="/account">Manage your account ↗</Link>
          </section>
          <section className="ov-paper">
            <div className="ov-rail-head">
              <h2>The quick rail</h2>
              <span>↗</span>
            </div>
            <div className="ov-quick-links">
              {[
                ["/messages", "Messages", "Talk racing privately"],
                ["/my-racing", "Following", "Horses, jockeys & trainers"],
                [
                  "/my-racing?tab=notes",
                  "Race notebook",
                  "Your private observations",
                ],
                [
                  "/my-racing?tab=alerts",
                  "Alert preferences",
                  "Choose your racing updates",
                ],
              ].map(([to, label, sub], i) => (
                <Link key={to} to={to}>
                  <span className="ov-link-num">0{i + 1}</span>
                  <div>
                    <strong>{label}</strong>
                    <small>{sub}</small>
                  </div>
                  <span>→</span>
                </Link>
              ))}
            </div>
          </section>
          <section className="ov-paper">
            <div className="ov-rail-head">
              <h2>Latest information</h2>
            </div>
            <div className="ov-directory">
              {[
                ["/racing-records/notes", "Race day changes & notices"],
                ["/racing-records/workouts", "Published workouts"],
                ["/racing-records/stakes", "Upcoming stakes"],
                ["/racing-records/jockeys", "Jockey statistics"],
                ["/racing-records/trainers", "Trainer statistics"],
              ].map(([to, label]) => (
                <Link key={to} to={to}>
                  {label}
                  <span>↗</span>
                </Link>
              ))}
            </div>
          </section>
          <section className="ov-paper ov-editorial">
            <span className="ov-kicker">KNOW THE HORSE. READ THE RACE.</span>
            <h2>A better-informed day at the races.</h2>
            <p>
              Start with the field. Compare the form. Keep your favorites in
              view.
            </p>
            <Link to="/faq">How Stayblz works ↗</Link>
          </section>
          <section className="ov-paper ov-availability">
            <h2>Data & services</h2>
            <p>
              Published racing records refresh automatically. Past performances,
              replays, wagering pools, paid products and checkout are not
              connected yet.
            </p>
            <p>
              Your follows, notes and personal conversations belong to your
              account. Team operations are optional.
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
