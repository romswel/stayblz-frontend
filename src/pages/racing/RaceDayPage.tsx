import { Link, useParams, useSearchParams } from "react-router-dom";
import { Empty, LoadNotice, RaceView, RacingHead, useRacing } from "../../components/racing/RacingParts";
import { breedLabels, dateLabel } from "../../components/racing/format";
import type { RaceDay } from "../../components/racing/types";
import StatusPage from "../../components/status/StatusPage";

/** One track's full card: every race, with entries or the official result. */
export default function RaceDayPage() {
  const { id = "" } = useParams();
  const [search, setSearch] = useSearchParams();
  const { data, loading, error, missing, retry } = useRacing<{ day: RaceDay }>(`/api/public/racing/days/${encodeURIComponent(id)}`);
  if (missing)
    return (
      <StatusPage
        kind="not-found"
        title="That race card isn't published"
        message="It may have been moved or taken down for corrections. Check Entries for the latest cards."
        actions={
          <Link className="btn btn-primary status-primary" to="/entries">
            See entries
          </Link>
        }
      />
    );
  const day = data?.day;
  const selected = Number(search.get("race")) || 0;
  const races = day?.races ?? [];
  const shown = selected ? races.filter((r) => r.number === selected) : races;
  return (
    <div className="rc-page">
      <RacingHead
        eyebrow={day ? `${day.track.code} · ${breedLabels[day.track.breed]}` : "Race card"}
        title={day ? day.track.name : "Race card"}
        sub={day ? dateLabel(day.date) : undefined}
        actions={
          day && (
            <Link className="btn btn-quiet" to={`/entries?date=${day.date}`}>
              All cards that day
            </Link>
          )
        }
      />
      <LoadNotice loading={loading && !data} error={error} retry={retry} />
      {day && (
        <>
          {day.notes && <p className="rc-day-notes panel">{day.notes}</p>}
          {races.length > 1 && (
            <nav className="rc-race-tabs" aria-label="Races">
              <button
                type="button"
                className="up-chip"
                aria-pressed={!selected}
                onClick={() => setSearch({}, { replace: true })}
              >
                All races
              </button>
              {races.map((race) => (
                <button
                  key={race.id}
                  type="button"
                  className={`up-chip rc-race-tab status-${race.status}`}
                  aria-pressed={selected === race.number}
                  onClick={() => setSearch({ race: String(race.number) }, { replace: true })}
                >
                  R{race.number}
                  {race.status === "official" && (
                    <>
                      <span aria-hidden="true"> ✓</span>
                      <span className="sr-only"> (official)</span>
                    </>
                  )}
                </button>
              ))}
            </nav>
          )}
          {!races.length ? (
            <Empty title="No races on this card yet" />
          ) : (
            <div className="rc-races">
              {shown.map((race) => (
                <RaceView key={race.id} race={race} compact={!selected && races.length > 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
