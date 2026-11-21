import { Link } from "react-router-dom";
import { money, per, subStatusLabel, type CatalogItem, type Overview } from "./billingApi";

const FEATURE_LINES: Record<string, string[]> = {
  "tv.watch": ["Live race telecasts on STAYBLZ TV", "Watch on phone, tablet or computer", "Cancel any time"],
  "stallions.list": ["List your stallions in Stayblz Stallions", "Breeding inquiries straight to your chat"],
};

/** Everything you can subscribe to, and add-ons bought elsewhere (featured listings in the Marketplace). */
export default function PlansList({ data, onSubscribe }: { data: Overview; onSubscribe: (item: CatalogItem) => void }) {
  const plans = data.catalog.filter((c) => c.kind === "plan");
  const products = data.catalog.filter((c) => c.kind === "product");
  const liveIn = (family: string) => data.subscriptions.find((s) => s.family === family && s.status !== "canceled");
  return (
    <>
      <section aria-labelledby="bl-plans-h" className="bl-page">
        <h2 id="bl-plans-h" className="sr-only">
          Plans
        </h2>
        {plans.length === 0 ? (
          <div className="bl-card gx-glass bl-empty">
            <strong>No plans are offered right now</strong>
            New plans are announced in <Link to="/updates">Updates</Link>.
          </div>
        ) : (
          <div className="bl-grid">
            {plans.map((p) => {
              const sub = liveIn(p.family);
              const current = sub?.planId === p.id;
              const status = sub && current ? subStatusLabel(sub) : null;
              return (
                <article key={p.id} className={`bl-card gx-glass bl-plan${current ? " is-current" : ""}`} aria-labelledby={`plan-${p.id}`}>
                  <span className="bl-kicker">{p.interval === "year" ? "Yearly" : "Monthly"}</span>
                  <h3 id={`plan-${p.id}`}>{p.name}</h3>
                  <div className="bl-plan-price">
                    {money(p.amount)}
                    <span>{per(p.interval)}</span>
                  </div>
                  {p.trialDays > 0 && !data.trialUsed.includes(p.family) && <span className="bl-pill is-info">{p.trialDays}-day free trial</span>}
                  {p.description && <p className="bl-muted">{p.description}</p>}
                  {(p.features.flatMap((f) => FEATURE_LINES[f] ?? [])).length > 0 && (
                    <ul>
                      {p.features.flatMap((f) => FEATURE_LINES[f] ?? []).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  {current ? (
                    <p className="bl-ok">
                      Your plan {status && <span className={`bl-pill is-${status.tone}`}>{status.text}</span>}
                    </p>
                  ) : sub ? (
                    <Link className="btn btn-quiet" to="/billing">
                      Switch from your current plan
                    </Link>
                  ) : (
                    <button type="button" className="btn btn-primary" onClick={() => onSubscribe(p)}>
                      {p.trialDays > 0 && !data.trialUsed.includes(p.family) ? "Start free trial" : "Subscribe"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
      {products.length > 0 && (
        <section className="bl-card gx-glass" aria-labelledby="bl-addons-h">
          <h2 id="bl-addons-h">Add-ons</h2>
          <ul className="bl-list">
            {products.map((p) => (
              <li key={p.id}>
                <span className="bl-list-main">
                  <strong>{p.name}</strong>
                  <small>{p.description}</small>
                </span>
                <span className="bl-amount">{money(p.amount)}</span>
                {p.effect === "marketplace_feature" && (
                  <Link className="btn btn-quiet" to="/marketplace?mine=1">
                    Choose a listing
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
