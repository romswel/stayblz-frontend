import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";
import SectionNav from "../../components/SectionNav";
import TestModeNotice from "../../components/billing/TestModeNotice";
import { useLoad } from "../../components/billing/useLoad";
import { adminApi } from "../../components/billing/admin/adminApi";
import { AdminOverview, AdminPayments, AdminSubscriptions } from "../../components/billing/admin/AdminMoney";
import { AdminCatalog, AdminCoupons, AdminGrants } from "../../components/billing/admin/AdminOffers";
import AdminSettings from "../../components/billing/admin/AdminSettings";
import "../../components/billing/billing.css";

const SECTIONS = [
  { to: "/admin/billing", label: "Overview" },
  { to: "/admin/billing/payments", label: "Payments" },
  { to: "/admin/billing/subscriptions", label: "Subscriptions" },
  { to: "/admin/billing/plans", label: "Plans" },
  { to: "/admin/billing/codes", label: "Promo codes" },
  { to: "/admin/billing/access", label: "Free access" },
  { to: "/admin/billing/settings", label: "Fees & settings" },
];

/** Billing administration (admin and up). The API checks the role again on every request. */
export default function BillingAdmin() {
  const { section = "" } = useParams();
  const { user } = useAuth();
  const summary = useLoad(() => adminApi.summary(), []);
  if (section && !SECTIONS.some((s) => s.to.endsWith(`/${section}`))) return <Navigate to="/admin/billing" replace />;
  const data = summary.data;
  return (
    <div className="bl-page">
      <header className="bl-head">
        <div>
          <span className="bl-kicker">ADMINISTRATION</span>
          <h1>Billing</h1>
          <p>Revenue, payments, plans and fees across Stayblz.</p>
        </div>
      </header>
      <SectionNav label="Billing admin sections" links={SECTIONS} />
      <TestModeNotice />
      {summary.error && !data && (
        <div className="bl-card gx-glass" role="alert">
          <p className="bl-error">{summary.error}</p>
          <button type="button" className="btn btn-primary" onClick={() => void summary.reload()}>
            Try again
          </button>
        </div>
      )}
      {section === "" && (data ? <AdminOverview summary={data.summary} onRun={async () => { await adminApi.run(); await summary.reload(); }} /> : !summary.error && <p className="bl-muted" role="status">Loading…</p>)}
      {section === "payments" && <AdminPayments />}
      {section === "subscriptions" && <AdminSubscriptions testMode={data?.settings.mode !== "live"} />}
      {section === "plans" && <AdminCatalog />}
      {section === "codes" && <AdminCoupons />}
      {section === "access" && <AdminGrants />}
      {section === "settings" &&
        (data ? (
          <AdminSettings key={data.settings.updatedAt} settings={data.settings} provider={data.provider} superadmin={user?.role === "superadmin"} onSaved={() => void summary.reload()} />
        ) : (
          !summary.error && <p className="bl-muted" role="status">Loading…</p>
        ))}
    </div>
  );
}
