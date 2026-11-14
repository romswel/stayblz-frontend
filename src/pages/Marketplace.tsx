import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import HorsePortrait from "../components/HorsePortrait";
import { canUse } from "../components/account/roles";
import ListingForm from "../components/marketplace/ListingForm";
import {
  AGE_FILTER,
  BREEDS,
  COAT,
  COLORS,
  DISCIPLINES,
  GENDERS,
  HEIGHT_FILTER,
  PRICE_STEPS,
  SORTS,
  TYPES,
  formatAge,
  formatHands,
  formatPrice,
  labelOf,
  type Listing,
  type Option,
} from "../components/marketplace/options";
import { useConfirm } from "../components/ui/Confirm";
import "../components/overview/overview.css";
import "../components/marketplace/marketplace.css";
import "../components/marketplace/marketplace-glass.css";

/** Every filter lives in the address, so Back, refresh and shared links keep it. */
const CHOICE_FILTERS: { key: string; label: string; options: Option[] }[] = [
  { key: "breed", label: "Breed", options: BREEDS },
  { key: "discipline", label: "Discipline", options: DISCIPLINES },
  { key: "type", label: "Type", options: TYPES },
  { key: "gender", label: "Gender", options: GENDERS },
  { key: "color", label: "Color", options: COLORS },
];
const RANGE_FILTERS: { label: string; min: string; max: string; options: Option[] }[] = [
  { label: "Price", min: "priceMin", max: "priceMax", options: PRICE_STEPS },
  { label: "Age (years)", min: "ageMin", max: "ageMax", options: AGE_FILTER },
  { label: "Height", min: "heightMin", max: "heightMax", options: HEIGHT_FILTER },
];
const FILTER_KEYS = [
  ...CHOICE_FILTERS.map((f) => f.key),
  ...RANGE_FILTERS.flatMap((f) => [f.min, f.max]),
  "location",
];

/** Only values the server accepts reach the request; anything odd in the address is ignored. */
function readFilters(params: URLSearchParams) {
  const out = new URLSearchParams();
  for (const f of CHOICE_FILTERS) {
    const v = params.get(f.key);
    if (v && f.options.some((o) => o.value === v)) out.set(f.key, v);
  }
  for (const f of RANGE_FILTERS)
    for (const key of [f.min, f.max]) {
      const v = params.get(key);
      if (v && f.options.some((o) => o.value === v)) out.set(key, v);
    }
  const location = (params.get("location") ?? "").trim().slice(0, 80);
  if (location) out.set("location", location);
  const sort = params.get("sort");
  if (sort && SORTS.some((s) => s.value === sort) && sort !== "newest") out.set("sort", sort);
  if (params.get("mine") === "1") out.set("mine", "1");
  return out;
}

function useListings(query: string, version: number) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string;
    listings: Listing[];
    more: boolean;
  }>({ loading: true, error: "", listings: [], more: false });
  useEffect(() => {
    // A newer filter choice aborts the older request, so late answers never show.
    const c = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    api
      .get<{ listings: Listing[]; more: boolean }>(`/api/marketplace/listings${query ? `?${query}` : ""}`, {
        signal: c.signal,
      })
      .then((d) => {
        if (c.signal.aborted) return;
        if (!Array.isArray(d?.listings)) throw new Error("The marketplace could not be loaded.");
        setState({ loading: false, error: "", listings: d.listings, more: !!d.more });
      })
      .catch((e) => {
        if (c.signal.aborted) return;
        setState({
          loading: false,
          error: e instanceof Error ? e.message : "The marketplace could not be loaded.",
          listings: [],
          more: false,
        });
      });
    return () => c.abort();
  }, [query, version]);
  return [state, setState] as const;
}

/* ---------- Icons ---------- */
const I = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;
const PlusIcon = () => (<svg {...I}><path d="M12 5v14M5 12h14" /></svg>);
const FilterIcon = () => (<svg {...I}><path d="M4 6h16M7 12h10M10 18h4" /></svg>);
const CloseIcon = () => (<svg {...I} width={14} height={14}><path d="M18 6 6 18M6 6l12 12" /></svg>);
const GridIcon = () => (<svg {...I}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>);
const ListIcon = () => (<svg {...I}><rect x="4" y="5" width="16" height="5" rx="1.5" /><rect x="4" y="14" width="16" height="5" rx="1.5" /></svg>);
const PinIcon = () => (<svg {...I} width={14} height={14}><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>);
const EditIcon = () => (<svg {...I} width={14} height={14}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>);
const TrashIcon = () => (<svg {...I} width={14} height={14}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>);
const SearchIcon = () => (<svg {...I}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);

