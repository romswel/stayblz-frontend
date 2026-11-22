import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { stallionsApi } from "./api";
import { AVAILABILITY, BREEDS, FEE_STEPS, METHODS, REGION_GROUPS, SORTS, breedLabel, labelOf, regionLabel } from "./options";
import StallionCard from "./StallionCard";
import StallionsNav, { StallionsDisclaimer, useCompare } from "./StallionsNav";
import { StallionsUnderWork } from "./UnderWork";
import type { SearchResult, StallionCard as Card } from "./types";

const TEXT_KEYS = ["q", "sire", "ancestor"] as const;
const FLAG_KEYS = ["privateFee", "video", "inData", "saved"] as const;
const KEYS = ["breed", "region", "feeMin", "feeMax", "availability", "method", ...TEXT_KEYS, ...FLAG_KEYS] as const;

/** Only known filters reach the request (anything odd in the address is ignored). */
function queryOf(params: URLSearchParams, page: number) {
  const out = new URLSearchParams();
  for (const k of KEYS) {
    const v = (params.get(k) ?? "").trim();
    if (v) out.set(k, v.slice(0, 60));
  }
  const sort = params.get("sort");
  if (sort && SORTS.some((s) => s.value === sort)) out.set("sort", sort);
  if (page) out.set("page", String(page));
  return out.toString();
}

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export default function Directory({ signedIn }: { signedIn: boolean }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const compare = useCompare();
  const [paging, setPaging] = useState({ query: "", page: 0 });
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ loading: boolean; error: string; data: SearchResult | null; list: Card[] }>({ loading: true, error: "", data: null, list: [] });
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [text, setText] = useState(() => Object.fromEntries(TEXT_KEYS.map((k) => [k, params.get(k) ?? ""])) as Record<(typeof TEXT_KEYS)[number], string>);
  const baseQuery = queryOf(params, 0);
  // A new filter starts again from the first page.
  const page = paging.query === baseQuery ? paging.page : 0;
  const facets = useRef<SearchResult["facets"]>();

  useEffect(() => {
    const c = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    stallionsApi
      .search(queryOf(params, page), c.signal)
      .then((data) => {
        if (c.signal.aborted) return;
        if (data.facets) facets.current = data.facets;
        setState((s) => ({ loading: false, error: "", data, list: page === 0 ? data.stallions : [...s.list, ...data.stallions.filter((x) => !s.list.some((y) => y.id === x.id))] }));
      })
      .catch((e) => {
        if (c.signal.aborted) return;
        // Keep what's already shown when "Show more" fails.
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Stallions couldn't be loaded." }));
      });
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQuery, page, version]);

  // Typing in the search boxes updates the address after a short pause.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      let changed = false;
      for (const k of TEXT_KEYS) {
        const v = text[k].trim();
        if ((next.get(k) ?? "") !== v) {
          changed = true;
          if (v) next.set(k, v);
          else next.delete(k);
        }
      }
      if (changed) setParams(next, { replace: true });
    }, 350);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const set = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };
  const clear = () => {
    setText({ q: "", sire: "", ancestor: "" });
    const next = new URLSearchParams();
    const sort = params.get("sort");
    if (sort) next.set("sort", sort);
    setParams(next, { replace: true });
  };

  async function toggleSave(s: Card) {
    if (saving) return;
    setSaving(s.id);
    const on = !s.saved;
    const patch = (fn: (x: Card) => Card) => setState((st) => ({ ...st, list: st.list.map((x) => (x.id === s.id ? fn(x) : x)) }));
    patch((x) => ({ ...x, saved: on, saves: Math.max(0, x.saves + (on ? 1 : -1)) }));
    try {
      const r = await stallionsApi.save(s.id, on);
      patch((x) => ({ ...x, saved: r.saved, saves: r.saves }));
    } catch (e) {
      patch((x) => ({ ...x, saved: s.saved, saves: s.saves }));
      setNotice(e instanceof Error ? e.message : "That didn't save. Try again.");
    } finally {
      setSaving(null);
    }
  }

  const chips = useMemo(() => {
    const out: { key: string; label: string; clear: Record<string, string> }[] = [];
    const g = (k: string) => params.get(k) ?? "";
    if (g("breed")) out.push({ key: "breed", label: breedLabel(g("breed")), clear: { breed: "" } });
    if (g("region")) out.push({ key: "region", label: regionLabel(g("region")), clear: { region: "" } });
    if (g("feeMin") || g("feeMax"))
      out.push({ key: "fee", label: `Fee ${g("feeMin") ? `$${Number(g("feeMin")).toLocaleString("en-US")}` : "any"} – ${g("feeMax") ? `$${Number(g("feeMax")).toLocaleString("en-US")}` : "any"}`, clear: { feeMin: "", feeMax: "" } });
    if (g("privateFee")) out.push({ key: "privateFee", label: "Include private fees", clear: { privateFee: "" } });
    if (g("availability")) out.push({ key: "availability", label: labelOf(AVAILABILITY, g("availability")), clear: { availability: "" } });
    if (g("method")) out.push({ key: "method", label: labelOf(METHODS, g("method")), clear: { method: "" } });
    if (g("sire")) out.push({ key: "sire", label: `By ${g("sire")}`, clear: { sire: "" } });
    if (g("ancestor")) out.push({ key: "ancestor", label: `${g("ancestor")} in pedigree`, clear: { ancestor: "" } });
    if (g("video")) out.push({ key: "video", label: "Has video", clear: { video: "" } });
    if (g("inData")) out.push({ key: "inData", label: "Runners in our data", clear: { inData: "" } });
    if (g("saved")) out.push({ key: "saved", label: "Saved by me", clear: { saved: "" } });
    if (g("q")) out.push({ key: "q", label: `“${g("q")}”`, clear: { q: "" } });
    return out;
  }, [params]);

  const { loading, error, data, list } = state;
  const total = data?.total ?? 0;
  const anyListed = (facets.current?.total ?? total) > 0;
  const regions = new Set((facets.current?.regions ?? []).map((r) => r.value));
  const breedsListed = new Set((facets.current?.breeds ?? []).map((b) => b.value));

  return (
    <div className="st-page">
      <StallionsNav
        signedIn={signedIn}
        title="Stallions"
        lead="Find a stallion for your mare: fees, pedigrees, offspring and genetics in one place, and ask the owner directly."
        actions={
          <Link to={signedIn ? "/stallions/manage/new" : "/signup"} className="btn btn-primary">
            List your stallion
          </Link>
        }
      />

      <StallionsUnderWork />

      <section className="st-search gx-glass" aria-label="Search stallions">
        <label className="st-search-main">
          <SearchIcon />
          <input
            type="search"
            value={text.q}
            maxLength={60}
            placeholder="Stallion, farm, town or sire"
            aria-label="Search stallions"
            onChange={(e) => setText((t) => ({ ...t, q: e.target.value }))}
          />
        </label>
        <div className="st-search-row">
          <label className="st-field st-inline">
            <span>Breed</span>
            <select value={params.get("breed") ?? ""} onChange={(e) => set({ breed: e.target.value })}>
              <option value="">All breeds</option>
              {BREEDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                  {facets.current && !breedsListed.has(b.value) ? " (none yet)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="st-field st-inline">
            <span>Stands in</span>
            <select value={params.get("region") ?? ""} onChange={(e) => set({ region: e.target.value })}>
              <option value="">Anywhere</option>
              {REGION_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options
                    .filter((o) => !facets.current || o.value.length === 2 || regions.has(o.value) || params.get("region") === o.value)
                    .map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="st-field st-inline">
            <span>Sort</span>
            <select value={params.get("sort") ?? "popular"} onChange={(e) => set({ sort: e.target.value === "popular" ? "" : e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-quiet st-more-filters" aria-expanded={showFilters} aria-controls="st-filters" onClick={() => setShowFilters((v) => !v)}>
            {showFilters ? "Fewer filters" : "More filters"}
            {chips.length > 0 && <span className="st-count">{chips.length}</span>}
          </button>
        </div>

        {showFilters && (
          <div id="st-filters" className="st-filters">
            <fieldset className="st-field st-range">
              <legend>
                Fee <em>US dollars</em>
              </legend>
              <div>
                <select aria-label="Fee from" value={params.get("feeMin") ?? ""} onChange={(e) => set({ feeMin: e.target.value })}>
                  <option value="">No min</option>
                  {FEE_STEPS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true">–</span>
                <select aria-label="Fee up to" value={params.get("feeMax") ?? ""} onChange={(e) => set({ feeMax: e.target.value })}>
                  <option value="">No max</option>
                  {FEE_STEPS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="st-check">
                <input type="checkbox" checked={!!params.get("privateFee")} onChange={(e) => set({ privateFee: e.target.checked ? "1" : "" })} />
                Include private fees
              </label>
            </fieldset>
            <label className="st-field">
              <span>Bookings</span>
              <select value={params.get("availability") ?? ""} onChange={(e) => set({ availability: e.target.value })}>
                <option value="">Any</option>
                <option value="open">Taking bookings</option>
                <option value="full">Book full</option>
                <option value="private">Approved mares only</option>
              </select>
            </label>
            <label className="st-field">
              <span>Breeding method</span>
              <select value={params.get("method") ?? ""} onChange={(e) => set({ method: e.target.value })}>
                <option value="">Any</option>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>By (sire)</span>
              <input value={text.sire} maxLength={40} placeholder="e.g. his sire's name" onChange={(e) => setText((t) => ({ ...t, sire: e.target.value }))} />
            </label>
            <label className="st-field">
              <span>Has in his pedigree</span>
              <input value={text.ancestor} maxLength={40} placeholder="Any ancestor's name" onChange={(e) => setText((t) => ({ ...t, ancestor: e.target.value }))} />
            </label>
            <div className="st-checks">
              <label className="st-check">
                <input type="checkbox" checked={!!params.get("video")} onChange={(e) => set({ video: e.target.checked ? "1" : "" })} />
                Has video
              </label>
              <label className="st-check">
                <input type="checkbox" checked={!!params.get("inData")} onChange={(e) => set({ inData: e.target.checked ? "1" : "" })} />
                Has runners in Stayblz racing data
              </label>
              {signedIn && (
                <label className="st-check">
                  <input type="checkbox" checked={!!params.get("saved")} onChange={(e) => set({ saved: e.target.checked ? "1" : "" })} />
                  Saved by me
                </label>
              )}
            </div>
          </div>
        )}
      </section>

      {chips.length > 0 && (
        <div className="st-chips" aria-label="Active filters">
          {chips.map((c) => (
            <button
              type="button"
              key={c.key}
              className="st-chip-btn"
              onClick={() => {
                if (c.key in text) setText((t) => ({ ...t, [c.key]: "" }));
                set(c.clear);
              }}
              aria-label={`Remove filter ${c.label}`}
            >
              {c.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button type="button" className="st-link" onClick={clear}>
            Clear all
          </button>
        </div>
      )}

      {notice && (
        <p className="st-alert is-error" role="alert">
          {notice}{" "}
          <button type="button" className="st-link" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </p>
      )}

      <section className="st-results" aria-label="Stallions" aria-busy={loading}>
        {loading && !list.length ? (
          <>
            <p className="st-count-line" role="status">
              Loading stallions…
            </p>
            <ul className="st-grid" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i} className="st-card st-skeleton gx-glass">
                  <span className="st-sk st-sk-photo" />
                  <span className="st-sk st-sk-line" />
                  <span className="st-sk st-sk-line is-short" />
                </li>
              ))}
            </ul>
          </>
        ) : error && !list.length ? (
          <div className="st-empty gx-glass" role="alert">
            <h2>Stallions couldn't be loaded.</h2>
            <p>{error}</p>
            <button type="button" className="btn btn-quiet" onClick={() => setVersion((v) => v + 1)}>
              Try again
            </button>
          </div>
        ) : !list.length ? (
          <div className="st-empty gx-glass">
            {chips.length ? (
              <>
                <h2>No stallions match these filters.</h2>
                <p>Try a wider fee range or another region, or clear the filters.</p>
                <button type="button" className="btn btn-quiet" onClick={clear}>
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <h2>{anyListed ? "No stallions to show." : "No stallions are listed yet."}</h2>
                <p>Stand a stallion? List him with his pedigree, fee, photos and videos, and breeders can ask you about a season.</p>
                <Link to={signedIn ? "/stallions/manage/new" : "/signup"} className="btn btn-primary">
                  List your stallion
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="st-count-line" role="status">
              {loading ? "Updating…" : <><strong>{total}</strong> {total === 1 ? "stallion" : "stallions"}</>}
            </p>
            <ul className={`st-grid${loading ? " is-loading" : ""}`}>
              {list.map((s) => (
                <li key={s.id}>
                  <StallionCard
                    stallion={s}
                    compared={compare.ids.includes(s.id)}
                    compareFull={compare.full}
                    onCompare={() => compare.toggle(s.id)}
                    onSave={signedIn ? () => void toggleSave(s) : undefined}
                    saving={saving === s.id}
                  />
                </li>
              ))}
            </ul>
            {error && <p className="st-alert is-error" role="alert">{error}</p>}
            {data?.more && (
              <div className="st-more">
                <button type="button" className="btn btn-quiet" disabled={loading} onClick={() => setPaging({ query: baseQuery, page: page + 1 })}>
                  {loading ? "Loading…" : "Show more stallions"}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <aside className="st-cta gx-glass">
        <div>
          <h2>Have a mare?</h2>
          <p>Check her against every stallion here: shared ancestors, inbreeding, genetic test results, and how the cross has run in Stayblz racing data.</p>
        </div>
        <Link to="/stallions/mating" className="btn btn-quiet">
          Open the mating check
        </Link>
      </aside>

      <StallionsDisclaimer />

      {compare.ids.length > 0 && (
        <div className="st-tray gx-glass" role="region" aria-label="Compare stallions">
          <span>
            <strong>{compare.ids.length}</strong> of 3 picked to compare
          </span>
          <button type="button" className="st-link" onClick={compare.clear}>
            Clear
          </button>
          <button type="button" className="btn btn-primary" disabled={compare.ids.length < 2} onClick={() => navigate(`/stallions/compare?ids=${compare.ids.join(",")}`)}>
            {compare.ids.length < 2 ? "Pick one more" : "Compare"}
          </button>
        </div>
      )}
    </div>
  );
}
