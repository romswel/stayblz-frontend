import { useEffect, useRef, useState } from "react";
import { HorseViewer } from "../community/HorseShare";
import {
  SEX_LABELS,
  STATUS_LABELS,
  community,
  horseImageUrl,
  money,
  type HorseSex,
  type HorseStatus,
  type PublicHorse,
  type PublicHorseFilters,
} from "../community/api";
import AddToVirtualButton from "./AddToVirtualButton";
import { initials } from "./AddVirtualHorseDialog";

const EMPTY: Required<Omit<PublicHorseFilters, "raced">> & { raced: boolean } = {
  q: "",
  breed: "",
  sex: "",
  status: "",
  foaledFrom: "",
  foaledTo: "",
  raced: false,
};
type Filters = typeof EMPTY;
const SEXES = Object.keys(SEX_LABELS).filter(Boolean) as HorseSex[];
const STATUSES = Object.keys(STATUS_LABELS) as HorseStatus[];
const validYear = (v: string) => v === "" || (/^\d{4}$/.test(v) && Number(v) >= 1980 && Number(v) <= 2100);

/**
 * Community horses every Stayblz member can see, as a list: search by name, filter by breed, sex, status,
 * foaling year and "has raced". Each row opens the horse viewer and can be tracked in Virtual Stayblz.
 */
