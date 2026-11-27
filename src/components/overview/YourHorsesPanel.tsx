import { useState } from "react";
import { Link } from "react-router-dom";
import { clock } from "../stayblz-data/formfavUi";
import type { RaceWhere } from "../stayblz-data/formfavApi";
import { dateLabel } from "../racing/format";
import { todayIso } from "../virtual/api";
import { finishOf, ordinal, shiftIso, useRaceWatch, watchHref, type WatchHorse, type WatchList } from "./raceWatch";

type Filter = "all" | "entered" | "tracked" | "mine";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "entered", label: "Entered" },
  { key: "tracked", label: "Tracked" },
  { key: "mine", label: "My horses" },
];
const isMine = (h: WatchHorse) => h.lists.some((l) => l.kind === "owned");
const isTracked = (h: WatchHorse) => h.lists.some((l) => l.kind !== "owned");
const FINISH_LABEL = { win: "Won", place: "Placed", out: "Unplaced" } as const;

const listLabel = (l: WatchList) =>
  l.kind === "owned" ? (l.role === "lead" ? "My horse" : "Co-owned") : l.kind === "personal" ? "My list" : `Team · ${l.stableName}`;

/**
 * Dashboard → Your horses: horses in your Virtual Stayblz (your list and your stables) that follow race data, and your
 * own horses (Account → My horses). Entered ones come first; the latest result is coloured green (won), gold (2nd or
 * 3rd) or grey (unplaced), with "New" for results in the last two days.
 */
