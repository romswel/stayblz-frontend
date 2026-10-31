import { useState, type ReactNode } from "react";
import Brand from "../Brand";
import useRacingOverview, {
  type RacingRecord,
  type SectionKey,
} from "./useRacingOverview";

interface Props {
  onOpen: (path: string, label: string) => void;
  onSignup: () => void;
}
const Arrow = () => <span aria-hidden="true">↗</span>;
const dash = "—";
const winRate = (r: RacingRecord) =>
  r.starts ? `${Math.round(((r.wins ?? 0) / r.starts) * 100)}%` : dash;
const dateParts = (value?: string) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? {
        day: new Intl.DateTimeFormat("en", {
          day: "2-digit",
          timeZone: "UTC",
        }).format(date),
        month: new Intl.DateTimeFormat("en", {
          month: "short",
          timeZone: "UTC",
        }).format(date),
      }
    : { day: dash, month: "" };
};
function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="ld-section-title">
      <h2>
        <span>{number}</span>
        {title}
      </h2>
    </div>
  );
}
function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ld-paper ld-data-panel ${className}`}>{children}</div>
  );
}
interface EmptyState {
  loading: boolean;
  unavailable: boolean;
}
function Empty({
  label,
  loading,
  unavailable,
}: { label: string } & EmptyState) {
  return (
    <div className={`ld-empty${loading ? " ld-is-loading" : ""}`} role="status">
      <Brand />
      <p>
        {loading
          ? "Loading records…"
          : unavailable
            ? "Records unavailable."
            : `No ${label} published yet.`}
      </p>
    </div>
  );
}
function TableRegion({
  children,
  label,
  empty,
  ...state
}: { children: ReactNode; label: string; empty: boolean } & EmptyState) {
  return (
    <div
      className="ld-table-scroll ld-panel-scroll"
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {empty ? <Empty label={label.toLowerCase()} {...state} /> : children}
    </div>
  );
}

export default function RacingPreview({ onOpen, onSignup }: Props) {
  const { data, error, refreshing, refresh } = useRacingOverview();
  const [deskTab, setDeskTab] = useState<"racecards" | "results" | "workouts">(
    "racecards",
  );
  const [track, setTrack] = useState("");
  const [leaderTab, setLeaderTab] = useState<"horses" | "jockeys" | "trainers">(
    "horses",
  );
  const [stakesTab, setStakesTab] = useState<"stakes" | "results">("stakes");
  const [openNote, setOpenNote] = useState<string | null>(null);
  const rows = (key: SectionKey) => data?.sections[key] ?? [];
  const tracks = [
    ...new Set(
      rows(deskTab)
        .map((r) => r.track)
        .filter((name): name is string => !!name),
    ),
  ].sort();
  const selectedTrack = tracks.includes(track) ? track : "";
  const deskRows = rows(deskTab).filter(
    (r) => !selectedTrack || r.track === selectedTrack,
  );
  const leaderRows = [...rows(leaderTab)].sort((a, b) =>
    leaderTab === "horses"
      ? (b.figure ?? 0) - (a.figure ?? 0)
      : (b.wins ?? 0) - (a.wins ?? 0),
  );
  const featured = [...rows("horses")].sort(
    (a, b) => (b.figure ?? 0) - (a.figure ?? 0),
  )[0];
  const deskPath = deskTab === "racecards" ? "/entries" : `/${deskTab}`;
  const isLoading = !data && refreshing;
  const emptyState = { loading: isLoading, unavailable: !!error && !data };

  return (
    <>
      <div className="ld-data-status">
        <span
          className={`ld-connection-dot${refreshing ? " ld-fetching" : ""}`}
          aria-hidden="true"
        />
        <p role={error ? "alert" : "status"}>
          {error
            ? `${error}${data ? " Showing the last loaded records." : ""}`
            : isLoading
              ? "Loading racing data…"
              : data
                ? `Updated ${new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(data.fetchedAt))}`
                : "Racing data"}
        </p>
        <button
          className="ld-refresh"
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh racing data"
        >
          <svg
            className={refreshing ? "ld-spin" : ""}
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" />
          </svg>
          {error ? "Retry" : "Refresh"}
        </button>
      </div>

      <div className="ld-desk-grid ld-reveal">
        <section className="ld-race-desk" id="race-desk">
          <SectionTitle number="01" title="Racing" />
          <Panel>
            <div className="ld-table-toolbar">
              <div className="ld-tabs" aria-label="Racing desk views">
                {(["racecards", "results", "workouts"] as const).map((tab) => (
                  <button
                    key={tab}
                    aria-pressed={deskTab === tab}
                    onClick={() => {
                      setDeskTab(tab);
                      setTrack("");
                    }}
                  >
                    {tab === "racecards"
                      ? "Racecards"
                      : tab === "results"
                        ? "Results"
                        : "Workouts"}
                  </button>
                ))}
              </div>
              <label className="ld-track-filter">
                <span className="ld-sr-only">Filter by track</span>
                <select
                  value={selectedTrack}
                  onChange={(e) => setTrack(e.target.value)}
                >
                  <option value="">All tracks</option>
                  {tracks.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
            </div>
            <TableRegion
              {...emptyState}
              key={deskTab}
              label={
                deskTab === "racecards"
                  ? "Racecards"
                  : deskTab === "results"
                    ? "Results"
                    : "Workouts"
              }
              empty={!deskRows.length}
            >
              <table className="ld-table ld-race-table">
                <caption className="ld-sr-only">Published {deskTab}</caption>
                <thead>
                  <tr>
                    <th>{deskTab === "racecards" ? "Post" : "Time"}</th>
                    <th>
                      {deskTab === "racecards"
                        ? "Race / Track"
                        : "Horse / Track"}
                    </th>
                    <th>{deskTab === "racecards" ? "Surface" : "Details"}</th>
                    <th>
                      {deskTab === "racecards"
                        ? "Field"
                        : deskTab === "workouts"
                          ? "Distance"
                          : "Margin"}
                    </th>
                    <th>
                      <span className="ld-sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {deskRows.map((r, i) => (
                    <tr
                      key={r.id}
                      style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                    >
                      <td className="ld-post">
                        {r.time ?? dash}
                        <small>{r.race}</small>
                      </td>
                      <td>
                        <button
                          className="ld-table-name"
                          onClick={() =>
                            onOpen(deskPath, "view the full racecard")
                          }
                        >
                          {r.name}
                        </button>
                        <small>
                          {r.track}
                          {deskTab === "racecards" && r.distance
                            ? ` · ${r.distance}`
                            : ""}
                        </small>
                      </td>
                      <td>
                        {deskTab === "racecards" ? (
                          <span
                            className={`ld-surface ld-surface-${r.surface?.toLowerCase()}`}
                          >
                            {r.surface}
                          </span>
                        ) : (
                          (r.detail ?? dash)
                        )}
                      </td>
                      <td>
                        {deskTab === "racecards"
                          ? r.runners
                          : deskTab === "workouts"
                            ? r.distance
                            : (r.margin ?? dash)}
                      </td>
                      <td>
                        <button
                          className="ld-row-arrow"
                          aria-label={`View ${r.name} ${deskTab === "racecards" ? "racecard" : deskTab}`}
                          onClick={() =>
                            onOpen(deskPath, `view full ${deskTab}`)
                          }
                        >
                          <Arrow />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
            <div className="ld-table-foot">
              <span>{deskRows.length} shown</span>
              <button onClick={() => onOpen(deskPath, `view all ${deskTab}`)}>
                View all <Arrow />
              </button>
            </div>
          </Panel>
        </section>
        <aside className="ld-overview-aside">
          <SectionTitle number="" title="Overview" />
          <div className="ld-overview-panel">
            <div className="ld-metric-grid">
              {(
                [
                  ["racecards", "Racecards"],
                  ["results", "Results"],
                  ["workouts", "Workouts"],
                  ["stakes", "Stakes"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() =>
                    onOpen(
                      key === "racecards" ? "/entries" : `/${key}`,
                      `view ${label.toLowerCase()}`,
                    )
                  }
                >
                  <strong>{data ? rows(key).length : dash}</strong>
                  <span>
                    {label} <Arrow />
                  </span>
                </button>
              ))}
            </div>
            <div className="ld-overview-links">
              <button
                onClick={() => onOpen("/speed-figures", "view speed figures")}
              >
                Speed figures <Arrow />
              </button>
              <button onClick={() => onOpen("/statistics", "view statistics")}>
                Statistics <Arrow />
              </button>
              <button
                onClick={() => onOpen("/virtual-stable", "open your watchlist")}
              >
                Watchlist <Arrow />
              </button>
            </div>
            <small>Published records shown on this page.</small>
          </div>
        </aside>
      </div>

      <section id="leaderboard" className="ld-section-space ld-reveal">
        <SectionTitle number="02" title="Leaderboard" />
        <div className="ld-leaders-grid">
          <aside className="ld-horse-feature ld-fixed-feature">
            <span className="ld-kicker">HORSE / TOP FIGURE</span>
            {featured ? (
              <div className="ld-feature-horse-copy ld-record-feature">
                <div className="ld-horse-emblem">
                  <Brand />
                </div>
                <h3>{featured.name}</h3>
                {featured.detail && <p>{featured.detail}</p>}
                <div className="ld-horse-stats">
                  <span>
                    <strong>{featured.starts ?? dash}</strong>
                    <small>STARTS</small>
                  </span>
                  <span>
                    <strong>{featured.wins ?? dash}</strong>
                    <small>WINS</small>
                  </span>
                  <span>
                    <strong>{featured.figure ?? dash}</strong>
                    <small>FIGURE</small>
                  </span>
                </div>
                <button
                  onClick={() => onOpen("/speed-figures", "view speed figures")}
                >
                  View figures <Arrow />
                </button>
              </div>
            ) : (
              <Empty label="horses" {...emptyState} />
            )}
          </aside>
          <Panel className="ld-leader-table">
            <div className="ld-table-toolbar">
              <div className="ld-tabs" aria-label="Leaderboard categories">
                {(["horses", "jockeys", "trainers"] as const).map((tab) => (
                  <button
                    key={tab}
                    aria-pressed={leaderTab === tab}
                    onClick={() => setLeaderTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <TableRegion
              {...emptyState}
              key={leaderTab}
              label="Standings"
              empty={!leaderRows.length}
            >
              <table className="ld-table ld-standings-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Starts</th>
                    <th>Wins</th>
                    <th>{leaderTab === "horses" ? "Figure" : "Win %"}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderRows.map((r, i) => (
                    <tr
                      key={r.id}
                      style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                    >
                      <td>
                        <span
                          className={`ld-rank${i === 0 ? " ld-rank-first" : ""}`}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </td>
                      <td>
                        <button
                          className="ld-table-name"
                          onClick={() =>
                            onOpen("/statistics", "view statistics")
                          }
                        >
                          {r.name}
                        </button>
                        <small>{r.detail}</small>
                      </td>
                      <td>{r.starts ?? dash}</td>
                      <td>{r.wins ?? dash}</td>
                      <td className="ld-figure">
                        {leaderTab === "horses"
                          ? (r.figure ?? dash)
                          : winRate(r)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
            <div className="ld-table-foot">
              <span>{leaderRows.length} shown</span>
              <button onClick={() => onOpen("/statistics", "view statistics")}>
                All statistics <Arrow />
              </button>
            </div>
          </Panel>
        </div>
      </section>

      <div className="ld-bottom-grid ld-section-space">
        <section id="stakes-diary" className="ld-reveal">
          <SectionTitle number="03" title="Stakes" />
          <Panel>
            <div className="ld-table-toolbar">
              <div className="ld-tabs" aria-label="Stakes views">
                {(["stakes", "results"] as const).map((tab) => (
                  <button
                    key={tab}
                    aria-pressed={stakesTab === tab}
                    onClick={() => setStakesTab(tab)}
                  >
                    {tab === "stakes" ? "Schedule" : "Results"}
                  </button>
                ))}
              </div>
            </div>
            <div className="ld-panel-scroll ld-stakes-scroll" key={stakesTab}>
              {rows(stakesTab).length ? (
                rows(stakesTab).map((r) => {
                  const date = dateParts(r.date);
                  return (
                    <button
                      className="ld-diary-row"
                      key={r.id}
                      onClick={() =>
                        onOpen(
                          stakesTab === "stakes" ? "/stakes" : "/results",
                          `view ${stakesTab}`,
                        )
                      }
                    >
                      <span className="ld-date-block">
                        <strong>{date.day}</strong>
                        <small>{date.month}</small>
                      </span>
                      <span>
                        <strong>{r.name}</strong>
                        <small>
                          {[r.track, r.surface, r.distance]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      <Arrow />
                    </button>
                  );
                })
              ) : (
                <Empty label={stakesTab} {...emptyState} />
              )}
            </div>
            <div className="ld-table-foot">
              <span>{rows(stakesTab).length} shown</span>
              <button
                onClick={() => onOpen("/stakes", "view the stakes calendar")}
              >
                Full calendar <Arrow />
              </button>
            </div>
          </Panel>
        </section>
        <section id="field-notes" className="ld-reveal">
          <SectionTitle number="04" title="News & updates" />
          <Panel className="ld-news-panel">
            <div className="ld-panel-scroll">
              {rows("notes").length ? (
                rows("notes").map((note) => (
                  <article className="ld-news-record" key={note.id}>
                    <span className="ld-kicker">{note.category}</span>
                    <h3>{note.name}</h3>
                    <p>{note.summary}</p>
                    <button
                      className="ld-note-toggle"
                      aria-expanded={openNote === note.id}
                      aria-controls={`note-${note.id}`}
                      onClick={() =>
                        setOpenNote(openNote === note.id ? null : note.id)
                      }
                    >
                      {openNote === note.id ? "Close" : "Read more"}{" "}
                      <span aria-hidden="true">
                        {openNote === note.id ? "−" : "+"}
                      </span>
                    </button>
                    {openNote === note.id && (
                      <div className="ld-note-expanded" id={`note-${note.id}`}>
                        <p>{note.body}</p>
                      </div>
                    )}
                  </article>
                ))
              ) : (
                <Empty label="updates" {...emptyState} />
              )}
            </div>
            <div className="ld-table-foot">
              <span>{rows("notes").length} published</span>
              <button onClick={onSignup}>
                Create an account <Arrow />
              </button>
            </div>
          </Panel>
        </section>
      </div>
    </>
  );
}
