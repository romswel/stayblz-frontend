import {
  Link,
  Navigate,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";

import {
  isPPDestination,
  ppProducts,
  type PPProduct,
} from "../components/pps/catalog";
import { ppContent, productPages } from "../components/pps/productContent";
import PPProductPage from "../components/pps/PPProductPage";
import { recordsForDiscipline } from "../components/pps/racingDiscipline";
import { canonicalPPPath } from "../components/pps/legacyRoutes";
import CartReview from "../components/pps/CartReview";
import PPPreview from "../components/pps/PPPreview";
import PPPageNav from "../components/pps/PPPageNav";
import useRacingOverview from "../components/landing/useRacingOverview";
import "../components/pps/pps.css";

function usePPFilters() {
  const [params, setParams] = useSearchParams();
  const change = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const clear = (keys: string[]) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        keys.forEach((key) => next.delete(key));
        return next;
      },
      { replace: true },
    );
  return { params, change, clear };
}

function ProductCard({ product }: { product: PPProduct }) {
  const { pathname, search } = useLocation();
  return (
    <Link
      className="pp-card"
      to={`/pps/${product.id}`}
      state={{ ppFrom: pathname + search }}
    >
      <div className="pp-card-image">
        <PPPreview variant={product.preview} />
      </div>
      <div className="pp-card-copy">
        <span className="pp-card-type">{product.group}</span>
        <h3>{product.name}</h3>
        <p>{product.description}</p>
        <div className="pp-card-bottom">
          <span>
            {ppContent[product.id]?.mode === "workspace"
              ? "Account workspace"
              : "Price not available"}
          </span>
          <strong>
            {ppContent[product.id]?.mode === "workspace"
              ? "Open workspace"
              : "View details"}{" "}
            <span aria-hidden="true">↗</span>
          </strong>
        </div>
      </div>
    </Link>
  );
}

