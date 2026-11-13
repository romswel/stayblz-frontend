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

  const filterPanel = (
    <aside className={`mk-filters ov-paper${showFilters ? " is-open" : ""}`} aria-label="Filter horses">
      <div className="mk-filters-head">
        <h2>Filters</h2>
        {activeCount > 0 && (
          <button type="button" className="mk-link" onClick={clearFilters}>
            Clear all
          </button>
        )}
      </div>
      {RANGE_FILTERS.slice(0, 1).map(range)}
      {CHOICE_FILTERS.map((f) => (
        <label key={f.key} className="mk-field">
          {f.label}
          <select value={filters.get(f.key) ?? ""} onChange={(e) => update({ [f.key]: e.target.value })}>
            <option value="">Any {f.label.toLowerCase()}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {RANGE_FILTERS.slice(1).map(range)}
      <label className="mk-field">
        Location
        <input
          type="search"
          value={location}
          maxLength={80}
          placeholder="City, state or country"
          onChange={(e) => setLocation(e.target.value)}
        />
      </label>
    </aside>
  );
  function range(f: (typeof RANGE_FILTERS)[number]) {
    const min = filters.get(f.min) ?? "";
    const max = filters.get(f.max) ?? "";
    return (
      <fieldset key={f.label} className="mk-field mk-range">
        <legend>{f.label}</legend>
        <select aria-label={`${f.label} from`} value={min} onChange={(e) => update({ [f.min]: e.target.value })}>
          <option value="">No min</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value} disabled={!!max && +o.value > +max}>
              {o.label}
            </option>
          ))}
        </select>
        <span aria-hidden="true">to</span>
        <select aria-label={`${f.label} up to`} value={max} onChange={(e) => update({ [f.max]: e.target.value })}>
          <option value="">No max</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value} disabled={!!min && +o.value < +min}>
              {o.label}
            </option>
          ))}
        </select>
      </fieldset>
    );
  }

  return (
    <div className="mk-page">
      <header className="ov-heading">
        <div>
          <span className="ov-kicker">BUY & SELL HORSES</span>
          <h1>
            Marketplace<span>.</span>
          </h1>
          <p>Browse horses listed by Stayblz members, or list your own.</p>
        </div>
        <button type="button" className="btn btn-primary mk-add" onClick={() => setForm({ editing: null })}>
          + List a horse
        </button>
      </header>

      {notice && (
        <p className="ws-notice" role="status">
          {notice}
        </p>
      )}
      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}

      <div className="mk-toolbar">
        <div className="mk-switch" role="group" aria-label="Which listings">
          <button type="button" aria-pressed={!mine} onClick={() => update({ mine: "" })}>
            All horses
          </button>
          <button type="button" aria-pressed={mine} onClick={() => update({ mine: "1" })}>
            My listings
          </button>
        </div>
        <button
          type="button"
          className="ws-button mk-filter-toggle"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
        <label className="mk-sort">
          <span>Sort</span>
          <select value={filters.get("sort") ?? "newest"} onChange={(e) => update({ sort: e.target.value === "newest" ? "" : e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mk-layout">
        {filterPanel}
        <section className="mk-results" aria-label="Horses for sale" aria-busy={loading}>
          {loading && !listings.length ? (
            <p className="ov-paper ov-empty" role="status">
              Loading horses…
            </p>
          ) : error ? (
            <div className="ov-paper mk-empty" role="alert">
              <h3>The marketplace could not be loaded.</h3>
              <p>{error}</p>
              <button type="button" className="ws-button" onClick={() => setVersion((v) => v + 1)}>
                Try again
              </button>
            </div>
          ) : !listings.length ? (
            <div className="ov-paper mk-empty">
              {activeCount ? (
                <>
                  <h3>No horses match these filters.</h3>
                  <p>Try a wider price, age or height range, or clear the filters.</p>
                  <button type="button" className="ws-button" onClick={clearFilters}>
                    Clear filters
                  </button>
                </>
              ) : mine ? (
                <>
                  <h3>You haven't listed any horses yet.</h3>
                  <p>Listings you publish appear here, where you can edit or remove them.</p>
                  <button type="button" className="ws-button" onClick={() => setForm({ editing: null })}>
                    List a horse
                  </button>
                </>
              ) : (
                <>
                  <h3>No horses are listed yet.</h3>
                  <p>Be the first to list a horse for sale.</p>
                  <button type="button" className="ws-button" onClick={() => setForm({ editing: null })}>
                    List a horse
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="mk-count" role="status">
                {loading
                  ? "Updating…"
                  : `${listings.length}${more ? "+" : ""} ${listings.length === 1 ? "horse" : "horses"}${mine ? " listed by you" : ""}`}
              </p>
              <ul className={`mk-grid${loading ? " is-loading" : ""}`}>
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
                <p className="ov-footnote">Showing the first {listings.length} horses. Use the filters to narrow the list.</p>
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
  return (
    <article className="ov-paper mk-card" aria-label={`${l.name}, ${formatPrice(l.price)}`}>
      <div className="mk-card-top">
        <HorsePortrait coat={coat.coat} mane={coat.mane} blaze={coat.blaze} size={56} title={l.name} />
        <div>
          <h3>{l.name}</h3>
          <strong className="mk-price">{formatPrice(l.price)}</strong>
        </div>
        {l.mine && <span className="mk-badge">Your listing</span>}
      </div>
      <p className="mk-tags">
        <span>{labelOf(BREEDS, l.breed)}</span>
        <span>{labelOf(DISCIPLINES, l.discipline)}</span>
        <span>{labelOf(TYPES, l.type)}</span>
      </p>
      <dl className="mk-facts">
        <div>
          <dt>Gender</dt>
          <dd>{labelOf(GENDERS, l.gender)}</dd>
        </div>
        <div>
          <dt>Color</dt>
          <dd>{labelOf(COLORS, l.color)}</dd>
        </div>
        <div>
          <dt>Age</dt>
          <dd>{formatAge(l.age)}</dd>
        </div>
        <div>
          <dt>Height</dt>
          <dd>{formatHands(l.heightIn)}</dd>
        </div>
        <div className="mk-wide">
          <dt>Location</dt>
          <dd>{l.location}</dd>
        </div>
      </dl>
      <footer className="mk-card-foot">
        <span>
          Listed by {l.mine ? "you" : l.sellerName}
          {Number.isFinite(listed.getTime()) && (
            <>
              {" · "}
              <time dateTime={l.createdAt}>{listed.toLocaleDateString()}</time>
            </>
          )}
        </span>
        {(l.mine || canRemove) && (
          <span className="mk-card-actions">
            {l.mine && (
              <button type="button" className="ws-button" onClick={onEdit} disabled={busy} aria-label={`Edit ${l.name}`}>
                Edit
              </button>
            )}
            {canRemove && (
              <button type="button" className="ws-button" onClick={onRemove} disabled={busy} aria-label={`Remove ${l.name}`}>
                {busy ? "Removing…" : "Remove"}
              </button>
            )}
          </span>
        )}
      </footer>
    </article>
  );
}
