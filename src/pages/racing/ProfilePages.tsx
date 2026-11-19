import { Link, useParams } from "react-router-dom";
import { Empty, LoadNotice, RacingHead, useRacing } from "../../components/racing/RacingParts";
import { breedLabels, dateLabel, money, odds, ordinal, surfaceLabels, winPct } from "../../components/racing/format";
import { sourceLabels, type HistoryStart, type Horse, type Start, type Stats, type Workout } from "../../components/racing/types";
import StatusPage from "../../components/status/StatusPage";
import FollowButtons from "../../components/racing/FollowButtons";

function StatTiles({ stats }: { stats: Stats }) {
  const tiles = [
    ["Starts", stats.starts],
    ["Wins", stats.wins],
    ["2nd", stats.places],
    ["3rd", stats.shows],
    ["Win rate", winPct(stats.wins, stats.starts)],
    ["Earnings", money(stats.earnings)],
  ] as const;
  return (
    <dl className="rc-stats">
      {tiles.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StartsTable({ starts, show }: { starts: Start[]; show: "horse" | "person" }) {
  if (!starts.length) return <p className="rc-muted">No published starts yet.</p>;
  return (
    <div className="table-wrap rc-table-wrap">
      <table className="data rc-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Track</th>
            <th scope="col">Race</th>
            {show === "person" && <th scope="col">Horse</th>}
            <th scope="col">Distance</th>
            <th scope="col">Fin</th>
            <th scope="col">Odds</th>
            {show === "horse" && <th scope="col">Jockey/driver</th>}
            <th scope="col">Trainer</th>
            <th scope="col">Earned</th>
          </tr>
        </thead>
        <tbody>
          {starts.map((start) => (
            <tr key={start.runnerId} className={start.finish === 1 ? "is-winner" : start.scratched ? "is-scratched" : undefined}>
              <td>
                <Link to={`/racing/races/${start.raceId}`}>{dateLabel(start.date, "short")}</Link>
              </td>
              <td title={start.track}>{start.trackCode}</td>
              <td>
                R{start.race}
                {start.raceName && <small className="rc-pedigree">{start.raceName}</small>}
              </td>
              {show === "person" && (
                <td>
                  <Link to={`/racing/horses/${start.horse.id}`}>{start.horse.name}</Link>
                </td>
              )}
              <td>
                {start.distance} {surfaceLabels[start.surface]?.toLowerCase()}
              </td>
              <td>
                {start.scratched
                  ? "SCR"
                  : start.status === "official"
                    ? `${ordinal(start.finish)}/${start.field}`
                    : start.status === "cancelled"
                      ? "Cancelled"
                      : "Entered"}
              </td>
              <td>{odds(start.odds)}</td>
              {show === "horse" && <td>{start.jockey ? <Link to={`/racing/people/${start.jockey.id}`}>{start.jockey.name}</Link> : "—"}</td>}
              <td>{start.trainer ? <Link to={`/racing/people/${start.trainer.id}`}>{start.trainer.name}</Link> : "—"}</td>
              <td>{start.earnings != null ? money(start.earnings) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const notPublished = (what: string) => (
  <StatusPage
    kind="not-found"
    title={`That ${what} isn't on Stayblz yet`}
    message={`We only show a ${what} once they appear in published racing. Try searching the overview instead.`}
    actions={
      <Link className="btn btn-primary status-primary" to="/entries">
        See entries
      </Link>
    }
  />
);

export function HorsePage() {
  const { id = "" } = useParams();
  const { data, loading, error, missing, retry } = useRacing<{ horse: Horse; stats: Stats; starts: Start[]; workouts: Workout[]; history?: HistoryStart[] }>(
    `/api/public/racing/horses/${encodeURIComponent(id)}`,
  );
  if (missing) return notPublished("horse");
  const horse = data?.horse;
  const facts = horse
    ? [
        breedLabels[horse.breed],
        horse.sex && horse.sex.charAt(0).toUpperCase() + horse.sex.slice(1),
        horse.color,
        horse.foaled ? `Foaled ${horse.foaled}` : "",
        horse.breeder ? `Bred by ${horse.breeder}` : "",
      ].filter(Boolean)
    : [];
  return (
    <div className="rc-page">
      <RacingHead
        eyebrow="Horse"
        title={horse ? `${horse.name}${horse.country ? ` (${horse.country})` : ""}` : "Horse"}
        sub={facts.join(" · ")}
        actions={horse ? <FollowButtons target="horse" id={horse.id} name={horse.name} /> : undefined}
      />
      <LoadNotice loading={loading && !data} error={error} retry={retry} />
      {data && horse && (
        <div className="rc-profile">
          <section className="panel rc-pedigree-card" aria-label="Pedigree">
            <h2>Pedigree</h2>
            <dl>
              <div>
                <dt>Sire</dt>
                <dd>{horse.sire || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Dam</dt>
                <dd>{horse.dam || "Not recorded"}</dd>
              </div>
              <div>
                <dt>Dam's sire</dt>
                <dd>{horse.damSire || "Not recorded"}</dd>
              </div>
            </dl>
          </section>
          <section className="rc-profile-main" aria-label="Record">
            <h2 className="rc-section-title">Record on Stayblz</h2>
            <StatTiles stats={data.stats} />
            <h2 className="rc-section-title">Starts</h2>
            <StartsTable starts={data.starts} show="horse" />
            <h2 className="rc-section-title">Workouts</h2>
            {data.workouts.length ? (
              <WorkoutTable workouts={data.workouts} showHorse={false} />
            ) : (
              <p className="rc-muted">No published workouts yet.</p>
            )}
            {!!data.history?.length && <EarlierStarts history={data.history} />}
          </section>
        </div>
      )}
    </div>
  );
}

type PersonData = {
  person: { id: string; name: string; kind: string; country: string };
  stats: Stats;
  byYear: (Stats & { year: number })[];
  upcoming: Start[];
  recent: Start[];
};
export function PersonPage() {
  const { id = "" } = useParams();
  const { data, loading, error, missing, retry } = useRacing<PersonData>(`/api/public/racing/people/${encodeURIComponent(id)}`);
  if (missing) return notPublished("person");
  const kind = data?.person.kind ?? "";
  return (
    <div className="rc-page">
      <RacingHead
        eyebrow={kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : "Connections"}
        title={data?.person.name ?? "Profile"}
        sub={data?.person.country}
        actions={data ? <FollowButtons target="person" id={data.person.id} name={data.person.name} /> : undefined}
      />
      <LoadNotice loading={loading && !data} error={error} retry={retry} />
      {data && (
        <div className="rc-profile-main">
          <h2 className="rc-section-title">Record on Stayblz</h2>
          <StatTiles stats={data.stats} />
          {data.byYear.length > 1 && (
            <div className="table-wrap rc-table-wrap">
              <table className="data rc-table">
                <caption className="sr-only">Record by year</caption>
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Starts</th>
                    <th scope="col">Wins</th>
                    <th scope="col">2nd</th>
                    <th scope="col">3rd</th>
                    <th scope="col">Win %</th>
                    <th scope="col">Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byYear.map((row) => (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      <td>{row.starts}</td>
                      <td>{row.wins}</td>
                      <td>{row.places}</td>
                      <td>{row.shows}</td>
                      <td>{winPct(row.wins, row.starts)}</td>
                      <td>{money(row.earnings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h2 className="rc-section-title">Upcoming</h2>
          {data.upcoming.length ? <StartsTable starts={data.upcoming} show="person" /> : <p className="rc-muted">No published entries ahead.</p>}
          <h2 className="rc-section-title">Recent results</h2>
          <StartsTable starts={data.recent} show="person" />
        </div>
      )}
    </div>
  );
}

/** Earlier starts as the data provider lists them (races that aren't full cards on Stayblz). */
function EarlierStarts({ history }: { history: HistoryStart[] }) {
  const sources = [...new Set(history.map((h) => sourceLabels[h.source] ?? h.source))].join(", ");
  const wins = history.filter((h) => h.finish === 1).length;
  // Some providers give distance, odds and rider for each start; the columns only show when there is something in them.
  const more = { distance: history.some((h) => h.distance), odds: history.some((h) => h.odds != null), rider: history.some((h) => h.rider) };
  return (
    <>
      <h2 className="rc-section-title">Earlier starts</h2>
      <p className="rc-muted">
        {history.length} start{history.length === 1 ? "" : "s"} · {wins} win{wins === 1 ? "" : "s"} · from {sources}. Full charts aren't on Stayblz for
        these races.
      </p>
      <div className="table-wrap rc-table-wrap">
        <table className="data rc-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Track</th>
              <th scope="col">Race</th>
              <th scope="col">Type</th>
              {more.distance && <th scope="col">Distance</th>}
              <th scope="col">Fin</th>
              {more.odds && <th scope="col">Odds</th>}
              {more.rider && <th scope="col">Rider</th>}
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={`${h.date}-${h.trackCode}`} className={h.finish === 1 ? "is-winner" : undefined}>
                <td>{dateLabel(h.date, "short")}</td>
                <td title={h.trackCode}>{h.track || h.trackCode}</td>
                <td className="rc-history-race">{h.name || (h.race ? `R${h.race}` : "—")}</td>
                <td>{h.type || "—"}</td>
                {more.distance && <td>{[h.distance, h.surface ? surfaceLabels[h.surface as keyof typeof surfaceLabels] : ""].filter(Boolean).join(" · ") || "—"}</td>}
                <td>{h.finish ? `${ordinal(h.finish)}${h.fieldSize ? ` of ${h.fieldSize}` : ""}` : "—"}</td>
                {more.odds && <td>{odds(h.odds)}</td>}
                {more.rider && <td>{h.rider || "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function WorkoutTable({ workouts, showHorse = true }: { workouts: Workout[]; showHorse?: boolean }) {
  return (
    <div className="table-wrap rc-table-wrap">
      <table className="data rc-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            {showHorse && <th scope="col">Horse</th>}
            <th scope="col">Track</th>
            <th scope="col">Distance</th>
            <th scope="col">Surface</th>
            <th scope="col">Time</th>
            <th scope="col">Note</th>
            <th scope="col">Rank</th>
          </tr>
        </thead>
        <tbody>
          {workouts.map((work) => (
            <tr key={work.id} className={work.rank === 1 ? "is-winner" : undefined}>
              <td>{dateLabel(work.date, "short")}</td>
              {showHorse && (
                <td>
                  <Link to={`/racing/horses/${work.horse.id}`}>{work.horse.name}</Link>
                </td>
              )}
              <td title={work.track.name}>{work.track.code}</td>
              <td>{work.distance}</td>
              <td>{surfaceLabels[work.surface]}</td>
              <td className="rc-mono">{work.time}</td>
              <td>{work.note || "—"}</td>
              <td>{work.rank && work.rankOf ? `${work.rank}/${work.rankOf}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { Empty };
