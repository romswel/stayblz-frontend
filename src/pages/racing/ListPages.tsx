import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Empty, LoadNotice, RacingHead, useRacing } from "../../components/racing/RacingParts";
import { breedLabels, dateLabel, money, shiftDate, todayISO, winPct } from "../../components/racing/format";
import type { Race, Track, Workout } from "../../components/racing/types";
import { WorkoutTable } from "./ProfilePages";

export function WorkoutsPage() {
  const [search, setSearch] = useSearchParams();
  const to = search.get("to") ?? todayISO();
  const from = search.get("from") ?? shiftDate(to, -6);
  const track = search.get("track") ?? "";
  const [query, setQuery] = useState("");
  const path = `/api/public/racing/workouts?from=${from}&to=${to}${track ? `&track=${encodeURIComponent(track)}` : ""}`;
  const { data, loading, error, retry } = useRacing<{ workouts: Workout[] }>(path);
  const tracks = useMemo(() => {
    const seen = new Map<string, string>();
    for (const work of data?.workouts ?? []) seen.set(work.track.code, work.track.name);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const shown = (data?.workouts ?? []).filter((w) => !query.trim() || w.horse.name.toLowerCase().includes(query.trim().toLowerCase()));
  const update = (next: Record<string, string>) => {
    const copy = new URLSearchParams(search);
    for (const [key, value] of Object.entries(next)) value ? copy.set(key, value) : copy.delete(key);
    setSearch(copy, { replace: true });
  };
  return (
    <div className="rc-page">
      <RacingHead eyebrow="Training" title="Workouts" sub="Published morning works, newest first. Bullet works (fastest of the day) are highlighted." />
      <div className="rc-filters">
        <label>
          From
          <input type="date" value={from} max={to} onChange={(e) => e.target.value && update({ from: e.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={to} min={from} onChange={(e) => e.target.value && update({ to: e.target.value })} />
        </label>
        <label>
          Track
          <select value={track} onChange={(e) => update({ track: e.target.value })}>
            <option value="">All tracks</option>
            {tracks.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
            {track && !tracks.some(([code]) => code === track) && <option value={track}>{track}</option>}
          </select>
        </label>
        <label>
          Horse
          <input type="search" placeholder="Filter by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <LoadNotice loading={loading && !data} error={error} retry={retry} />
      {data && !shown.length && <Empty title="No published workouts for these dates">Try a wider date range or another track.</Empty>}
      {shown.length > 0 && <WorkoutTable workouts={shown} />}
    </div>
  );
}

type StakesRace = Race & { date: string; dayId: string; track: Track };
export function StakesPage() {
  const [past, setPast] = useState(false);
  const today = todayISO();
  const path = past
    ? `/api/public/racing/stakes?from=${shiftDate(today, -365)}&to=${shiftDate(today, -1)}`
    : `/api/public/racing/stakes?from=${today}&to=${shiftDate(today, 365)}`;
  const { data, loading, error, retry } = useRacing<{ races: StakesRace[] }>(path);
  const races = useMemo(() => {
    const list = data?.races ?? [];
    return past ? [...list].reverse() : list;
  }, [data, past]);
  const months = useMemo(() => {
    const groups = new Map<string, StakesRace[]>();
    for (const race of races) {
      const key = race.date.slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), race]);
    }
    return [...groups.entries()];
  }, [races]);
  return (
    <div className="rc-page">
      <RacingHead eyebrow="Feature races" title="Stakes schedule" sub="Stakes races on published cards, with grade, purse and the winner once official." />
      <div className="up-chips rc-toggle" role="group" aria-label="Show">
        <button type="button" className="up-chip" aria-pressed={!past} onClick={() => setPast(false)}>
          Upcoming
        </button>
        <button type="button" className="up-chip" aria-pressed={past} onClick={() => setPast(true)}>
          Past year
        </button>
      </div>
      <LoadNotice loading={loading && !data} error={error} retry={retry} />
      {data && !races.length && <Empty title={past ? "No stakes results in the past year" : "No upcoming stakes published"} />}
      {months.map(([month, list]) => (
        <section key={month} className="rc-month" aria-label={month}>
          <h2 className="rc-section-title">
            {new Date(month + "-15T12:00:00Z").toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
          </h2>
          <div className="table-wrap rc-table-wrap">
            <table className="data rc-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Race</th>
                  <th scope="col">Grade</th>
                  <th scope="col">Track</th>
                  <th scope="col">Distance</th>
                  <th scope="col">Purse</th>
                  <th scope="col">{past ? "Winner" : "Field"}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((race) => (
                  <tr key={race.id}>
                    <td>{dateLabel(race.date, "short")}</td>
                    <td>
                      <Link to={`/racing/races/${race.id}`}>{race.name || `Race ${race.number}`}</Link>
                      <small className="rc-pedigree">{breedLabels[race.breed]}</small>
                    </td>
                    <td>{race.grade ? `G${race.grade}` : "—"}</td>
                    <td>
                      <Link to={`/racing/days/${race.dayId}`}>{race.track.name}</Link>
                    </td>
                    <td>{race.distance || "—"}</td>
                    <td>{money(race.purse, race.currency)}</td>
                    <td>
                      {race.winner ? (
                        <Link to={`/racing/horses/${race.winner.horseId}`}>{race.winner.horse}</Link>
                      ) : (
                        `${race.runnerCount} runners`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

type Leader = { id: string; name: string; starts: number; wins: number; places: number; shows: number; earnings: number };
const roles = [
  { role: "jockey", label: "Jockeys & drivers" },
  { role: "trainer", label: "Trainers" },
  { role: "owner", label: "Owners" },
  { role: "horse", label: "Horses" },
] as const;
export function LeadersPage() {
  const [search, setSearch] = useSearchParams();
  const role = roles.some((r) => r.role === search.get("role")) ? (search.get("role") as string) : "jockey";
  const thisYear = new Date().getFullYear();
  const year = search.get("year") ?? String(thisYear);
  const breed = search.get("breed") ?? "";
  const { data, loading, error, retry } = useRacing<{ leaders: Leader[] }>(
    `/api/public/racing/leaders?role=${role}${year !== "all" ? `&year=${year}` : ""}${breed ? `&breed=${breed}` : ""}`,
  );
  const update = (key: string, value: string) => {
    const copy = new URLSearchParams(search);
    copy.set(key, value);
    setSearch(copy, { replace: true });
  };
  const leaders = data?.leaders ?? [];
  return (
    <div className="rc-page">
      <RacingHead
        eyebrow="Statistics"
        title="Leaders"
        sub="Standings from official results published on Stayblz only. They are not complete season records."
      />
      <div className="rc-filters">
        <div className="up-chips" role="group" aria-label="Who">
          {roles.map((item) => (
            <button key={item.role} type="button" className="up-chip" aria-pressed={role === item.role} onClick={() => update("role", item.role)}>
              {item.label}
            </button>
          ))}
        </div>
        <label>
          Year
          <select value={year} onChange={(e) => update("year", e.target.value)}>
            {Array.from({ length: 6 }, (_, i) => String(thisYear - i)).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
            <option value="all">All years</option>
          </select>
        </label>
        <label>
          Racing
          <select value={breed} onChange={(e) => update("breed", e.target.value)}>
            <option value="">All</option>
            <option value="thoroughbred">Thoroughbred</option>
            <option value="harness">Harness</option>
            <option value="quarter_horse">Quarter Horse</option>
          </select>
        </label>
      </div>
      <LoadNotice loading={loading && !data} error={error} retry={retry} />
      {data && !leaders.length && <Empty title="No official results for these filters yet" />}
      {leaders.length > 0 && (
        <div className={`table-wrap rc-table-wrap${loading ? " is-refreshing" : ""}`}>
          <table className="data rc-table rc-leaders">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Name</th>
                <th scope="col">Starts</th>
                <th scope="col">Wins</th>
                <th scope="col">2nd</th>
                <th scope="col">3rd</th>
                <th scope="col">Win %</th>
                <th scope="col">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    <Link to={role === "horse" ? `/racing/horses/${row.id}` : `/racing/people/${row.id}`}>{row.name}</Link>
                  </td>
                  <td>{row.starts}</td>
                  <td>
                    <strong>{row.wins}</strong>
                  </td>
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
    </div>
  );
}
