import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import HorsePortrait from "../HorsePortrait";
import { Empty, Icon, Skeletons } from "../community/ui";
import { dateLabel, money, ordinal } from "../racing/format";
import { stayblzData, type HorseDetail, type HorseSummary, type Meta, type Page, type RaceSummary } from "./api";
import { DetailShell, DetailState, errorText, useDetail } from "./detail";

const PAGE_SIZE = 20;

/**
 * HIDDEN (2026-11-24, at the user's request): the Equibase race day (Races / Horses) that Stayblz Data used to show.
 * Stayblz Data now shows FormFav (pages/StayblzData.tsx). Nothing renders this; to bring it back, render
 * <EquibaseTabs tab="races" | "horses" /> from pages/StayblzData.tsx. The backend still serves /api/stayblz-data.
 */
export default function EquibaseTabs({ tab }: { tab: "races" | "horses" }) {
  const [params, setParams] = useSearchParams();
  const track = params.get("track") ?? "";
  const [meta, setMeta] = useState<Meta | null>(null);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [openRace, setOpenRace] = useState<string | null>(null);
  const [openHorse, setOpenHorse] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    stayblzData
      .meta()
      .then((m) => live && setMeta(m))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  // Search waits for a short pause in typing, so each key press isn't a request.
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(q.trim()), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <div className="cm-toolbar gx-glass">
        <label className="cm-search">
          <Icon.Search />
          <input
            type="search"
            value={q}
            maxLength={60}
            placeholder={tab === "races" ? "Search races, race types or winners" : "Search horses by name"}
            aria-label={tab === "races" ? "Search races" : "Search horses"}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="cm-select">
          <span>Track</span>
          <select value={track} onChange={(e) => update("track", e.target.value)}>
            <option value="">All tracks</option>
            {meta?.tracks.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name} ({t.races})
              </option>
            ))}
          </select>
        </label>
      </div>

      {tab === "races" ? (
        <PagedList<RaceSummary>
          key={`races|${track}|${query}`}
          load={(offset, signal) => stayblzData.races({ offset, limit: PAGE_SIZE, track, q: query }, signal)}
          idOf={(r) => r.race_id}
          noun="races"
          empty="No races match"
          render={(r) => <RaceCard race={r} onOpen={() => setOpenRace(r.race_id)} />}
        />
      ) : (
        <PagedList<HorseSummary>
          key={`horses|${track}|${query}`}
          load={(offset, signal) => stayblzData.horses({ offset, limit: PAGE_SIZE, track, q: query }, signal)}
          idOf={(h) => h.horse_refno}
          noun="horses"
          empty="No horses match"
          render={(h) => <HorseCard horse={h} onOpen={() => setOpenHorse(h.horse_refno)} />}
        />
      )}
      {openRace && (
        <RaceDialog
          id={openRace}
          onClose={() => setOpenRace(null)}
          onHorse={(refno) => {
            setOpenRace(null);
            setOpenHorse(refno);
          }}
        />
      )}
      {openHorse && (
        <HorseDialog
          refno={openHorse}
          onClose={() => setOpenHorse(null)}
          onRace={(id) => {
            setOpenHorse(null);
            setOpenRace(id);
          }}
        />
      )}
    </>
  );
}

