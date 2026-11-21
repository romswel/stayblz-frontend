import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useParams, useSearchParams } from "react-router-dom";
import { useWorkspace } from "../workspace";
import SectionNav from "../components/SectionNav";
import TestModeNotice from "../components/billing/TestModeNotice";
import { useLoad } from "../components/billing/useLoad";
import { useStableBilling } from "../components/billing/stable/stableBillingApi";
import StableOverview from "../components/billing/stable/StableOverview";
import StableInvoices from "../components/billing/stable/StableInvoices";
import InvoiceEditor from "../components/billing/stable/InvoiceEditor";
import StableInvoiceDetail from "../components/billing/stable/StableInvoiceDetail";
import StableCharges from "../components/billing/stable/StableCharges";
import StableClients from "../components/billing/stable/StableClients";
import ClientDetail from "../components/billing/stable/ClientDetail";
import StablePayouts from "../components/billing/stable/StablePayouts";
import StableSetup from "../components/billing/stable/StableSetup";
import "../components/billing/billing.css";

const SECTIONS = [
  { to: "/workspace/billing", label: "Overview" },
  { to: "/workspace/billing/invoices", label: "Invoices" },
  { to: "/workspace/billing/charges", label: "Charges" },
  { to: "/workspace/billing/clients", label: "Clients" },
  { to: "/workspace/billing/payouts", label: "Payouts" },
  { to: "/workspace/billing/settings", label: "Settings" },
];

function ClientRoute() {
  const { id = "" } = useParams();
  return <ClientDetail key={id} id={id} />;
}

function InvoiceRoute({ fees }: { fees?: Parameters<typeof StableInvoiceDetail>[0]["fees"] }) {
  const { id = "" } = useParams();
  return <StableInvoiceDetail key={id} id={id} fees={fees} />;
}

/**
 * Stable billing ("Barn office"): bill owners for training, board and vet work, split by owner shares,
 * get paid by card or bank transfer through a link, record cash and cheques, pay out to the stable's bank.
 * Owners and managers only; the API checks it again on every request.
 */
export default function StableBilling() {
  const { active, stables, select } = useWorkspace();
  const [params] = useSearchParams();
  const billing = useStableBilling();
  const allowed = active?.role === "owner" || active?.role === "manager";
  const overview = useLoad(() => (allowed ? billing.overview() : Promise.resolve(null)), [billing, allowed]);

  // Links from alerts carry ?stable=<id>: open that stable if it's one of yours.
  const wanted = params.get("stable");
  useEffect(() => {
    if (wanted && wanted !== active?.id && stables.some((s) => s.id === wanted)) select(wanted);
  }, [wanted, active?.id, stables, select]);

  if (!allowed)
    return (
      <section className="bl-card gx-glass" role="note">
        <h1>Billing</h1>
        <p className="bl-muted">Billing for {active?.name ?? "this stable"} is for its owner and managers. Ask them if you need an invoice or a receipt.</p>
        <Link className="btn btn-quiet" to="/workspace">
          Workspace overview
        </Link>
      </section>
    );

  const data = overview.data;
  return (
    <div className="bl-page">
      <header className="bl-head">
        <div>
          <span className="bl-kicker">{active?.name?.toUpperCase()} · BILLING</span>
          <h1>Barn office</h1>
          <p>Bill owners, get paid by card or bank, and keep every charge in one place.</p>
        </div>
        <div className="bl-head-actions">
          <Link className="btn btn-quiet" to="/workspace/billing/charges">
            Add charges
          </Link>
          <Link className="btn btn-primary" to="/workspace/billing/invoices/new">
            New invoice
          </Link>
        </div>
      </header>
      <SectionNav label="Billing sections" links={SECTIONS} />
      <TestModeNotice />
      {overview.error && !data && (
        <div className="bl-card gx-glass" role="alert">
          <p className="bl-error">{overview.error}</p>
          <button type="button" className="btn btn-primary" onClick={() => void overview.reload()}>
            Try again
          </button>
        </div>
      )}
      <Routes>
        <Route index element={data ? <StableOverview data={data} /> : !overview.error ? <p className="bl-muted" role="status">Loading billing…</p> : null} />
        <Route path="invoices" element={<StableInvoices />} />
        <Route path="invoices/new" element={<InvoiceEditor />} />
        <Route path="invoices/:id" element={<InvoiceRoute fees={data?.settings.fees} />} />
        <Route path="charges" element={<StableCharges />} />
        <Route path="clients" element={<StableClients />} />
        <Route path="clients/:id" element={<ClientRoute />} />
        <Route path="payouts" element={<StablePayouts role={active?.role ?? "member"} hasPayoutBank={!!data?.merchant?.payout?.last4} />} />
        <Route path="settings" element={<StableSetup role={active?.role ?? "member"} onSaved={() => void overview.reload()} />} />
        <Route path="*" element={<Navigate to="/workspace/billing" replace />} />
      </Routes>
    </div>
  );
}
