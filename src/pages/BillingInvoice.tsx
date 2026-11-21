import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import InvoiceView from "../components/billing/InvoiceView";
import PayDialog from "../components/billing/PayDialog";
import { billingApi, type Invoice } from "../components/billing/billingApi";
import { ApiError } from "../api";
import StatusPage from "../components/status/StatusPage";
import "../components/billing/billing.css";

/** One of your invoices or receipts: Stayblz's own, or a bill from a stable addressed to you. */
export default function BillingInvoice() {
  const { id = "" } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<{ text: string; missing: boolean } | null>(null);
  const [paying, setPaying] = useState(false);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const r = await billingApi.invoice(id);
      if (mine !== generation.current) return;
      setInvoice(r.invoice);
      setError(null);
    } catch (e) {
      if (mine !== generation.current) return;
      setError({ text: e instanceof Error ? e.message : "This invoice couldn't be loaded.", missing: e instanceof ApiError && e.status === 404 });
    }
  }, [id]);
  useEffect(() => {
    setInvoice(null);
    void load();
  }, [load]);
  // A bank payment is clearing: look again now and then.
  useEffect(() => {
    if (!invoice?.inFlight) return;
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), 20_000);
    return () => window.clearInterval(t);
  }, [invoice?.inFlight, load]);

  if (error?.missing && !invoice) return <StatusPage kind="not-found" title="Invoice not found" message="It doesn't exist, or it isn't addressed to your account." />;
  return (
    <div className="bl-page">
      <header className="bl-head bl-no-print">
        <div>
          <span className="bl-kicker">BILLING</span>
          <h1>{invoice?.number ?? "Invoice"}</h1>
          <p>{invoice ? (invoice.issuer === "stable" ? `From ${invoice.stableName}` : "From Stayblz") : ""}</p>
        </div>
        <div className="bl-head-actions">
          <Link className="btn btn-quiet" to="/billing/history">
            All invoices
          </Link>
        </div>
      </header>
      {notice && <p className="bl-ok" role="status">{notice}</p>}
      {error && invoice && <p className="bl-error" role="alert">{error.text}</p>}
      {!invoice ? (
        error ? (
          <div className="bl-card gx-glass" role="alert">
            <p className="bl-error">{error.text}</p>
            <button type="button" className="btn btn-primary" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : (
          <p className="bl-muted" role="status">Loading…</p>
        )
      ) : (
        <InvoiceView
          invoice={invoice}
          actions={
            <>
              {invoice.status === "open" && invoice.due > 0 && !invoice.inFlight && invoice.issuer === "stable" && (
                <button type="button" className="btn btn-primary" onClick={() => setPaying(true)}>
                  Pay now
                </button>
              )}
              {invoice.status === "open" && invoice.issuer === "stayblz" && invoice.kind === "subscription" && (
                <Link className="btn btn-primary" to="/billing">
                  Pay from your plan
                </Link>
              )}
              {invoice.inFlight && <span className="bl-pill is-info">Payment clearing</span>}
              {invoice.autopay && invoice.status === "open" && <span className="bl-pill is-info">Autopay is on</span>}
              <button type="button" className="btn btn-quiet" onClick={() => window.print()}>
                Print or save as PDF
              </button>
            </>
          }
        />
      )}
      {paying && invoice && (
        <PayDialog
          invoice={invoice}
          onClose={() => setPaying(false)}
          onPaid={(m) => {
            setPaying(false);
            setNotice(m);
            void load();
          }}
        />
      )}
    </div>
  );
}
