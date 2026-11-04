import { Link, useLocation } from "react-router-dom";
import SectionNav from "../SectionNav";
import { ppContent, productPages } from "./productContent";
import { ppProducts, type PPProduct } from "./catalog";
import PPPreview from "./PPPreview";
import PPOrder from "./PPOrder";
import LifetimeSearch from "./LifetimeSearch";
import "./product.css";
export default function PPProductPage({
  product,
  view,
}: {
  product: PPProduct;
  view?: string;
}) {
  const content = ppContent[product.id];
  const { pathname, search } = useLocation();
  const links = productPages(product.id);
  const current = links.find((link) => link.to === pathname);
  const related = ppProducts
    .filter(
      (p) =>
        [
          "premium",
          "basic",
          "platinum",
          "daily-racing-form",
          "lifetime",
        ].includes(p.id) && p.id !== product.id,
    )
    .slice(0, 3);
  return (
    <div className="pp-product-page">
      <SectionNav
        label="Report pages"
        links={links}
        linkState={{ ppFrom: pathname + search }}
      />
      {!current ? (
        <section className="pp-panel pp-empty">
          <h2>Page not found</h2>
          <p>Choose a page for this report.</p>
          <Link to={`/pps/${product.id}`}>Back to report</Link>
        </section>
      ) : (
        <div className="pp-product-layout">
          <div className="pp-product-main" key={pathname}>
            {!view ? (
              product.id === "lifetime" ? (
                <LifetimeSearch />
              ) : (
                <PPOrder key={product.id} product={product} />
              )
            ) : view === "features" ? (
              <section className="pp-order">
                <span className="pp-kicker">ABOUT THE REPORT</span>
                <h2>What is in this report?</h2>
                <p className="pp-intro">{content.intro}</p>
                <p className="pp-footnote">
                  These explain the reference report. Stayblz files and provider
                  features are not connected yet.
                </p>
                <ul className="pp-feature-highlights">
                  {content.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <h3>Report details</h3>
                <div className="pp-feature-details">
                  {content.sections.map((section, i) => (
                    <article key={section.title}>
                      <span aria-hidden="true">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h3>{section.title}</h3>
                        <p>{section.text}</p>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="pp-inline-actions">
                  <Link className="ws-button" to={`/pps/${product.id}`}>
                    Choose a report
                  </Link>
                  <Link className="ws-button" to={`/pps/${product.id}/guide`}>
                    How to read
                  </Link>
                  <Link className="ws-button" to="/pps/compare">
                    Compare PPs
                  </Link>
                </div>
              </section>
            ) : view === "sample" || view === "free-race" ? (
              <section className="pp-order">
                <span className="pp-kicker">
                  {view === "free-race" ? "FREE RACE" : "REPORT SAMPLE"}
                </span>
                <h2>
                  {view === "free-race"
                    ? "Try a free race report"
                    : "View a sample"}
                </h2>
                <p>
                  {view === "free-race"
                    ? "A free-race page is where a selected race and its approved report files will appear."
                    : "Check a report layout before choosing a product. Approved sample files will appear here."}
                </p>
                <div className="pp-sample-layout">
                  <PPPreview variant={product.preview} />
                  <div>
                    <h3>No PP files available</h3>
                    <p>
                      No approved PDF has been added for this report. The
                      picture is a layout preview with no racing data.
                    </p>
                    <button className="ws-button" disabled>
                      Open PDF unavailable
                    </button>
                    <button className="ws-button" disabled>
                      Download unavailable
                    </button>
                  </div>
                </div>
                {product.id === "premium" && (
                  <div className="pp-sample-options">
                    {["Standard PP", "Highlighted PP", "Selections"].map(
                      (name) => (
                        <div key={name}>
                          <strong>{name}</strong>
                          <small>No free-race file available</small>
                        </div>
                      ),
                    )}
                  </div>
                )}
                <Link className="ws-button" to={`/pps/${product.id}/guide`}>
                  Read the report guide
                </Link>
              </section>
            ) : view === "guide" ? (
              <section className="pp-order">
                <span className="pp-kicker">READING GUIDE</span>
                <h2>How to read a PP</h2>
                <p>
                  Start with the race conditions, then compare each horse's
                  recent starts. Read the terms below before using a report.
                </p>
                <ol className="pp-reading-steps">
                  <li>
                    <strong>Check the race</strong>
                    <p>
                      Look at the date, track, surface, distance and entry
                      conditions.
                    </p>
                  </li>
                  <li>
                    <strong>Read the horse's form</strong>
                    <p>
                      Work through recent starts, positions, margins and changes
                      in rider or trainer.
                    </p>
                  </li>
                  <li>
                    <strong>Compare like for like</strong>
                    <p>
                      Check similar surfaces and distances. Read each provider's
                      rating guide before comparing figures.
                    </p>
                  </li>
                </ol>
                <div className="pp-glossary">
                  {content.sections.map((section) => (
                    <details key={section.title}>
                      <summary>{section.title}</summary>
                      <p>{section.text}</p>
                    </details>
                  ))}
                </div>
                <p className="pp-footnote">
                  No figure guarantees a result. Blank or missing values do not
                  mean zero.
                </p>
              </section>
            ) : (
              <section className="pp-order">
                <span className="pp-kicker">REPORT ACCESS</span>
                <h2>Subscriptions</h2>
                <p>
                  A subscription can provide access over a set period. A day
                  pass covers a selected race date; a single card covers a
                  selected track and date.
                </p>
                <div className="pp-empty">
                  <h3>No subscription plans available yet.</h3>
                  <p>
                    Prices, report limits, renewals and cancellation terms have
                    not been set.
                  </p>
                  <button className="ws-button" disabled>
                    Subscribe unavailable
                  </button>
                </div>
                <Link className="ws-button" to={`/pps/${product.id}`}>
                  View single cards and day passes
                </Link>
              </section>
            )}
          </div>
          <aside className="pp-product-aside" aria-label="Report information">
            <section>
              <span className="pp-kicker">AT A GLANCE</span>
              <h2>{product.name}</h2>
              <p>{content.intro}</p>
              <dl>
                <div>
                  <dt>Price</dt>
                  <dd>Not set</dd>
                </div>
                <div>
                  <dt>File access</dt>
                  <dd>No PP files available</dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>Not available</dd>
                </div>
              </dl>
              <Link
                className="ws-button"
                to="/pps/cart"
                state={{ ppFrom: pathname + search }}
              >
                Review cart
              </Link>
            </section>
            <section className="pp-provider-note">
              <h3>About this option</h3>
              <p>{content.note}</p>
              <p>
                Report names identify the reference format. They do not mean
                Stayblz sells the provider's product.
              </p>
            </section>
          </aside>
        </div>
      )}
      <section className="pp-related">
        <div className="pp-section-heading">
          <h2>Other report options</h2>
          <Link to="/pps/compare">Compare all</Link>
        </div>
        <div>
          {related.map((item) => (
            <Link
              key={item.id}
              to={`/pps/${item.id}`}
              state={{ ppFrom: pathname + search }}
            >
              <span className="pp-kicker">THOROUGHBRED</span>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
              <span>View report &#8594;</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
