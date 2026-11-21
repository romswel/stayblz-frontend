import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CheckoutDialog from "./CheckoutDialog";
import { billingApi, money, per, type CatalogItem } from "./billingApi";

/** Shown on STAYBLZ TV when live races need the TV Pass and this person doesn't have it. */
export default function TvPassOffer({ heading, onUnlocked }: { heading: string; onUnlocked: () => void }) {
  const [plan, setPlan] = useState<CatalogItem | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    billingApi
      .overview()
      .then((o) => setPlan(o.catalog.find((c) => c.kind === "plan" && c.features.includes("tv.watch")) ?? null))
      .catch((e) => setError(e instanceof Error ? e.message : "Plans couldn't be loaded."));
  }, []);
  return (
    <div className="tvg-pass" role="region" aria-label="STAYBLZ TV Pass">
      <span className="tvg-label">STAYBLZ TV Pass</span>
      <h2>{heading}</h2>
      <p>{plan ? `Watch every live race for ${money(plan.amount)}${per(plan.interval)}. Cancel any time.` : error || "Live races are for TV Pass members."}</p>
      <div className="tvg-pass-actions">
        {plan && (
          <button type="button" className="tvg-btn tvg-btn-primary" onClick={() => setOpen(true)}>
            Get the TV Pass
          </button>
        )}
        <Link className="tvg-btn" to="/billing/plans">
          See plans
        </Link>
      </div>
      <p className="tvg-pass-note">Replays below stay free. Billing is in test mode: no real money is charged.</p>
      {open && plan && (
        <CheckoutDialog
          item={plan}
          onClose={() => setOpen(false)}
          onDone={onUnlocked}
        />
      )}
    </div>
  );
}