export default function PublicHorsesPanel() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [breeds, setBreeds] = useState<string[]>([]);
  const [horses, setHorses] = useState<PublicHorse[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewing, setViewing] = useState<PublicHorse | null>(null);
  const generation = useRef(0);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const yearsOk = validYear(filters.foaledFrom) && validYear(filters.foaledTo);

  // Typing waits a moment; choices apply straight away. Bad years aren't sent.
  useEffect(() => {
    if (!yearsOk) return;
    const t = setTimeout(() => setApplied({ ...filters, q: filters.q.trim() }), filters.q !== applied.q ? 300 : 0);
    return () => clearTimeout(t);
  }, [filters, yearsOk]);

  useEffect(() => {
    const c = new AbortController();
    community
      .publicHorseBreeds(c.signal)
      .then((r) => !c.signal.aborted && setBreeds(Array.isArray(r.breeds) ? r.breeds : []))
      .catch(() => {
        /* The breed filter just shows no choices. */
      });
    return () => c.abort();
  }, []);

  useEffect(() => {
    const g = ++generation.current;
    const c = new AbortController();
    setHorses(null);
    setNext(null);
    setError("");
    community
      .publicHorses(applied, null, c.signal)
      .then((r) => {
        if (g !== generation.current) return;
        setHorses(r.horses);
        setNext(r.next);
      })
      .catch((e) => g === generation.current && !c.signal.aborted && setError(e instanceof Error ? e.message : "Public horses couldn't be loaded."));
    return () => c.abort();
  }, [applied]);

  async function loadMore() {
    if (!next || more) return;
    const g = generation.current;
    setMore(true);
    try {
      const r = await community.publicHorses(applied, next);
      if (g !== generation.current) return;
      setHorses((h) => [...(h ?? []), ...r.horses.filter((x) => !(h ?? []).some((y) => y.id === x.id))]);
      setNext(r.next);
    } catch (e) {
      if (g === generation.current) setError(e instanceof Error ? e.message : "More horses couldn't be loaded.");
    } finally {
      setMore(false);
    }
  }

  const active = (["breed", "sex", "status", "foaledFrom", "foaledTo"] as const).filter((k) => filters[k]).length + (filters.raced ? 1 : 0);
  const anything = active > 0 || !!filters.q.trim();

  return (
    <section className="vs-public" aria-label="Public horses">
      <div className="vs-pfilters">
        <div className="vs-psearch">
          <label className="vs-field vs-grow">
            <span className="vs-sr">Search public horses by name</span>
            <input type="search" value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Search horses by name" maxLength={60} />
          </label>
          <button
            type="button"
            className="vs-btn vs-pfilter-toggle"
            aria-expanded={showFilters}
            aria-controls="vs-pfilter-panel"
            onClick={() => setShowFilters((v) => !v)}
          >
            Filters{active > 0 && <span className="vs-count">{active}</span>}
          </button>
        </div>
        <div className="vs-pfilter-grid" id="vs-pfilter-panel" data-open={showFilters || undefined}>
          <label className="vs-field">
            <span>Breed</span>
            <select value={filters.breed} onChange={(e) => set("breed", e.target.value)}>
              <option value="">Any breed</option>
              {breeds.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="vs-field">
            <span>Sex</span>
            <select value={filters.sex} onChange={(e) => set("sex", e.target.value)}>
              <option value="">Any</option>
              {SEXES.map((s) => (
                <option key={s} value={s}>{SEX_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="vs-field">
            <span>Status</span>
            <select value={filters.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">Any</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="vs-field">
            <span>Foaled from</span>
            <input inputMode="numeric" value={filters.foaledFrom} onChange={(e) => set("foaledFrom", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2018" aria-invalid={!validYear(filters.foaledFrom) || undefined} />
          </label>
          <label className="vs-field">
            <span>Foaled to</span>
            <input inputMode="numeric" value={filters.foaledTo} onChange={(e) => set("foaledTo", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2024" aria-invalid={!validYear(filters.foaledTo) || undefined} />
          </label>
          <label className="vs-check">
            <input type="checkbox" checked={filters.raced} onChange={(e) => set("raced", e.target.checked)} />
            <span>Has raced</span>
          </label>
          {anything && (
            <button type="button" className="vs-link vs-pclear" onClick={() => setFilters(EMPTY)}>
              Clear all
            </button>
          )}
        </div>
        {!yearsOk && <p className="form-error" role="alert">Enter foaling years as 4 digits between 1980 and 2100.</p>}
      </div>

      <p className="vs-muted" aria-live="polite">
        {horses === null
          ? "Horses Stayblz members have made visible to everyone, most followed first."
          : `${horses.length}${next ? "+" : ""} horse${horses.length === 1 && !next ? "" : "s"}${anything ? " match" : ""}. Most followed first. Open one to see its photos and record.`}
      </p>
      {error && <p className="form-error" role="alert">{error}</p>}

      {horses === null && !error ? (
        <p className="vs-muted" aria-busy="true">Loading public horses…</p>
      ) : horses && horses.length === 0 ? (
        <div className="vs-empty">
          <h3>{anything ? "No public horses match these filters" : "No public horses yet"}</h3>
          {anything && (
            <button type="button" className="vs-btn" onClick={() => setFilters(EMPTY)}>Clear filters</button>
          )}
        </div>
      ) : horses ? (
        <div className="vs-plist" role="table" aria-label="Public horses">
          <div className="vs-prow vs-phead" role="row">
            <span role="columnheader">Horse</span>
            <span role="columnheader">Breed</span>
            <span role="columnheader">Sex · Age</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Record</span>
            <span role="columnheader">Earnings</span>
            <span role="columnheader">Owner</span>
            <span role="columnheader"><span className="vs-sr">Track</span></span>
          </div>
          {horses.map((h) => {
            const age = h.foaledYear ? new Date().getFullYear() - h.foaledYear : null;
            return (
              <div className="vs-prow" role="row" key={h.id} data-horse={h.name}>
                <span role="cell" className="vs-pcell-horse">
                  <button type="button" className="vs-pname" onClick={() => setViewing(h)} aria-label={`Open ${h.name}`}>
                    <span className="vs-thumb" aria-hidden="true">
                      {h.coverImageId ? <img src={horseImageUrl(h.coverImageId)} alt="" loading="lazy" /> : initials(h.name)}
                    </span>
                    <span className="vs-result-text">
                      <strong>{h.name}</strong>
                      <small>{[h.sire, h.dam].filter(Boolean).join(" – ") || "Pedigree not added"}</small>
                      {h.followers !== undefined && <small className="vs-followers">{h.followers} following</small>}
                    </span>
                  </button>
                </span>
                <span role="cell" data-label="Breed">{h.breed || "—"}</span>
                <span role="cell" data-label="Sex · Age">
                  {[h.sex ? SEX_LABELS[h.sex] : "", age !== null ? `${age} yrs` : ""].filter(Boolean).join(" · ") || "—"}
                </span>
                <span role="cell" data-label="Status">
                  <span className={`vs-status is-${h.status}`}>{STATUS_LABELS[h.status] ?? h.status}</span>
                </span>
                <span role="cell" data-label="Record" className="vs-mono">
                  {h.stats.starts ? `${h.stats.wins}-${h.stats.places}-${h.stats.shows} · ${h.stats.starts} start${h.stats.starts === 1 ? "" : "s"}` : "Unraced"}
                </span>
                <span role="cell" data-label="Earnings" className="vs-mono">
                  {h.stats.earningsCents != null ? money(h.stats.earningsCents, true) : "Hidden"}
                </span>
                <span role="cell" data-label="Owner">{h.owner.name}</span>
                <span role="cell" className="vs-pcell-track">
                  <AddToVirtualButton target={{ communityHorseId: h.id }} name={h.name} compact />
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {next && (
        <div className="vs-more">
          <button type="button" className="vs-btn" disabled={more} onClick={() => void loadMore()}>
            {more ? "Loading…" : "Show more horses"}
          </button>
        </div>
      )}
      {viewing && (
        <HorseViewer
          horseId={viewing.id}
          name={viewing.name}
          initial={viewing.coverImageId ? [{ id: viewing.coverImageId, kind: "photo", width: null, height: null, hasPoster: false }] : []}
          startId={viewing.coverImageId ?? ""}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}