function PagedList<T>({
  load,
  idOf,
  render,
  noun,
  empty,
}: {
  load: (offset: number, signal: AbortSignal) => Promise<Page<T>>;
  idOf: (item: T) => string;
  render: (item: T) => ReactNode;
  noun: string;
  empty: string;
}) {
  const [items, setItems] = useState<T[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (offset: number) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      const ctrl = new AbortController();
      controller.current = ctrl;
      try {
        const page = await loadRef.current(offset, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setItems((prev) => {
          const base = offset === 0 ? [] : (prev ?? []);
          const seen = new Set(base.map(idOf));
          return [...base, ...page.records.filter((r) => !seen.has(idOf(r)))];
        });
        setNext(page.nextOffset);
        setTotal(page.total);
        setError("");
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(errorText(e, `The ${noun} couldn't be loaded.`));
        setItems((prev) => prev ?? []);
      } finally {
        if (controller.current === ctrl) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [idOf, noun],
  );

  useEffect(() => {
    void fetchPage(0);
    return () => {
      controller.current?.abort();
      controller.current = null;
      busy.current = false;
    };
    // The list is remounted (by key) when the tab, track or search changes.
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || next === null || error) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void fetchPage(next), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, error, fetchPage, items]);

  if (items === null) return <Skeletons kind="card" count={6} />;
  if (!items.length)
    return error ? (
      <div className="cm-error" role="alert">
        {error}{" "}
        <button type="button" className="cm-link" onClick={() => void fetchPage(0)}>
          Try again
        </button>
      </div>
    ) : (
      <Empty title={empty}>
        <p>Try another track or search.</p>
      </Empty>
    );

  return (
    <section className="sd-list" aria-label={noun}>
      <p className="sd-count" role="status">
        Showing {items.length} of {total} {noun}
      </p>
      <div className="cm-grid sd-grid">
        {items.map((item) => (
          <div key={idOf(item)}>{render(item)}</div>
        ))}
      </div>
      {error && (
        <p className="cm-error" role="alert">
          {error}
        </p>
      )}
      {next !== null && (
        <div ref={sentinel} className="sd-more">
          <button type="button" className="cm-btn cm-more" disabled={loading} onClick={() => void fetchPage(next)}>
            {loading ? "Loading…" : error ? "Try again" : `Load more ${noun}`}
          </button>
        </div>
      )}
    </section>
  );
}

function RaceCard({ race, onOpen }: { race: RaceSummary; onOpen: () => void }) {
  return (
    <button type="button" className="sd-card gx-glass" onClick={onOpen}>
      <span className="sd-card-top">
        <span className="sd-track">
          {race.track_name} · Race {race.race_number}
        </span>
        {race.post_time && <span className="sd-time">{race.post_time}</span>}
      </span>
      <strong className="sd-title">{race.race_name ?? race.race_type ?? `Race ${race.race_number}`}</strong>
      <span className="sd-facts">
        {[race.distance, race.surface, race.purse_usd !== null ? `${money(race.purse_usd)} purse` : null, `${race.entries_count} entries`]
          .filter(Boolean)
          .join(" · ")}
      </span>
      {race.race_cancelled ? (
        <span className="sd-pill is-off">Cancelled</span>
      ) : race.results_available && race.winner_horse ? (
        <span className="sd-winner">
          <Icon.Trophy /> {race.winner_horse}
          {race.winner_jockey && <em> · {race.winner_jockey}</em>}
        </span>
      ) : (
        <span className="sd-pill">Results pending</span>
      )}
    </button>
  );
}

/** A stable stand-in portrait per horse (there are no photos in the data). */
const COATS = ["#6b3f22", "#3b2416", "#8a5a33", "#a8794c", "#2b2420", "#7c7570", "#b98b5a"];
const MANES = ["#1d140e", "#2a1d14", "#3a2a1e", "#efe6d4", "#141110"];
function portraitFor(refno: string) {
  let h = 0;
  for (const c of refno) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { coat: COATS[h % COATS.length], mane: MANES[(h >> 3) % MANES.length], blaze: (h >> 6) % 3 === 0 };
}

function HorseCard({ horse, onOpen }: { horse: HorseSummary; onOpen: () => void }) {
  const last = horse.last_start;
  return (
    <button type="button" className="sd-card sd-horse gx-glass" onClick={onOpen}>
      <HorsePortrait {...portraitFor(horse.horse_refno)} size={52} title={horse.horse_name} />
      <span className="sd-horse-main">
        <strong className="sd-title">{horse.horse_name}</strong>
        <span className="sd-facts">
          {horse.starts} starts · {horse.wins} wins · {horse.workouts} workouts
        </span>
        <span className="sd-facts">
          {last ? `Last: ${ordinal(last.finish_position)} at ${last.track_name}, ${dateLabel(last.race_date, "short")}` : "No past starts"}
        </span>
      </span>
      <span className="sd-fig" title="Best speed figure">
        <small>Best fig</small>
        {horse.best_speed_figure ?? "—"}
      </span>
    </button>
  );
}

function RaceDialog({ id, onClose, onHorse }: { id: string; onClose: () => void; onHorse: (refno: string) => void }) {
  const { data: race, error, retry } = useDetail(() => stayblzData.race(id));
  const entries = race
    ? [...race.entries_detail].sort((a, b) =>
        race.results_available
          ? (a.finish_position ?? 99) - (b.finish_position ?? 99)
          : Number(a.post_position ?? 99) - Number(b.post_position ?? 99),
      )
    : [];
  const exotics = race?.exotic_payouts_by_type ? Object.values(race.exotic_payouts_by_type) : [];
  const wps = race?.payouts_by_horse ?? [];
  return (
    <DetailShell label={race ? `${race.track_name} race ${race.race_number}` : "Race"} onClose={onClose}>
      {!race ? (
        <DetailState error={error} retry={retry} />
      ) : (
        <>
          <header className="sd-detail-head">
            <span className="sd-track">
              {race.track_name} · Race {race.race_number} · {dateLabel(race.race_date, "short")}
              {race.post_time && ` · ${race.post_time}`}
            </span>
            <h2>{race.race_name ?? race.race_type}</h2>
            <p className="sd-facts">
              {[
                race.race_type !== race.race_name ? race.race_type : null,
                race.distance,
                race.surface,
                race.track_condition,
                race.age_sex_restriction,
                race.purse_usd !== null ? `${money(race.purse_usd)} purse` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {race.results_available && race.winner_horse && (
              <p className="sd-winner">
                <Icon.Trophy /> {race.winner_horse}
                {race.winner_jockey && <em> · {race.winner_jockey}</em>}
                {race.winner_trainer && <em> · {race.winner_trainer}</em>}
                {race.winning_time && <em> · {race.winning_time}</em>}
              </p>
            )}
          </header>

          <h3>{race.results_available ? "Order of finish" : "Entries"}</h3>
          <div className="sd-table-wrap">
            <table className="sd-table">
              <thead>
                <tr>
                  {race.results_available && <th>Fin</th>}
                  <th>#</th>
                  <th>Horse</th>
                  <th>Jockey</th>
                  <th>Trainer</th>
                  <th>Wt</th>
                  <th>ML</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={`${e.program_number}-${i}`} className={e.is_scratched ? "is-scratched" : undefined}>
                    {race.results_available && <td>{e.is_scratched ? "SCR" : ordinal(e.finish_position)}</td>}
                    <td>{e.program_number ?? "—"}</td>
                    <td>
                      {e.horse_refno ? (
                        <button type="button" className="cm-link" onClick={() => onHorse(e.horse_refno!)}>
                          {e.horse_name}
                        </button>
                      ) : (
                        e.horse_name
                      )}
                      {e.age_sex && <small> {e.age_sex}</small>}
                    </td>
                    <td>{e.jockey ?? "—"}</td>
                    <td>{e.trainer ?? "—"}</td>
                    <td>{e.weight_lbs ?? "—"}</td>
                    <td>{e.ml_odds ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(wps.length > 0 || exotics.length > 0) && (
            <>
              <h3>Payouts</h3>
              <div className="sd-payouts">
                {wps.length > 0 && (
                  <table className="sd-table">
                    <thead>
                      <tr>
                        <th>Horse</th>
                        <th>Win</th>
                        <th>Place</th>
                        <th>Show</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wps.map((p) => (
                        <tr key={p.program_number}>
                          <td>
                            {p.program_number} {p.horse_name}
                          </td>
                          <td>{p.win_payout?.toFixed(2) ?? "—"}</td>
                          <td>{p.place_payout?.toFixed(2) ?? "—"}</td>
                          <td>{p.show_payout?.toFixed(2) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {exotics.length > 0 && (
                  <ul className="sd-exotics">
                    {exotics.map((x) => (
                      <li key={x.raw_label}>
                        <span>{x.raw_label}</span>
                        <span>{x.winning_numbers}</span>
                        <strong>${x.payoff.toFixed(2)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {(race.result_url || race.entry_url) && (
            <p className="sd-source">
              <a href={(race.result_url ?? race.entry_url)!} target="_blank" rel="noopener noreferrer">
                View on Equibase <Icon.Arrow />
              </a>
            </p>
          )}
        </>
      )}
    </DetailShell>
  );
}

function HorseDialog({ refno, onClose, onRace }: { refno: string; onClose: () => void; onRace: (id: string) => void }) {
  const { data: horse, error, retry } = useDetail<HorseDetail>(() => stayblzData.horse(refno));
  return (
    <DetailShell label={horse?.horse_name ?? "Horse"} onClose={onClose}>
      {!horse ? (
        <DetailState error={error} retry={retry} />
      ) : (
        <>
          <header className="sd-detail-head sd-horse-head">
            <HorsePortrait {...portraitFor(horse.horse_refno)} size={64} title={horse.horse_name} />
            <div>
              <h2>{horse.horse_name}</h2>
              <p className="sd-facts">
                {horse.past_starts.length} starts · {horse.workouts.length} workouts
              </p>
              {horse.entered_race_ids.length > 0 && (
                <p className="sd-facts">
                  Entered:{" "}
                  {horse.entered_race_ids.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ", "}
                      <button type="button" className="cm-link" onClick={() => onRace(id)}>
                        {id.replace(/^([A-Z]+)-\d{4}-\d{2}-\d{2}-R(\d+)$/, "$1 Race $2")}
                      </button>
                    </span>
                  ))}
                </p>
              )}
            </div>
          </header>

          <h3>Past starts</h3>
          {horse.past_starts.length ? (
            <div className="sd-table-wrap">
              <table className="sd-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Track</th>
                    <th>Race</th>
                    <th>Type</th>
                    <th>Fin</th>
                    <th>Fig</th>
                  </tr>
                </thead>
                <tbody>
                  {horse.past_starts.map((s) => (
                    <tr key={s.race_id}>
                      <td>{dateLabel(s.race_date, "short")}</td>
                      <td>{s.track_name}</td>
                      <td>{s.race_number}</td>
                      <td>{s.race_type ?? "—"}</td>
                      <td>{ordinal(s.finish_position)}</td>
                      <td>{s.speed_figure ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="sd-muted">No past starts on record.</p>
          )}

          <h3>Workouts</h3>
          {horse.workouts.length ? (
            <div className="sd-table-wrap">
              <table className="sd-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Track</th>
                    <th>Dist</th>
                    <th>Surface</th>
                    <th>Time</th>
                    <th>Note</th>
                    <th>Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {horse.workouts.map((w, i) => (
                    <tr key={`${w.workout_date}-${i}`}>
                      <td>{dateLabel(w.workout_date, "short")}</td>
                      <td>{w.track_name}</td>
                      <td>{w.distance ?? "—"}</td>
                      <td>{w.surface ?? "—"}</td>
                      <td>{w.time ?? "—"}</td>
                      <td>{w.note ?? "—"}</td>
                      <td>{w.rank ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="sd-muted">No recent workouts.</p>
          )}

          {horse.profile_url && (
            <p className="sd-source">
              <a href={horse.profile_url} target="_blank" rel="noopener noreferrer">
                Equibase profile <Icon.Arrow />
              </a>
            </p>
          )}
        </>
      )}
    </DetailShell>
  );
}
