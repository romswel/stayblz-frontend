import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useConfirm } from "../../ui/Confirm";
import { dateText, money, newKey, unknownOutcome } from "../billingApi";
import { useLoad } from "../useLoad";
import { useStableBilling } from "./stableBillingApi";

/** The stable's Stayblz balance and payouts to its bank account (owner only). */
export default function StablePayouts({ role, hasPayoutBank }: { role: string; hasPayoutBank: boolean }) {
  const billing = useStableBilling();
  const confirm = useConfirm();
  const data = useLoad(() => billing.payouts(), [billing]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const key = useRef(newKey());
  const b = data.data?.balance;

  async function payOut() {
    if (!b) return;
    const ok = await confirm({ title: `Pay out ${money(b.available)}?`, message: "It goes to your payout bank account and usually arrives in about two business days.", confirmLabel: "Pay out" });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const r = await billing.payout({ key: key.current });
      key.current = newKey();
      setNotice(r.payout.status === "paid" ? `${money(r.payout.amount_cents)} is on its way${r.payout.arrives_on ? `, arriving about ${dateText(r.payout.arrives_on)}` : ""} (test mode).` : "The bank refused the payout. The money is back in your balance.");
      void data.reload();
    } catch (e) {
      if (!unknownOutcome(e)) key.current = newKey();
      setError(e instanceof Error ? e.message : "The payout didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="bl-stats" aria-label="Balance">
        <div className="bl-stat">
          <span>Available</span>
          <strong>{b ? money(b.available) : "…"}</strong>
          <small>Ready to pay out</small>
        </div>
        <div className="bl-stat">
          <span>On its way</span>
          <strong>{b ? money(b.pending) : "…"}</strong>
          <small>Recent card payments</small>
        </div>
        <div className="bl-stat">
          <span>Received through Stayblz</span>
          <strong>{b ? money(b.gross) : "…"}</strong>
          <small>{b ? `${money(b.fees)} Stayblz fees · ${money(b.refunds)} refunded` : ""}</small>
        </div>
        <div className="bl-stat">
          <span>Paid out</span>
          <strong>{b ? money(b.paidOut) : "…"}</strong>
        </div>
      </section>
      <section className="bl-card gx-glass" aria-labelledby="sb-payouts-h">
        <div className="bl-card-head">
          <h2 id="sb-payouts-h">Payouts</h2>
          {role === "owner" ? (
            hasPayoutBank ? (
              <button type="button" className="btn btn-primary" onClick={payOut} disabled={busy || !b || b.available < 100}>
                {busy ? "Paying out…" : b && b.available >= 100 ? `Pay out ${money(b.available)}` : "Nothing to pay out"}
              </button>
            ) : (
              <Link className="btn btn-primary" to="/workspace/billing/settings">
                Add a payout bank
              </Link>
            )
          ) : (
            <span className="bl-muted">Only the stable's owner pays out.</span>
          )}
        </div>
        {notice && <p className="bl-ok" role="status">{notice}</p>}
        {(data.error || error) && <p className="bl-error" role="alert">{data.error || error}</p>}
        {b && b.available < 0 && <p className="bl-error">Your balance is below zero after refunds. New payments cover it first.</p>}
        {!data.data ? (
          !data.error && <p className="bl-muted" role="status">Loading…</p>
        ) : data.data.payouts.length === 0 ? (
          <p className="bl-muted">No payouts yet. Cash and cheques you record never enter the Stayblz balance.</p>
        ) : (
          <ul className="bl-list">
            {data.data.payouts.map((p) => (
              <li key={p.id}>
                <span className="bl-list-main">
                  <strong>
                    {dateText(p.createdAt)} · {p.destination.bankName ?? "Bank"} •••• {p.destination.last4 ?? "----"}
                  </strong>
                  <small>{p.status === "paid" ? `Arrives about ${dateText(p.arrivesOn)}` : p.status === "failed" ? `Failed: ${p.failureMessage ?? "the bank refused it"}. The money is back in the balance.` : "In progress"}</small>
                </span>
                <span className="bl-amount">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
