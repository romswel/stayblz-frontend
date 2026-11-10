import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DateNav, Empty, LoadNotice, RacingHead, useRacing, useRacingDate } from "../../components/racing/RacingParts";
import { breedLabels, dateLabel, odds, raceTypeLabels, shiftDate } from "../../components/racing/format";
import type { DaySummary } from "../../components/racing/types";

/** Entries (upcoming cards) or Results (official races) for one date, track by track. */
export default function RaceDays({ mode }: { mode: "entries" | "results" }) {
  const [search, setSearch] = useSearchParams();
  const [date, setDate] = useRacingDate(search, setSearch);
  const days = useRacing<{ days: DaySummary[] }>(`/api/public/racing/days?date=${date}`);
  const calendar = useRacing<{ days: { date: string }[] }>(
    `/api/public/racing/calendar?from=${shiftDate(date, -21)}&to=${shiftDate(date, 21)}`,
  );
  const racingDates = useMemo(() => new Set((calendar.data?.days ?? []).map((d) => d.date)), [calendar.data]);
  const list = days.data?.days ?? [];
  const nearest = useMemo(() => {
    const dates = [...racingDates].sort();
    return { before: dates.filter((d) => d < date).pop(), after: dates.find((d) => d > date) };
  }, [racingDates, date]);

  return (
    <div className="rc-page">
      <RacingHead
        eyebrow={mode === "entries" ? "Racecards" : "Results & charts"}
        title={mode === "entries" ? "Entries" : "Results"}
        sub={
          mode === "entries"
            ? "Race cards published on Stayblz, track by track. Open a card for every runner, rider and trainer."
            : "Official results published on Stayblz. Open a race for the full chart and payouts."
        }
      />
      <DateNav date={date} onChange={setDate} racingDates={racingDates} />
      <h2 className="rc-date-title">{dateLabel(date)}</h2>
      <LoadNotice loading={days.loading && !days.data} error={days.error} retry={days.retry} />
      {days.data && !list.length && (
        <Empty title={`No racing published for ${dateLabel(date, "short")}`}>
          {nearest.after || nearest.before ? (
            <>
              Try{" "}
              {nearest.after && (
                <button type="button" className="rc-linkish" onClick={() => setDate(nearest.after!)}>
                  {dateLabel(nearest.after, "short")}
                </button>
              )}
              {nearest.after && nearest.before && " or "}
              {nearest.before && (
                <button type="button" className="rc-linkish" onClick={() => setDate(nearest.before!)}>
                  {dateLabel(nearest.before, "short")}
                </button>
              )}
              .
            </>
          ) : (
            "Cards appear here as our team publishes them."
          )}
        </Empty>
      )}
      <div className={`rc-day-grid${days.loading ? " is-refreshing" : ""}`}>
        {list.map((day) => {
          const races = mode === "results" ? day.raceList.filter((r) => r.status === "official") : day.raceList;
          return (
            <article key={day.id} className="panel rc-day-card">
              <header>
                <div>
                  <h3>
                    <Link to={`/racing/days/${day.id}`}>{day.track.name}</Link>
                  </h3>
                  <p className="rc-facts">
                    <span>{day.track.code}</span>
                    {day.track.region && <span>{day.track.region}</span>}
                    <span>{breedLabels[day.track.breed]}</span>
                    <span>
                      {day.races} {day.races === 1 ? "race" : "races"}
                    </span>
                    {day.firstPost && <span>First post {day.firstPost}</span>}
                    {day.stakes > 0 && <span className="rc-badge">Stakes</span>}
                  </p>
                </div>
                <Link className="btn btn-quiet" to={`/racing/days/${day.id}`}>
                  Full card
                </Link>
              </header>
              {day.notes && <p className="rc-day-notes">{day.notes}</p>}
              {mode === "results" && !races.length ? (
                <p className="rc-muted">No official results yet for this card.</p>
              ) : (
                <ol className="rc-race-list">
                  {races.map((race) => (
                    <li key={race.id}>
                      <Link to={`/racing/races/${race.id}`}>
                        <span className="rc-race-chip">R{race.number}</span>
                        <span className="rc-race-line">
                          <strong>{race.name || raceTypeLabels[race.type] || "Race"}</strong>
                          <small>
                            {[race.postTime, race.distance, race.grade ? `G${race.grade}` : ""].filter(Boolean).join(" · ")}
                            {mode === "entries" && ` · ${race.runnerCount} runners`}
                          </small>
                        </span>
                        {race.status === "official" && race.winner ? (
                          <span className="rc-winner">
                            1st {race.winner.horse}
                            {race.winner.odds != null && <small> {odds(race.winner.odds)}</small>}
                          </span>
                        ) : (
                          <span className={`rc-status rc-status-${race.status}`}>
                            {race.status === "cancelled" ? "Cancelled" : race.status === "official" ? "Official" : "Entries"}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
