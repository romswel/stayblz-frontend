import { useState } from "react";
import { useConfirm } from "../../ui/Confirm";
import { channelLabel, dateText, methodLabel, money, subStatusLabel } from "../billingApi";
import { useLoad } from "../useLoad";
import { RefundDialog } from "../stable/PaymentDialogs";
import { adminApi, type AdminPayment, type Summary } from "./adminApi";

/** Revenue at a glance. Everything here is test-mode money until a live processor is connected. */
export function AdminOverview({ summary, onRun }: { summary: Summary; onRun: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const net = summary.sales + summary.feeIncome - summary.refunds - summary.estimatedCost;
  return (
    <>
      <section className="bl-stats" aria-label="Revenue">
        <div className="bl-stat">
          <span>Plans and purchases</span>
          <strong>{money(summary.sales)}</strong>
          <small>Stayblz's own sales</small>
        </div>
        <div className="bl-stat">
          <span>Fees from stable payments</span>
          <strong>{money(summary.feeIncome)}</strong>
          <small>on {money(summary.stableVolume)} paid to {summary.stables} stable{summary.stables === 1 ? "" : "s"}</small>
        </div>
        <div className="bl-stat">
          <span>Refunded (Stayblz sales)</span>
          <strong>{money(summary.refunds)}</strong>
        </div>
        <div className="bl-stat">
          <span>Estimated processor cost</span>
          <strong>{money(summary.estimatedCost)}</strong>
          <small>From the cost rates in Settings</small>
        </div>
        <div className={`bl-stat${net < 0 ? " is-warn" : ""}`}>
          <span>Estimated net</span>
          <strong>{money(net)}</strong>
        </div>
        <div className="bl-stat">
          <span>Monthly recurring</span>
          <strong>{money(summary.mrr)}</strong>
          <small>Active plans, yearly ÷ 12</small>
        </div>
      </section>
      <div className="bl-two">
        <section className="bl-card gx-glass" aria-labelledby="ab-months-h">
          <h2 id="ab-months-h">Last 12 months</h2>
          <div className="bl-table-wrap">
            <table className="bl-table">
              <caption className="sr-only">Revenue by month</caption>
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col" className="num">Sales</th>
                  <th scope="col" className="num">Fees</th>
                  <th scope="col" className="num">Refunds</th>
                  <th scope="col" className="num">Stable volume</th>
                </tr>
              </thead>
              <tbody>
                {[...summary.months].reverse().map((m) => (
                  <tr key={m.month}>
                    <td>{new Date(`${m.month}-15T12:00:00Z`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</td>
                    <td className="num">{money(m.sales)}</td>
                    <td className="num">{money(m.feeIncome)}</td>
                    <td className="num">{money(m.refunds)}</td>
                    <td className="num">{money(m.stableVolume)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="bl-card gx-glass" aria-labelledby="ab-plans-h">
          <h2 id="ab-plans-h">Plans</h2>
          {summary.subscriptions.length === 0 ? (
            <p className="bl-muted">No subscriptions yet.</p>
          ) : (
            <ul className="bl-list">
              {summary.subscriptions.map((s) => (
                <li key={s.planId}>
                  <span className="bl-list-main">
                    <strong>{s.name}</strong>
                    <small>
                      {s.trialing} on trial · {s.pastDue} payment failed · {s.canceled} ended
                    </small>
                  </span>
                  <span className="bl-amount">{s.active} active</span>
                </li>
              ))}
            </ul>
          )}
          <p className="bl-muted">
            Payments: {summary.payments.succeeded} paid · {summary.payments.failed} failed · {summary.payments.processing} in progress
          </p>
          <div className="bl-actions">
            <button
              type="button"
              className="btn btn-quiet"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onRun();
                  setNotice("Billing ran: renewals, retries and bank clearing are up to date.");
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : "It couldn't run.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Running…" : "Run billing now"}
            </button>
          </div>
          {notice && <p className="bl-hint" role="status">{notice}</p>}
          <p className="bl-hint">Billing also runs by itself every minute while the server is awake.</p>
        </section>
      </div>
    </>
  );
}

export function AdminPayments() {
  const [status, setStatus] = useState("");
  const list = useLoad(() => adminApi.payments(status).then((r) => r.payments), [status]);
  const [refunding, setRefunding] = useState<AdminPayment | null>(null);
  const [notice, setNotice] = useState("");
  return (
    <section className="bl-card gx-glass" aria-labelledby="ab-pay-h">
      <h2 id="ab-pay-h">Payments</h2>
      <p className="bl-muted">Stable payments show amounts and fees only: who paid a stable, and for what, stays with that stable. Stayblz's own sales can be refunded here.</p>
      <div className="bl-chips" role="group" aria-label="Show">
        {[["", "All"], ["succeeded", "Paid"], ["failed", "Failed"], ["processing", "Clearing"]].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)}>
            {label}
          </button>
        ))}
      </div>
      {notice && <p className="bl-ok" role="status">{notice}</p>}
      {list.error && <p className="bl-error" role="alert">{list.error}</p>}
      {!list.data ? (
        !list.error && <p className="bl-muted" role="status">Loading…</p>
      ) : list.data.length === 0 ? (
        <p className="bl-muted">No payments.</p>
      ) : (
        <div className="bl-table-wrap">
          <table className="bl-table">
            <caption className="sr-only">Payments</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">For</th>
                <th scope="col">Method</th>
                <th scope="col" className="num">Amount</th>
                <th scope="col" className="num">Stayblz fee</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((p) => (
                <tr key={p.id}>
                  <td>{dateText(p.createdAt)}</td>
                  <td>
                    <span className="bl-line-desc">{p.stableId ? p.stableName : p.payer?.name || p.payer?.email || "Customer"}</span>
                    <small>
                      {p.invoiceNumber} · {p.stableId ? "stable invoice" : p.kind}
                    </small>
                  </td>
                  <td>{p.channel === "offline" ? "Recorded" : `${channelLabel[p.channel]} ${methodLabel(p.method)}`}</td>
                  <td className="num">{money(p.amount)}</td>
                  <td className="num">{p.fee ? money(p.fee) : "—"}</td>
                  <td>
                    {p.status === "succeeded" ? (p.refunded ? `Refunded ${money(p.refunded)}` : "Paid") : p.status === "failed" ? `Failed${p.failureCode ? ` (${p.failureCode})` : ""}` : "Clearing"}
                  </td>
                  <td>
                    {!p.stableId && p.status === "succeeded" && p.amount > p.refunded && (
                      <button type="button" className="bl-link" onClick={() => setRefunding(p)}>
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {refunding && (
        <RefundDialog
          payment={refunding}
          refund={(body) => adminApi.refund(refunding.id, body)}
          onClose={() => setRefunding(null)}
          onDone={(m) => {
            setRefunding(null);
            setNotice(m);
            void list.reload();
          }}
        />
      )}
    </section>
  );
}

export function AdminSubscriptions({ testMode }: { testMode: boolean }) {
  const confirm = useConfirm();
  const [status, setStatus] = useState("");
  const list = useLoad(() => adminApi.subscriptions(status).then((r) => r.subscriptions), [status]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function act(fn: () => Promise<unknown>, done: string) {
    setError("");
    try {
      await fn();
      setNotice(done);
      void list.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    }
  }
  return (
    <section className="bl-card gx-glass" aria-labelledby="ab-subs-h">
      <h2 id="ab-subs-h">Subscriptions</h2>
      <div className="bl-chips" role="group" aria-label="Show">
        {[["", "All"], ["active", "Active"], ["trialing", "Trial"], ["past_due", "Payment failed"], ["incomplete", "Unfinished"], ["canceled", "Ended"]].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={status === id} onClick={() => setStatus(id)}>
            {label}
          </button>
        ))}
      </div>
      {notice && <p className="bl-ok" role="status">{notice}</p>}
      {(list.error || error) && <p className="bl-error" role="alert">{list.error || error}</p>}
      {!list.data ? (
        !list.error && <p className="bl-muted" role="status">Loading…</p>
      ) : list.data.length === 0 ? (
        <p className="bl-muted">None.</p>
      ) : (
        <ul className="bl-list">
          {list.data.map((s) => {
            const st = subStatusLabel(s);
            return (
              <li key={s.id}>
                <span className="bl-list-main">
                  <strong>
                    {s.account.name || s.account.email} <span className={`bl-pill is-${st.tone}`}>{st.text}</span>
                  </strong>
                  <small>
                    {s.plan?.name} · {money(s.amount)}/{s.interval} · {s.status === "canceled" ? `ended ${dateText(s.endedAt)}` : `period ends ${dateText(s.currentPeriodEnd)}`}
                    {s.couponCode ? ` · code ${s.couponCode}` : ""}
                  </small>
                </span>
                {s.status !== "canceled" && (
                  <span className="bl-actions">
                    {testMode && (s.status === "active" || s.status === "trialing" || s.status === "past_due") && (
                      <button type="button" className="btn btn-quiet" onClick={() => act(() => adminApi.advance(s.id), s.status === "past_due" ? "Retried the payment now (test mode)." : "Moved to the end of the period and ran billing (test mode).")}>
                        {s.status === "past_due" ? "Test: retry now" : "Test: renew now"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-quiet"
                      onClick={async () => {
                        const ok = await confirm({ title: `End ${s.account.email}'s plan now?`, message: "Access stops now and nothing more is charged. Refund the last payment separately if needed.", confirmLabel: "End plan", tone: "danger" });
                        if (ok) await act(() => adminApi.cancelSubscription(s.id, true), "The plan was ended.");
                      }}
                    >
                      End now
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