function TrackBrowser() {
  const { data, error, refreshing, refresh } = useRacingOverview();
  const { pathname, search } = useLocation();
  const { params, change, clear } = usePPFilters();
  const date = params.get("date") ?? "";
  const query = params.get("q") ?? "";
  const setDate = (value: string) => change("date", value);
  const setQuery = (value: string) => change("q", value);
  const group = params.get("type") === "Harness" ? "Harness" : "Thoroughbred";
  const cards = recordsForDiscipline(data?.sections.racecards ?? [], group);
  const tracks = [
    ...new Set(
      cards
        .filter((card) => !date || card.date === date)
        .flatMap((card) => (card.track ? [card.track] : [])),
    ),
  ]
    .sort()
    .filter((track) =>
      track.toLowerCase().includes(query.trim().toLowerCase()),
    );
  return (
    <section className="pp-panel">
      <h2>Shop by track</h2>
      <p>
        Choose a track from the available race entries. PP files and prices are
        not available yet.
      </p>
      <div className="pp-filters">
        <label>
          Race type
          <select
            value={group}
            onChange={(e) => change("type", e.target.value)}
          >
            <option>Thoroughbred</option>
            <option>Harness</option>
          </select>
        </label>
        <label>
          Race date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Search tracks
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Track name"
          />
        </label>
        <button
          className="ws-button"
          onClick={() => {
            clear(["date", "q"]);
          }}
        >
          Clear filters
        </button>
        <button className="ws-button" onClick={refresh} disabled={refreshing}>
          Refresh tracks
        </button>
      </div>
      {error && (
        <p role="alert">
          {error} {data && "Showing previously loaded tracks."}
        </p>
      )}
      {!data ? (
        <p className="pp-empty" role="status">
          {error
            ? "Tracks could not be loaded. Try Refresh tracks."
            : "Loading tracks…"}
        </p>
      ) : tracks.length ? (
        <ul className="pp-track-list">
          {tracks.map((track) => (
            <li key={track}>
              <div>
                <h3>{track}</h3>
                <p>Race entries available. PP files are not connected.</p>
              </div>
              <Link
                className="ws-button"
                to={`/pps/${group === "Harness" ? "harness-racecard" : "racecard"}?track=${encodeURIComponent(track)}&date=${encodeURIComponent(date || cards.find((card) => card.track === track)?.date || "")}`}
                state={{ ppFrom: pathname + search }}
              >
                View PP option
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="pp-empty" role="status">
          <h3>
            {date || query
              ? "No tracks match your filters."
              : "No tracks available yet."}
          </h3>
          <p>Tracks will appear when race entries are added.</p>
        </div>
      )}
    </section>
  );
}

function Comparison() {
  const { pathname, search } = useLocation();
  const { params, change } = usePPFilters();
  const group = params.get("type") === "Harness" ? "Harness" : "Thoroughbred";
  const setGroup = (value: string) => change("type", value);
  return (
    <section className="pp-panel">
      <div className="pp-section-heading">
        <div>
          <h2>Compare PPs</h2>
          <p>Compare the report options before opening their details.</p>
        </div>
        <label>
          Race type
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option>Thoroughbred</option>
            <option>Harness</option>
          </select>
        </label>
      </div>
      <div
        className="pp-table-scroll"
        role="region"
        aria-label="PP comparison"
        tabIndex={0}
      >
        <table className="pp-table">
          <thead>
            <tr>
              <th>Report</th>
              <th>About this option</th>
              <th>Price</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {ppProducts
              .filter((p) => p.group === group)
              .map((p) => (
                <tr key={p.id}>
                  <th scope="row">{p.name}</th>
                  <td>{p.description}</td>
                  <td>
                    {ppContent[p.id]?.mode === "workspace"
                      ? "Account tool"
                      : "Not available"}
                  </td>
                  <td>
                    <Link
                      to={`/pps/${p.id}`}
                      state={{ ppFrom: pathname + search }}
                    >
                      View details
                    </Link>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="pp-footnote">
        Report options are shown for this design preview. Final features and
        prices have not been set.
      </p>
    </section>
  );
}

export default function PastPerformances() {
  const { pathname, search, state } = useLocation();
  const { productId, view } = useParams();
  const { params, change, clear } = usePPFilters();
  const filter = ["Thoroughbred", "Harness"].includes(params.get("type") ?? "")
    ? params.get("type")!
    : "All reports";
  const reportSearch = params.get("q") ?? "";
  const setFilter = (value: string) =>
    change("type", value === "All reports" ? "" : value);
  const setReportSearch = (value: string) => change("q", value);
  const origin =
    isPPDestination(state?.ppFrom) && state.ppFrom !== pathname + search
      ? state.ppFrom
      : null;
  const backTo =
    pathname === "/pps"
      ? "/dashboard"
      : (origin ??
        (view && ppProducts.some((p) => p.id === productId)
          ? `/pps/${productId}`
          : "/pps"));
  const visibleProducts = ppProducts.filter(
    (p) =>
      p.overview !== false &&
      (filter === "All reports" || p.group === filter) &&
      (p.name + " " + p.description)
        .toLowerCase()
        .includes(reportSearch.trim().toLowerCase()),
  );
  const section = pathname.split("/")[2] ?? "";
  const product = ppProducts.find((p) => p.id === productId);
  const titles: Record<string, string> = {
    compare: "Compare PPs",
    "by-track": "Shop by track",
    "day-passes": "Day pass plans",
    store: "Report catalogue",
    cart: "Your cart",
  };
  const childPage =
    product && view
      ? productPages(product.id).find((page) => page.to === pathname)
      : null;
  const title =
    (view ? (childPage?.label ?? "Report page not found") : product?.name) ??
    titles[section] ??
    (section ? "PP report not found" : "Past Performances");
  const canonicalPath = canonicalPPPath(pathname);
  if (canonicalPath !== pathname)
    return (
      <Navigate
        to={canonicalPath + search}
        replace
        state={{ ...state, catalogueRedirect: true }}
      />
    );
  return (
    <div className="pps-page">
      <div className="pp-top-row">
        <Link
          className="pp-back"
          to={backTo}
          aria-label={
            backTo === "/dashboard"
              ? "Back to racing overview"
              : "Back to previous PP page"
          }
        >
          <span aria-hidden="true">&larr;</span> Back
        </Link>
      </div>
      <header className="pp-page-heading">
        <div>
          <span className="pp-kicker">RACING REPORTS</span>
          <h1>{title}</h1>
        </div>
        <button
          className="ws-button pp-print"
          onClick={() => window.print()}
          aria-label="Print PP page"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M7 8V3h10v5M7 17H3V9h18v8h-4M7 14h10v7H7Z" />
          </svg>
          Print
        </button>
      </header>
      <nav className="pp-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/dashboard">Home</Link>
        <span aria-hidden="true">/</span>
        {section ? (
          <>
            <Link to="/pps">PPs</Link>
            <span aria-hidden="true">/</span>
            {view && product && (
              <>
                <Link to={`/pps/${product.id}`}>{product.name}</Link>
                <span aria-hidden="true">/</span>
              </>
            )}
            <span aria-current="page">{title}</span>
          </>
        ) : (
          <span aria-current="page">PPs</span>
        )}
      </nav>
      <PPPageNav />
      {state?.catalogueRedirect && (
        <p className="pp-footnote" role="status">
          This older link now opens a Stayblz report design. It does not give
          access to an outside publisher's product.
        </p>
      )}
      <div className="pp-preview-notice">
        <strong>Catalogue preview</strong>
        <p>
          Explore Stayblz report designs. Prices, files and purchases are not
          available yet.
        </p>
      </div>
      <div className="pp-route-content" key={pathname}>
        {!section ? (
          <>
            <section className="pp-start">
              <div>
                <span className="pp-kicker">PAST PERFORMANCE REPORTS</span>
                <h2>Find a report for your race day.</h2>
                <p>
                  Browse by report type, compare the options, or find a track.
                  PPs bring a horse's previous race results into one report.
                </p>
                <Link to="/pps/compare" state={{ ppFrom: "/pps" }}>
                  Compare the options <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
              <div className="pp-start-steps">
                <Link to="/pps/by-track" state={{ ppFrom: "/pps" }}>
                  <span>01</span>
                  <div>
                    <strong>Find your track</strong>
                    <small>Browse available race entries</small>
                  </div>
                  <b aria-hidden="true">&#8599;</b>
                </Link>
                <Link to="/pps/compare" state={{ ppFrom: "/pps" }}>
                  <span>02</span>
                  <div>
                    <strong>Choose a report</strong>
                    <small>Compare report formats</small>
                  </div>
                  <b aria-hidden="true">&#8599;</b>
                </Link>
                <Link to="/pps/day-passes" state={{ ppFrom: "/pps" }}>
                  <span>03</span>
                  <div>
                    <strong>Check day passes</strong>
                    <small>View plan availability</small>
                  </div>
                  <b aria-hidden="true">&#8599;</b>
                </Link>
              </div>
            </section>
            <section
              className="pp-browse-controls"
              aria-label="Find PP reports"
            >
              <div className="pp-category-controls">
                {["All reports", "Thoroughbred", "Harness"].map((group) => (
                  <button
                    key={group}
                    aria-pressed={filter === group}
                    onClick={() => setFilter(group)}
                  >
                    {group}
                  </button>
                ))}
              </div>
              <input
                type="search"
                aria-label="Search PP reports"
                placeholder="Search report names"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
              />
            </section>
            <div className="pp-catalogue">
              {!visibleProducts.length && (
                <div className="pp-empty" role="status">
                  <h3>No matching reports.</h3>
                  <p>Try another name or choose a different race type.</p>
                  <button
                    className="ws-button"
                    onClick={() => {
                      clear(["q", "type"]);
                    }}
                  >
                    Clear report filters
                  </button>
                </div>
              )}
              {(["Thoroughbred", "Harness"] as const)
                .filter((group) =>
                  visibleProducts.some((p) => p.group === group),
                )
                .map((group) => (
                  <section
                    className="pp-product-section"
                    key={group}
                    aria-label={`${group} past performances`}
                  >
                    <div className="pp-section-heading">
                      <h2>{group}</h2>
                      <span>
                        {group === "Thoroughbred"
                          ? "Flat racing reports"
                          : "Harness racing reports"}
                      </span>
                    </div>
                    <div className="pp-product-grid">
                      {ppProducts
                        .filter(
                          (p) =>
                            visibleProducts.includes(p) && p.group === group,
                        )
                        .map((p) => (
                          <ProductCard key={p.id} product={p} />
                        ))}
                    </div>
                  </section>
                ))}
            </div>
          </>
        ) : section === "compare" ? (
          <Comparison />
        ) : section === "by-track" ? (
          <TrackBrowser />
        ) : section === "day-passes" ? (
          <section className="pp-panel">
            <h2>Day pass plans</h2>
            <p>A day pass is a way to access reports for a race day.</p>
            <div className="pp-empty">
              <h3>No day pass plans available yet.</h3>
              <p>Plan details, prices, and purchases will be added later.</p>
              <Link className="ws-button" to="/pps/compare">
                Compare report options
              </Link>
            </div>
          </section>
        ) : section === "store" ? (
          <section className="pp-panel">
            <h2>Report catalogue</h2>
            <p>
              Browse the PP report options. Purchases and downloads are not
              available yet.
            </p>
            <div className="pp-store-links">
              <Link className="ws-button" to="/pps">
                Browse all PPs
              </Link>
              <Link className="ws-button" to="/pps/by-track">
                Find a track
              </Link>
              <Link className="ws-button" to="/pps/day-passes">
                View day pass plans
              </Link>
            </div>
          </section>
        ) : section === "cart" ? (
          <section className="pp-panel">
            <CartReview />
          </section>
        ) : product && Object.hasOwn(ppContent, product.id) ? (
          <PPProductPage key={product.id} product={product} view={view} />
        ) : product && !view ? (
          <section className="pp-panel pp-product-detail">
            <div className="pp-detail-image">
              <PPPreview variant={product.preview} />
            </div>
            <div>
              <span className="pp-kicker">{product.group}</span>
              <h2>{product.name}</h2>
              <p>{product.description}</p>
              {params.get("track") && (
                <p className="pp-selected-track">
                  Selected track: <strong>{params.get("track")}</strong>
                </p>
              )}
              <dl className="pp-product-facts">
                <div>
                  <dt>Availability</dt>
                  <dd>Not connected yet</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>Not available</dd>
                </div>
                <div>
                  <dt>Downloads</dt>
                  <dd>No PP files available</dd>
                </div>
              </dl>
              <Link className="ws-button" to="/pps/by-track">
                Browse tracks
              </Link>
              <p className="pp-footnote">
                The image shows a report layout, without race data. This is not
                a purchased report or a downloadable sample.
              </p>
            </div>
          </section>
        ) : (
          <section className="pp-panel pp-empty">
            <h2>Report not found</h2>
            <p>Choose an option from the PP catalogue.</p>
            <Link className="ws-button" to="/pps">
              View all PPs
            </Link>
          </section>
        )}
      </div>
      <footer className="pp-page-footer">
        <p>
          Stayblz racing reports and tools. Availability depends on the data and
          files published here.
        </p>
        <Link to="/faq">Help & FAQ ↗</Link>
      </footer>
    </div>
  );
}