export default function YourHorsesPanel({
  version,
  query,
  onRace,
}: {
  version: number;
  query: string;
  onRace: (where: RaceWhere) => void;
}) {
  const { data, error, loading, retry } = useRaceWatch(version);
  const [filter, setFilter] = useState<Filter>("all");
  const all = data?.horses ?? [];
  const matches = (h: WatchHorse) =>
    !query ||
    [h.name, h.race?.nextEntry?.track, h.race?.lastStart?.track, h.race?.trainer, ...h.lists.map(listLabel)].some((v) =>
      v?.toLocaleLowerCase().includes(query),
    );
  const pass = (h: WatchHorse, f: Filter) =>
    f === "all" ? true : f === "entered" ? !!h.race?.nextEntry : f === "tracked" ? isTracked(h) : isMine(h);
  const searched = all.filter(matches);
  const shown = searched.filter((h) => pass(h, filter));
  const recentFrom = shiftIso(todayIso(), -2);

  if (!data && loading) return <p className="gd-empty" role="status">Loading your horses…</p>;
  if (!data && error)
    return (
      <div className="gd-empty" role="status">
        {error}{" "}
        <button type="button" className="gd-link-btn" onClick={retry}>
          Try again
        </button>
      </div>
    );
  if (!all.length)
    return (
      <div className="gd-empty gd-yh-empty">
        <p>No horses to show yet. Track US &amp; Canada racing horses in Virtual Stayblz, or link your own horses to race data.</p>
        <div className="gd-yh-empty-links">
          <Link className="gd-btn" to="/my-racing?tab=virtual&vtab=racing">
            Find racing horses
          </Link>
          <Link className="gd-btn gd-btn-ghost" to="/account/horses">
            My horses
          </Link>
        </div>
      </div>
    );

  return (
    <div className="gd-yh">
      <div className="gd-panel-toolbar">
        <div className="gd-seg" role="group" aria-label="Show horses">
          {FILTERS.map((f) => (
            <button type="button" key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label} <span className="gd-seg-count">{searched.filter((h) => pass(h, f.key)).length}</span>
            </button>
          ))}
        </div>
        {error && (
          <span role="status">
            Couldn't refresh.{" "}
            <button type="button" className="gd-link-btn" onClick={retry}>
              Retry
            </button>
          </span>
        )}
        {data?.building && !error && <span role="status">Race data is still loading…</span>}
      </div>
      {shown.length ? (
        <ul className="gd-yh-list">
          {shown.map((h) => {
            const last = h.race?.lastStart ?? null;
            const next = h.race?.nextEntry ?? null;
            const finish = finishOf(last?.position);
            const isNew = !!last && last.date >= recentFrom;
            const lastWhere: RaceWhere | null =
              last && last.raceNumber && last.code && last.country
                ? { date: last.date, code: last.code, tz: last.timezone ?? "America/New_York", track: last.slug, race: last.raceNumber, country: last.country }
                : null;
            const nextWhere: RaceWhere | null =
              next && next.raceNumber
                ? { date: next.date, code: next.code, tz: next.timezone, track: next.slug, race: next.raceNumber, country: next.country }
                : null;
            return (
              <li key={h.key} className={`gd-yh-row${finish ? ` is-${finish}` : ""}`} data-finish={finish ?? "none"}>
                <span className={`gd-yh-dot${finish ? ` is-${finish}` : ""}`} aria-hidden="true" />
                <div className="gd-yh-main">
                  <div className="gd-yh-head">
                    <Link className="gd-yh-name" to={watchHref(h)}>
                      {h.name}
                    </Link>
                    {next && <span className="gd-tag gd-tag-entered">Entered</span>}
                    {isNew && finish && <span className="gd-tag gd-tag-new">New</span>}
                  </div>
                  <div className="gd-yh-lists">
                    {h.lists.map((l) => (
                      <span key={`${l.kind}${l.id}`} className="gd-yh-list-chip">
                        {listLabel(l)}
                      </span>
                    ))}
                  </div>
                  {next && (
                    <p className="gd-yh-line">
                      <b>Next:</b>{" "}
                      {nextWhere ? (
                        <button type="button" className="gd-link-btn" onClick={() => onRace(nextWhere)}>
                          {raceText(next.date, next.startTime, next.track, next.raceNumber)}
                        </button>
                      ) : (
                        raceText(next.date, next.startTime, next.track, next.raceNumber)
                      )}
                    </p>
                  )}
                  {last && (
                    <p className="gd-yh-line">
                      <b className={finish ? `gd-yh-finish is-${finish}` : undefined}>
                        {finish ? `${FINISH_LABEL[finish]} · ` : ""}
                        {last.position ? ordinal(last.position) : "Ran"}
                        {last.fieldSize ? ` of ${last.fieldSize}` : ""}
                      </b>{" "}
                      {lastWhere ? (
                        <button type="button" className="gd-link-btn" onClick={() => onRace(lastWhere)}>
                          {raceText(last.date, null, last.track, last.raceNumber ?? null)}
                        </button>
                      ) : (
                        raceText(last.date, null, last.track, last.raceNumber ?? null)
                      )}
                    </p>
                  )}
                  {!h.linked && (
                    <p className="gd-yh-line gd-yh-muted">
                      Not linked to race data.{" "}
                      <Link to={`/account/horses?edit=${h.lists[0]?.id ?? ""}`}>Link it</Link>
                    </p>
                  )}
                  {h.linked && !h.race && <p className="gd-yh-line gd-yh-muted">No US or Canada runs in the last 30 days.</p>}
                </div>
                {h.race && (
                  <div className="gd-yh-side">
                    <span className="gd-yh-record" title="Starts – wins – top three, last 30 days">
                      {h.race.starts}–{h.race.wins}–{h.race.places}
                    </span>
                    {h.race.recent.length > 0 && (
                      <span className="gd-yh-recent" aria-label={`Recent finishes: ${h.race.recent.map((r) => (r.position ? ordinal(r.position) : "—")).join(", ")}`}>
                        {h.race.recent.map((r, i) => (
                          <span key={i} className={`gd-yh-pip${finishOf(r.position) ? ` is-${finishOf(r.position)}` : ""}`} title={`${r.position ? ordinal(r.position) : "—"} · ${r.date}`}>
                            {r.position ?? "–"}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="gd-empty" role="status">
          {query ? "None of your horses match your search." : filter === "entered" ? "None of your horses are entered right now." : "No horses here."}
        </p>
      )}
      <p className="gd-footnote">
        Green: won · Gold: 2nd or 3rd · Grey: unplaced. Race data: US &amp; Canada, last 30 days and the next 2.
      </p>
    </div>
  );
}

function raceText(date: string, start: string | null, track: string | null, race: number | null) {
  const time = clock(start);
  return [dateLabel(date, "short").replace(/,? \d{4}$/, ""), time, [track, race ? `R${race}` : null].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
}
