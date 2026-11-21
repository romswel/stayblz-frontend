import { useEffect, useState } from "react";
import CheckoutDialog from "./CheckoutDialog";
import { billingApi, dateText, money, type CatalogItem } from "./billingApi";

/**
 * "Feature this listing" for a seller: pick 7 or 30 days, then the normal checkout. Featured listings show
 * first in the Marketplace with a Featured tag; buying again adds the days on top of what's left.
 */
export default function FeatureListing({ listingId, listingName, featuredUntil, onFeatured }: { listingId: string; listingName: string; featuredUntil?: string | null; onFeatured: () => void }) {
  const [products, setProducts] = useState<CatalogItem[] | null>(null);
  const [picked, setPicked] = useState<CatalogItem | null>(null);
  useEffect(() => {
    billingApi
      .overview()
      .then((o) => setProducts(o.catalog.filter((c) => c.kind === "product" && c.effect === "marketplace_feature")))
      .catch(() => setProducts([]));
  }, []);
  const active = featuredUntil && new Date(featuredUntil).getTime() > Date.now();
  if (!products?.length) return active ? <p className="mkm-featured-note">Featured until {dateText(featuredUntil)}</p> : null;
  return (
    <div className="mkm-feature">
      <p className="mkm-featured-note">{active ? `Featured until ${dateText(featuredUntil)}. Add more days:` : "Show this horse first in the Marketplace:"}</p>
      <div className="mkm-feature-actions">
        {products.map((p) => (
          <button key={p.id} type="button" className="btn btn-quiet" onClick={() => setPicked(p)}>
            {p.effectDays} days · {money(p.amount)}
          </button>
        ))}
      </div>
      {picked && <CheckoutDialog item={picked} target={{ listingId, label: listingName }} onClose={() => setPicked(null)} onDone={onFeatured} />}
    </div>
  );
}
