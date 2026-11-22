import { useEffect, useState } from "react";
import CheckoutDialog from "../billing/CheckoutDialog";
import { billingApi, dateText, money, type CatalogItem } from "../billing/billingApi";

/**
 * "Feature this stallion" for his owner: pick 7 or 30 days, then the normal Stayblz Billing checkout (test mode until
 * a processor is connected). Featured stallions show first in the directory with a Featured tag; buying again adds
 * the days on top of what's left. Hidden when no featuring product is on sale.
 */
export default function FeatureStallion({ stallionId, name, featuredUntil, onFeatured }: { stallionId: string; name: string; featuredUntil?: string | null; onFeatured: () => void }) {
  const [products, setProducts] = useState<CatalogItem[] | null>(null);
  const [picked, setPicked] = useState<CatalogItem | null>(null);
  useEffect(() => {
    billingApi
      .overview()
      .then((o) => setProducts(o.catalog.filter((c) => c.kind === "product" && c.effect === "stallion_feature")))
      .catch(() => setProducts([]));
  }, []);
  const active = !!featuredUntil && new Date(featuredUntil).getTime() > Date.now();
  if (!products?.length) return active ? <p className="st-muted">Featured until {dateText(featuredUntil)}</p> : null;
  return (
    <div className="st-feature">
      <p className="st-muted">{active ? `Featured until ${dateText(featuredUntil)}. Add more days:` : "Show him first in the directory:"}</p>
      <div className="st-feature-actions">
        {products.map((p) => (
          <button key={p.id} type="button" className="btn btn-quiet" onClick={() => setPicked(p)}>
            {p.effectDays} days · {money(p.amount)}
          </button>
        ))}
      </div>
      {picked && <CheckoutDialog item={picked} target={{ stallionId, label: name }} onClose={() => setPicked(null)} onDone={onFeatured} />}
    </div>
  );
}
