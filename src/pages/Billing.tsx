import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth";
import { canUse } from "../components/account/roles";
import SectionNav from "../components/SectionNav";
import TestModeNotice from "../components/billing/TestModeNotice";
import YourPlans from "../components/billing/YourPlans";
import PlansList from "../components/billing/PlansList";
import PaymentMethods from "../components/billing/PaymentMethods";
import BillingHistory from "../components/billing/BillingHistory";
import CheckoutDialog from "../components/billing/CheckoutDialog";
import PayDialog from "../components/billing/PayDialog";
import { billingApi, type CatalogItem, type Invoice, type Overview, type Subscription } from "../components/billing/billingApi";
import "../components/billing/billing.css";

const SECTIONS = [
  { to: "/billing", label: "Overview" },
  { to: "/billing/plans", label: "Plans" },
  { to: "/billing/methods", label: "Payment methods" },
  { to: "/billing/history", label: "Invoices & receipts" },
];

/** Billing: your plans, bills from stables, cards and bank accounts, receipts. */
export default function Billing() {
  const { section = "" } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checkout, setCheckout] = useState<CatalogItem | null>(null);
  const [pay, setPay] = useState<{ invoice: Invoice; sub?: Subscription } | null>(null);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const next = await billingApi.overview();
      if (mine !== generation.current) return;
      setData(next);
      setError("");
    } catch (e) {
      // Keep what's on screen after a failed refresh; only an empty page shows the error.
      if (mine === generation.current) setError(e instanceof Error ? e.message : "Billing couldn't be loaded.");
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(t);
  }, [notice]);

  if (section && !["plans", "methods", "history"].includes(section)) return <Navigate to="/billing" replace />;

  return (
    <div className="bl-page">
      <header className="bl-head">
        <div>
          <span className="bl-kicker">ACCOUNT</span>
          <h1>Billing</h1>
          <p>Your plans, bills from your stable, cards and receipts.</p>
        </div>
        {canUse(user, "admin") && (
          <div className="bl-head-actions">
            <Link className="btn btn-quiet" to="/admin/billing">
              Billing admin
            </Link>
          </div>
        )}
      </header>
      <SectionNav label="Billing sections" links={SECTIONS} />
      <TestModeNotice />
      {notice && (
        <p className="bl-ok" role="status">
          {notice}
        </p>
      )}
      {section === "history" ? (
        <BillingHistory />
      ) : !data ? (
        error ? (
          <div className="bl-card gx-glass" role="alert">
            <p className="bl-error">{error}</p>
            <button type="button" className="btn btn-primary" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : (
          <p className="bl-muted" role="status">
            Loading billing…
          </p>
        )
      ) : (
        <>
          {error && (
            <p className="bl-error" role="alert">
              {error}{" "}
              <button type="button" className="bl-link" onClick={() => void load()}>
                Try again
              </button>
            </p>
          )}
          {section === "" && (
            <YourPlans
              data={data}
              onChanged={load}
              notify={setNotice}
              onSubscribe={setCheckout}
              onPayPlan={(s) => s.openInvoice && setPay({ invoice: s.openInvoice, sub: s })}
              onPayBill={(invoice) => setPay({ invoice })}
            />
          )}
          {section === "plans" && <PlansList data={data} onSubscribe={setCheckout} />}
          {section === "methods" && <PaymentMethods data={data} onChanged={load} notify={setNotice} />}
        </>
      )}
      {checkout && <CheckoutDialog item={checkout} onClose={() => setCheckout(null)} onDone={load} />}
      {pay && (
        <PayDialog
          invoice={pay.invoice}
          subscriptionId={pay.sub?.id}
          onClose={() => setPay(null)}
          onPaid={(message) => {
            setPay(null);
            setNotice(message);
            void load();
          }}
        />
      )}
    </div>
  );
}
