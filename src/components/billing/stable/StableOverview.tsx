import { Link } from "react-router-dom";
import { channelLabel, dateText, methodLabel, money, offlineLabel, percent } from "../billingApi";
import type { StableOverviewData } from "./stableBillingApi";

const rateText = (r: { bps: number; fixed: number; cap: number }) =>
  `${percent(r.bps)}${r.fixed ? ` + ${money(r.fixed)}` : ""}${r.cap ? ` (max ${money(r.cap)})` : ""}`;

/** The stable's money at a glance: balance, what's owed, what's waiting to be billed, recent payments. */
export default function StableOverview({ data }: { data: StableOverviewData }) {
  const { balance, invoices, charges, merchant, settings } = data;
  return (
    <>
      {!merchant && (
        <section className="bl-card gx-glass" aria-labelledby="sb-setup-h">
          <h2 id="sb-setup-h">Start taking payments</h2>
          <p className="bl-muted">
            Bill owners for training, board, vet and farrier work; they pay by card or bank transfer from a link, and the money comes to your bank.
            {data.role === "owner" ? " Set it up in a minute." : " Ask the stable's owner to set it up."}
          </p>
          {data.role === "owner" && (
            <Link className="btn btn-primary" to="/workspace/billing/settings">
              Set up payments
            </Link>
          )}
        </section>
      )}
      <section className="bl-stats" aria-label="Money">
        <div className="bl-stat">
          <span>Available to pay out</span>
          <strong>{money(balance.available)}</strong>
          <small>{balance.pending ? `${money(balance.pending)} on its way` : "Nothing on its way"}</small>
        </div>
        <div className={`bl-stat${invoices.overdue ? " is-warn" : ""}`}>
          <span>Owed to you</span>
          <strong>{money(invoices.openTotal)}</strong>
          <small>
            {invoices.open} open{invoices.overdue ? ` · ${invoices.overdue} overdue (${money(invoices.overdueTotal)})` : ""}
          </small>
        </div>
        <div className="bl-stat">
          <span>Paid in the last 30 days</span>
          <strong>{money(invoices.paid30)}</strong>
          <small>Card, bank and recorded payments</small>
        </div>
        <div className="bl-stat">
          <span>Waiting to be billed</span>
          <strong>{money(charges.unbilledTotal)}</strong>
          <small>
            {charges.unbilled} charge{charges.unbilled === 1 ? "" : "s"}
            {invoices.drafts ? ` · ${invoices.drafts} draft invoice${invoices.drafts === 1 ? "" : "s"}` : ""}
          </small>
        </div>
      </section>
      <div className="bl-two">
        <section className="bl-card gx-glass" aria-labelledby="sb-recent-h">
          <div className="bl-card-head">
            <h2 id="sb-recent-h">Recent payments</h2>
            <Link className="btn btn-quiet" to="/workspace/billing/invoices">
              All invoices
            </Link>
          </div>
          {data.recentPayments.length === 0 ? (
            <p className="bl-muted">No payments yet.</p>
          ) : (
            <ul className="bl-list">
              {data.recentPayments.map((p) => (
                <li key={p.id}>
                  <span className="bl-list-main">
                    <Link to={`/workspace/billing/invoices/${p.invoiceId}`}>
                      {p.client || "Client"} · {p.invoiceNumber}
                    </Link>
                    <small>
                      {dateText(p.createdAt)} · {p.channel === "offline" ? offlineLabel[p.offlineKind ?? ""] ?? "Recorded" : `${channelLabel[p.channel]} ${methodLabel(p.method)}`} ·{" "}
                      {p.status === "succeeded" ? "Paid" : p.status === "processing" ? "Clearing" : p.status === "failed" ? "Failed" : "Pending"}
                    </small>
                  </span>
                  <span className="bl-amount">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="bl-card gx-glass" aria-labelledby="sb-fees-h">
          <h2 id="sb-fees-h">What Stayblz charges</h2>
          <p className="bl-muted">Taken from each payment your clients make through Stayblz. No monthly fee.</p>
          <ul className="bl-list">
            {(["card", "bank", "keyed", "reader"] as const).map((c) => (
              <li key={c}>
                <span className="bl-list-main">
                  <strong>{c === "card" ? "Card (online or link)" : c === "bank" ? "Bank transfer (ACH)" : c === "keyed" ? "Card typed in (phone)" : "Card reader (in person)"}</strong>
                </span>
                <span className="bl-amount">{rateText(settings.fees[c])}</span>
              </li>
            ))}
            <li>
              <span className="bl-list-main">
                <strong>Cash and cheques you record</strong>
              </span>
              <span className="bl-amount">Free</span>
            </li>
          </ul>
          <p className="bl-hint">
            Card money is ready to pay out {settings.payoutDelayDays === 0 ? "straight away" : `${settings.payoutDelayDays} day${settings.payoutDelayDays === 1 ? "" : "s"} after the payment`}. Refunds return the full amount to the client; Stayblz's fee isn't returned.
          </p>
        </section>
      </div>
    </>
  );
}
