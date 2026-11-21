import { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { useConfirm } from "../ui/Confirm";
import { billingApi, dateText, methodLabel, money, per, subStatusLabel, type CatalogItem, type Invoice, type Overview, type Subscription } from "./billingApi";

const FEATURE_WORDS: Record<string, string> = {
  "tv.watch": "STAYBLZ TV live races",
  "stallions.list": "Stallion Showcase listings",
};

function subLine(s: Subscription) {
  const price = `${money(s.amount)}${per(s.interval)}`;
  switch (s.status) {
    case "trialing":
      return s.cancelAtPeriodEnd
        ? `Free trial ends ${dateText(s.trialEnd)}. You won't be charged.`
        : `Free trial until ${dateText(s.trialEnd)}, then ${price}.`;
    case "active":
      if (s.cancelAtPeriodEnd) return `Ends ${dateText(s.currentPeriodEnd)}. You won't be charged again.`;
      if (s.pendingPlan) return `Switches to ${s.pendingPlan.name} (${money(s.pendingPlan.amount)}${per(s.pendingPlan.interval)}) on ${dateText(s.currentPeriodEnd)}.`;
      return `${price} · renews ${dateText(s.currentPeriodEnd)}`;
    case "past_due":
      return `We couldn't charge ${money(s.openInvoice?.total ?? s.amount)}.${s.openInvoice?.nextAttemptAt ? ` Next try ${dateText(s.openInvoice.nextAttemptAt, false)}.` : ""} Pay now or change the card to keep access.`;
    case "incomplete":
      return "The first payment didn't go through. Pay now to start the plan.";
    default:
      return `Ended ${dateText(s.endedAt)}${s.cancelReason === "payment_failed" ? " after payments failed" : ""}.`;
  }
}

export default function YourPlans({
  data,
  onChanged,
  onSubscribe,
  onPayPlan,
  onPayBill,
  notify,
}: {
  data: Overview;
  onChanged: () => void;
  onSubscribe: (item: CatalogItem) => void;
  onPayPlan: (s: Subscription) => void;
  onPayBill: (i: Invoice) => void;
  notify: (text: string) => void;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [cardFor, setCardFor] = useState<Subscription | null>(null);
  const live = data.subscriptions.filter((s) => s.status !== "canceled");
  const ended = data.subscriptions.filter((s) => s.status === "canceled");
  const plans = data.catalog.filter((c) => c.kind === "plan");

  async function run(id: string, fn: () => Promise<unknown>, done: string) {
    setBusy(id);
    setError("");
    try {
      await fn();
      notify(done);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function cancel(s: Subscription) {
    const name = s.plan?.name ?? "this plan";
    const now = s.status === "past_due" || s.status === "incomplete";
    const ok = await confirm({
      title: `Cancel ${name}?`,
      message: now
        ? "It ends now and the unpaid invoice is cancelled. You won't be charged."
        : s.status === "trialing"
          ? `Your free trial ends on ${dateText(s.trialEnd)} and you won't be charged.`
          : `You keep access until ${dateText(s.currentPeriodEnd)}. You won't be charged again.`,
      confirmLabel: "Cancel plan",
      cancelLabel: "Keep plan",
      tone: "danger",
    });
    if (ok) await run(s.id, () => billingApi.cancel(s.id), `${name} will end ${now ? "now" : "at the end of the period"}.`);
  }

  async function switchTo(s: Subscription, target: CatalogItem) {
    const ok = await confirm({
      title: `Switch to ${target.name}?`,
      message: `From ${dateText(s.currentPeriodEnd)} you'll pay ${money(target.amount)}${per(target.interval)}. Nothing changes before then.`,
      confirmLabel: "Switch at renewal",
    });
    if (ok) await run(s.id, () => billingApi.change(s.id, { planId: target.id }), `Switching to ${target.name} on ${dateText(s.currentPeriodEnd)}.`);
  }

  return (
    <>
      <section className="bl-card gx-glass" aria-labelledby="bl-plans-title">
        <div className="bl-card-head">
          <h2 id="bl-plans-title">Your plans</h2>
          <Link className="btn btn-quiet" to="/billing/plans">
            See all plans
          </Link>
        </div>
        {error && <p className="bl-error" role="alert">{error}</p>}
        {live.length === 0 ? (
          <div className="bl-empty">
            <strong>No plans yet</strong>
            {plans.length ? (
              <>
                {plans[0].name} is {money(plans[0].amount)}
                {per(plans[0].interval)}.{" "}
                <button type="button" className="bl-link" onClick={() => onSubscribe(plans[0])}>
                  Get it
                </button>
              </>
            ) : (
              "No plans are offered right now."
            )}
          </div>
        ) : (
          live.map((s) => {
            const status = subStatusLabel(s);
            const method = data.methods.find((m) => m.id === s.methodId);
            const others = plans.filter((p) => p.family === s.family && p.id !== s.planId && p.id !== s.pendingPlanId);
            return (
              <div className="bl-sub-row" key={s.id}>
                <div className="bl-sub-main">
                  <strong>
                    {s.plan?.name ?? s.planId} <span className={`bl-pill is-${status.tone}`}>{status.text}</span>
                  </strong>
                  <span>{subLine(s)}</span>
                  {method && <span>Paid with {methodLabel(method)}</span>}
                </div>
                <div className="bl-actions">
                  {(s.status === "past_due" || s.status === "incomplete") && s.openInvoice && (
                    <button type="button" className="btn btn-primary" onClick={() => onPayPlan(s)} disabled={!!busy}>
                      Pay {money(s.openInvoice.due || s.openInvoice.total)}
                    </button>
                  )}
                  {s.cancelAtPeriodEnd ? (
                    <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => run(s.id, () => billingApi.resume(s.id), `${s.plan?.name ?? "Your plan"} will keep renewing.`)}>
                      {busy === s.id ? "Saving…" : "Keep my plan"}
                    </button>
                  ) : (
                    <>
                      {s.status !== "incomplete" &&
                        others.map((o) => (
                          <button key={o.id} type="button" className="btn btn-quiet" disabled={!!busy} onClick={() => switchTo(s, o)}>
                            Switch to {o.interval === "year" ? "yearly" : "monthly"}
                          </button>
                        ))}
                      {s.pendingPlanId && (
                        <button type="button" className="btn btn-quiet" disabled={!!busy} onClick={() => run(s.id, () => billingApi.change(s.id, { planId: s.planId }), "The switch was cancelled.")}>
                          Don't switch
                        </button>
                      )}
                      {s.status !== "incomplete" && (
                        <button type="button" className="btn btn-quiet" disabled={!!busy} onClick={() => setCardFor(s)}>
                          Change card
                        </button>
                      )}
                      <button type="button" className="btn btn-quiet" disabled={!!busy} onClick={() => cancel(s)}>
                        Cancel plan
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        {ended.length > 0 && (
          <details className="bl-ended">
            <summary>Ended plans ({ended.length})</summary>
            <ul className="bl-list">
              {ended.map((s) => (
                <li key={s.id}>
                  <span className="bl-list-main">
                    <strong>{s.plan?.name ?? s.planId}</strong>
                    <small>{subLine(s)}</small>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {(data.bills.length > 0 || data.billers.length > 0) && (
        <section className="bl-card gx-glass" aria-labelledby="bl-bills-title">
          <div className="bl-card-head">
            <h2 id="bl-bills-title">Bills to pay</h2>
            <Link className="btn btn-quiet" to="/billing/methods#autopay">
              Autopay
            </Link>
          </div>
          {data.bills.length === 0 ? (
            <p className="bl-muted">Nothing due. Bills from your trainer or stable show up here.</p>
          ) : (
            <ul className="bl-list">
              {data.bills.map((b) => (
                <li key={b.id}>
                  <span className="bl-list-main">
                    <Link to={`/billing/invoices/${b.id}`}>
                      {b.stableName ?? "Stable"} · {b.number}
                    </Link>
                    <small>
                      Due {dateText(b.dueOn)}
                      {b.inFlight ? " · payment clearing" : b.autoCollect ? " · autopay is on" : ""}
                    </small>
                  </span>
                  <span className="bl-amount">{money(b.due)}</span>
                  <button type="button" className="btn btn-primary" onClick={() => onPayBill(b)} disabled={b.inFlight}>
                    {b.inFlight ? "Clearing" : "Pay"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="bl-card gx-glass" aria-labelledby="bl-access-title">
        <h2 id="bl-access-title">What you can use</h2>
        {data.features.length ? (
          <ul className="bl-plain">
            {data.features.map((f) => (
              <li key={f}>{FEATURE_WORDS[f] ?? f}</li>
            ))}
          </ul>
        ) : (
          <p className="bl-muted">Nothing paid yet.</p>
        )}
        {!data.settings.enforcePaywalls && (
          <p className="bl-hint">
            Right now STAYBLZ TV is open to every member while billing is being tested. A plan only changes what you can watch once paid access is switched on.
          </p>
        )}
      </section>

      {cardFor && (
        <ChangeCardDialog
          sub={cardFor}
          data={data}
          onClose={() => setCardFor(null)}
          onSaved={() => {
            setCardFor(null);
            notify("The plan's card was changed.");
            onChanged();
          }}
        />
      )}
    </>
  );
}

function ChangeCardDialog({ sub, data, onClose, onSaved }: { sub: Subscription; data: Overview; onClose: () => void; onSaved: () => void }) {
  const [id, setId] = useState(sub.methodId ?? data.methods[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal label="Change the plan's card" onClose={onClose} className="gx-layer bl-dialog">
      <DialogHead kicker={sub.plan?.name} title="Change card" onClose={onClose} />
      <form
        className="dlg bl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await billingApi.change(sub.id, { methodId: id });
            onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : "It couldn't be changed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {data.methods.length === 0 ? (
          <p className="bl-muted">
            No saved cards. <Link to="/billing/methods">Add one</Link> first.
          </p>
        ) : (
          <label className="bl-field">
            <span>Charge renewals to</span>
            <select value={id} onChange={(e) => setId(e.target.value)}>
              {data.methods.map((m) => (
                <option key={m.id} value={m.id}>
                  {methodLabel(m)}
                </option>
              ))}
            </select>
          </label>
        )}
        {sub.status === "past_due" && <p className="bl-hint">This doesn't pay what's due now. Use "Pay" for that; the next try will also use this card.</p>}
        {error && <p className="bl-error" role="alert">{error}</p>}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !id}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