type View = "grid" | "list";

export default function Marketplace() {
  const { user } = useAuth();
  const isAdmin = canUse(user, "admin");
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const query = filters.toString();
  const [version, setVersion] = useState(0);
  const [{ loading, error, listings, more }, setListings] = useListings(query, version);
  const [form, setForm] = useState<{ editing: Listing | null } | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem("stayblz.marketView") === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("stayblz.marketView", view);
    } catch {
      /* View choice just isn't remembered. */
    }
  }, [view]);

  const mine = filters.get("mine") === "1";
  const activeCount = FILTER_KEYS.filter((k) => filters.has(k)).length;

  // Location is typed, so wait for a pause before searching.
  const [location, setLocation] = useState(filters.get("location") ?? "");
  const urlLocation = filters.get("location") ?? "";
  // Back/forward or "Clear" changes the address: follow it, but keep a space being typed.
  useEffect(() => setLocation((typed) => (typed.trim() === urlLocation ? typed : urlLocation)), [urlLocation]);
  useEffect(() => {
    if (location.trim() === urlLocation) return;
    const timer = window.setTimeout(() => update({ location: location.trim() }), 350);
    return () => window.clearTimeout(timer);
  }, [location]);

  // The phone filter sheet closes with Escape and stops the page behind it from scrolling.
  useEffect(() => {
    if (!showFilters) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowFilters(false);
    document.addEventListener("keydown", onKey);
    const small = window.matchMedia("(max-width: 900px)").matches;
    const prev = document.body.style.overflow;
    if (small) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showFilters]);

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(filters);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }
  function clearFilters() {
    const next = new URLSearchParams();
    if (mine) next.set("mine", "1");
    if (filters.get("sort")) next.set("sort", filters.get("sort")!);
    setLocation("");
    setParams(next, { replace: true });
  }

  async function remove(listing: Listing) {
    if (removing) return;
    const sure = await confirm({
      title: `Remove ${listing.name}?`,
      message: listing.mine
        ? "The listing is taken off the marketplace for everyone. This can't be undone."
        : `This removes ${listing.sellerName}'s listing for everyone. This can't be undone.`,
      confirmLabel: "Remove listing",
      cancelLabel: "Keep listing",
      tone: "danger",
    });
    if (!sure) return;
    setRemoving(listing.id);
    setActionError("");
    setNotice("");
    try {
      await api.post(`/api/marketplace/listings/${listing.id}/remove`);
      setListings((s) => ({ ...s, listings: s.listings.filter((l) => l.id !== listing.id) }));
      setNotice(`${listing.name} was removed from the marketplace.`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "The listing could not be removed. Please try again.");
    } finally {
      setRemoving(null);
    }
  }

  function saved(listing: Listing, created: boolean) {
    setForm(null);
    setActionError("");
    if (created) {
      setNotice(`${listing.name} is now listed on the marketplace.`);
      setVersion((v) => v + 1);
    } else {
      setNotice(`Changes to ${listing.name} were saved.`);
      setListings((s) => ({ ...s, listings: s.listings.map((l) => (l.id === listing.id ? listing : l)) }));
    }
  }

  /* ---------- Summary figures for the header (from the loaded listings) ---------- */
  const prices = listings
    .map((l) => l.price as unknown)
    .filter((p): p is number => typeof p === "number" && Number.isFinite(p));
  const low = prices.length ? Math.min(...prices) : undefined;
  const high = prices.length ? Math.max(...prices) : undefined;
  const yours = listings.filter((l) => l.mine).length;
  const stats = [
    { label: mine ? "Your listings" : "Horses listed", value: loading && !listings.length ? "—" : `${listings.length}${more ? "+" : ""}` },
    { label: "From", value: low !== undefined ? formatPrice(low as Listing["price"]) : "—" },
    { label: "Up to", value: high !== undefined ? formatPrice(high as Listing["price"]) : "—" },
    { label: "Yours here", value: loading && !listings.length ? "—" : String(yours) },
  ];

  /* ---------- Active filter chips ---------- */
  const chips: { key: string; label: string; clear: Record<string, string> }[] = [];
  for (const f of CHOICE_FILTERS) {
    const v = filters.get(f.key);
    if (v) chips.push({ key: f.key, label: `${f.label}: ${labelOf(f.options, v)}`, clear: { [f.key]: "" } });
  }
  for (const f of RANGE_FILTERS) {
    const min = filters.get(f.min);
    const max = filters.get(f.max);
    if (min || max)
      chips.push({
        key: f.min,
        label: `${f.label}: ${min ? labelOf(f.options, min) : "Any"} – ${max ? labelOf(f.options, max) : "Any"}`,
        clear: { [f.min]: "", [f.max]: "" },
      });
  }
  if (urlLocation) chips.push({ key: "location", label: `Near: ${urlLocation}`, clear: { location: "" } });

  function range(f: (typeof RANGE_FILTERS)[number]) {
    const min = filters.get(f.min) ?? "";
    const max = filters.get(f.max) ?? "";
    return (
      <fieldset key={f.label} className="mp-field mp-range">
        <legend>{f.label}</legend>
        <div className="mp-range-row">
          <select aria-label={`${f.label} from`} value={min} onChange={(e) => update({ [f.min]: e.target.value })}>
            <option value="">No min</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value} disabled={!!max && +o.value > +max}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="mp-range-sep" aria-hidden="true">–</span>
          <select aria-label={`${f.label} up to`} value={max} onChange={(e) => update({ [f.max]: e.target.value })}>
            <option value="">No max</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value} disabled={!!min && +o.value < +min}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    );
  }

  const filterPanel = (
    <aside
      id="mp-filters"
      className={`mp-filters gx-glass${showFilters ? " is-open" : ""}`}
      aria-label="Filter horses"
    >
      <div className="mp-filters-head">
        <span className="mp-sheet-grip" aria-hidden="true" />
        <h2>
          <FilterIcon /> Filters
          {activeCount > 0 && <span className="mp-count-pill">{activeCount}</span>}
        </h2>
        <div className="mp-filters-head-actions">
          {activeCount > 0 && (
            <button type="button" className="mp-link" onClick={clearFilters}>
              Clear all
            </button>
          )}
          <button
            type="button"
            className="mp-icon-btn mp-sheet-only"
            aria-label="Close filters"
            onClick={() => setShowFilters(false)}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="mp-filters-body">
        <label className="mp-field">
          <span className="mp-field-label">Location</span>
          <span className="mp-input-icon">
            <SearchIcon />
            <input
              type="search"
              value={location}
              maxLength={80}
              placeholder="City, state or country"
              onChange={(e) => setLocation(e.target.value)}
            />
          </span>
        </label>
        {RANGE_FILTERS.slice(0, 1).map(range)}
        <div className="mp-divider" role="presentation" />
        {CHOICE_FILTERS.map((f) => (
          <label key={f.key} className="mp-field">
            <span className="mp-field-label">{f.label}</span>
            <select
              className={filters.get(f.key) ? "is-set" : undefined}
              value={filters.get(f.key) ?? ""}
              onChange={(e) => update({ [f.key]: e.target.value })}
            >
              <option value="">Any {f.label.toLowerCase()}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="mp-divider" role="presentation" />
        {RANGE_FILTERS.slice(1).map(range)}
      </div>

      <div className="mp-sheet-foot mp-sheet-only">
        <button type="button" className="mp-btn mp-btn-primary" onClick={() => setShowFilters(false)}>
          {loading ? "Updating…" : `Show ${listings.length}${more ? "+" : ""} ${listings.length === 1 ? "horse" : "horses"}`}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="mp">
      {/* ---------- Header ---------- */}
      <header className="mp-hero gx-glass">
        <div className="mp-hero-main">
          <span className="mp-kicker">
            <span className="mp-pulse" aria-hidden="true" /> Buy &amp; sell horses
          </span>
          <h1>
            Marketplace<span>.</span>
          </h1>
          <p>Browse horses listed by Stayblz members, or list your own.</p>
        </div>
        <button type="button" className="mp-btn mp-btn-primary mp-add" onClick={() => setForm({ editing: null })}>
          <PlusIcon /> List a horse
        </button>
        <dl className="mp-stats">
          {stats.map((s) => (
            <div key={s.label} className="mp-stat">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      {notice && (
        <p className="mp-alert mp-alert-ok" role="status">
          {notice}
          <button type="button" className="mp-icon-btn" aria-label="Dismiss" onClick={() => setNotice("")}>
            <CloseIcon />
          </button>
        </p>
      )}
      {actionError && (
        <p className="mp-alert mp-alert-error" role="alert">
          {actionError}
          <button type="button" className="mp-icon-btn" aria-label="Dismiss" onClick={() => setActionError("")}>
            <CloseIcon />
          </button>
        </p>
      )}

      {/* ---------- Toolbar ---------- */}
      <div className="mp-toolbar gx-glass">
        <div className="mp-seg" role="group" aria-label="Which listings">
          <button type="button" aria-pressed={!mine} onClick={() => update({ mine: "" })}>
            All horses
          </button>
          <button type="button" aria-pressed={mine} onClick={() => update({ mine: "1" })}>
            My listings
          </button>
        </div>
        <div className="mp-toolbar-right">
          <button
            type="button"
            className="mp-btn mp-filter-toggle"
            aria-expanded={showFilters}
            aria-controls="mp-filters"
            onClick={() => setShowFilters((v) => !v)}
          >
            <FilterIcon /> Filters
            {activeCount > 0 && <span className="mp-count-pill">{activeCount}</span>}
          </button>
          <label className="mp-sort">
            <span>Sort</span>
            <select
              value={filters.get("sort") ?? "newest"}
              onChange={(e) => update({ sort: e.target.value === "newest" ? "" : e.target.value })}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mp-seg mp-view" role="group" aria-label="Layout">
            <button type="button" aria-pressed={view === "grid"} aria-label="Grid view" title="Grid view" onClick={() => setView("grid")}>
              <GridIcon />
            </button>
            <button type="button" aria-pressed={view === "list"} aria-label="List view" title="List view" onClick={() => setView("list")}>
              <ListIcon />
            </button>
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="mp-chips" aria-label="Active filters">
          {chips.map((c) => (
            <button
              type="button"
              key={c.key}
              className="mp-chip"
              onClick={() => update(c.clear)}
              aria-label={`Remove filter ${c.label}`}
            >
              {c.label} <CloseIcon />
            </button>
          ))}
          <button type="button" className="mp-link" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      <div className="mp-layout">
        {showFilters && (
          <button
            type="button"
            className="mp-scrim"
            aria-label="Close filters"
            tabIndex={-1}
            onClick={() => setShowFilters(false)}
          />
        )}
        {filterPanel}

        <section className="mp-results" aria-label="Horses for sale" aria-busy={loading}>
          {loading && !listings.length ? (
            <>
              <p className="mp-count" role="status">Loading horses…</p>
              <ul className={`mp-grid is-${view}`} aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i}>
                    <div className="mp-card mp-skeleton gx-glass">
                      <span className="mp-sk mp-sk-media" />
                      <span className="mp-sk mp-sk-line" />
                      <span className="mp-sk mp-sk-line short" />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : error ? (
            <div className="mp-empty gx-glass" role="alert">
              <span className="mp-empty-icon is-error" aria-hidden="true">!</span>
              <h3>The marketplace could not be loaded.</h3>
              <p>{error}</p>
              <button type="button" className="mp-btn" onClick={() => setVersion((v) => v + 1)}>
                Try again
              </button>
            </div>
          ) : !listings.length ? (
            <div className="mp-empty gx-glass">
              <span className="mp-empty-icon" aria-hidden="true">
                <SearchIcon />
              </span>
              {activeCount ? (
                <>
                  <h3>No horses match these filters.</h3>
                  <p>Try a wider price, age or height range, or clear the filters.</p>
                  <button type="button" className="mp-btn" onClick={clearFilters}>
                    Clear filters
                  </button>
                </>
              ) : mine ? (
                <>
                  <h3>You haven't listed any horses yet.</h3>
                  <p>Listings you publish appear here, where you can edit or remove them.</p>
                  <button type="button" className="mp-btn mp-btn-primary" onClick={() => setForm({ editing: null })}>
                    <PlusIcon /> List a horse
                  </button>
                </>
              ) : (
                <>
                  <h3>No horses are listed yet.</h3>
                  <p>Be the first to list a horse for sale.</p>
                  <button type="button" className="mp-btn mp-btn-primary" onClick={() => setForm({ editing: null })}>
                    <PlusIcon /> List a horse
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="mp-count" role="status">
                {loading ? (
                  "Updating…"
                ) : (
                  <>
                    <strong>
                      {listings.length}
                      {more ? "+" : ""}
                    </strong>{" "}
                    {listings.length === 1 ? "horse" : "horses"}
                    {mine ? " listed by you" : " for sale"}
                  </>
                )}
              </p>
              <ul className={`mp-grid is-${view}${loading ? " is-loading" : ""}`}>
                {listings.map((l) => (
                  <li key={l.id}>
                    <ListingCard
                      listing={l}
                      canRemove={l.mine || isAdmin}
                      busy={removing === l.id}
                      onEdit={() => setForm({ editing: l })}
                      onRemove={() => void remove(l)}
                    />
                  </li>
                ))}
              </ul>
              {more && (
                <p className="mp-footnote">
                  Showing the first {listings.length} horses. Use the filters to narrow the list.
                </p>
              )}
            </>
          )}
        </section>
      </div>

      {form && <ListingForm editing={form.editing} onClose={() => setForm(null)} onSaved={saved} />}
    </div>
  );
}

function ListingCard({
  listing: l,
  canRemove,
  busy,
  onEdit,
  onRemove,
}: {
  listing: Listing;
  canRemove: boolean;
  busy: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const coat = COAT[l.color] ?? COAT.other;
  const listed = new Date(l.createdAt);
  const validDate = Number.isFinite(listed.getTime());
  const seller = l.mine ? "You" : l.sellerName;
  return (
    <article className={`mp-card gx-glass${busy ? " is-busy" : ""}`} aria-label={`${l.name}, ${formatPrice(l.price)}`}>
      <div className="mp-media">
        <span className="mp-media-grid" aria-hidden="true" />
        <HorsePortrait coat={coat.coat} mane={coat.mane} blaze={coat.blaze} size={84} title={l.name} />
        <span className="mp-type">{labelOf(TYPES, l.type)}</span>
        {l.mine && <span className="mp-mine">Your listing</span>}
      </div>

      <div className="mp-card-body">
        <div className="mp-card-title">
          <h3>{l.name}</h3>
          <strong className="mp-price">{formatPrice(l.price)}</strong>
        </div>
        <p className="mp-loc">
          <PinIcon /> {l.location}
        </p>
        <p className="mp-tags">
          <span>{labelOf(BREEDS, l.breed)}</span>
          <span>{labelOf(DISCIPLINES, l.discipline)}</span>
        </p>
        <dl className="mp-facts">
          <div>
            <dt>Gender</dt>
            <dd>{labelOf(GENDERS, l.gender)}</dd>
          </div>
          <div>
            <dt>Color</dt>
            <dd>
              <span className="mp-swatch" style={{ background: coat.coat }} aria-hidden="true" />
              {labelOf(COLORS, l.color)}
            </dd>
          </div>
          <div>
            <dt>Age</dt>
            <dd>{formatAge(l.age)}</dd>
          </div>
          <div>
            <dt>Height</dt>
            <dd>{formatHands(l.heightIn)}</dd>
          </div>
        </dl>
      </div>

      <footer className="mp-card-foot">
        <span className="mp-seller">
          <span className="mp-seller-avatar" aria-hidden="true">
            {(seller ?? "?").charAt(0).toUpperCase()}
          </span>
          <span>
            <span className="mp-seller-name">
              {l.mine ? "Listed by you" : <>Listed by <b>{l.sellerName}</b></>}
            </span>
            {validDate && (
              <small>
                <time dateTime={l.createdAt}>
                  {listed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </time>
              </small>
            )}
          </span>
        </span>
        {(l.mine || canRemove) && (
          <span className="mp-card-actions">
            {l.mine && (
              <button type="button" className="mp-icon-btn" onClick={onEdit} disabled={busy} aria-label={`Edit ${l.name}`} title="Edit">
                <EditIcon />
              </button>
            )}
            {canRemove && (
              <button
                type="button"
                className="mp-icon-btn mp-danger"
                onClick={onRemove}
                disabled={busy}
                aria-label={busy ? `Removing ${l.name}` : `Remove ${l.name}`}
                title={busy ? "Removing…" : "Remove"}
              >
                <TrashIcon />
              </button>
            )}
          </span>
        )}
      </footer>
    </article>
  );
}