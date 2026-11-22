import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import MethodPicker, { initialChoice, methodIdFor, type MethodChoice } from "./MethodPicker";
import TestModeNotice from "./TestModeNotice";
import { cardPayload } from "./CardFields";
import { billingApi, dateText, money, newKey, per, unknownOutcome, type CatalogItem, type Overview } from "./billingApi";
import { ApiError } from "../../api";
import "./billing.css";

type Done = { kind: "plan" | "product"; message: string; receiptId?: string | null };

/**
 * Checkout for a plan (subscribe) or a one-time product (e.g. featuring a listing). Says exactly what will be
 * charged, when it renews and how to cancel, before anything happens. One idempotency key per attempt: a retry
 * after a lost connection reuses it (never a double charge); a new attempt after a decline gets a new one.
 */
export default function CheckoutDialog({
  item,
  target,
  onClose,
  onDone,
}: {
  item: CatalogItem;
  /** What a product is for: a Marketplace listing or a Stayblz Stallions stallion. */
  target?: { listingId?: string; stallionId?: string; label?: string };
  onClose: () => void;
  onDone?: () => void;
}) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState("");
  const [choice, setChoice] = useState<MethodChoice | null>(null);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number; firstTotal: number; duration: string; durationMonths: number | null } | null>(null);
  const [couponError, setCouponError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<string>();
  const [done, setDone] = useState<Done | null>(null);
  const key = useRef(newKey());
  const plan = item.kind === "plan";

  const load = () => {
    setLoadError("");
    billingApi
      .overview()
      .then((o) => {
        setOverview(o);
        setChoice((c) => c ?? initialChoice(o.methods, o.profile?.defaultMethodId));
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Billing couldn't be loaded."));
  };
  useEffect(load, []);

  // Same rule as the server: one free trial per plan family. Unknown until loaded, so no trial wording before then.
  const trial = plan && item.trialDays > 0 && !!overview && !overview.trialUsed.includes(item.family);
  const first = applied ? applied.firstTotal : item.amount;
  const renewDate = new Date(Date.now() + (trial ? item.trialDays * 86400e3 : 0));
  renewDate.setMonth(renewDate.getMonth() + (trial ? 0 : item.interval === "year" ? 12 : 1));

  async function applyCoupon() {
    setCouponError("");
    setApplied(null);
    if (!coupon.trim()) return;
    try {
      setApplied(await billingApi.checkCoupon(coupon.trim(), item.id));
    } catch (e) {
      setCouponError(e instanceof Error ? e.message : "That code couldn't be checked.");
    }
  }

  async function pay() {
    if (!choice || busy) return;
    setError("");
    setErrorField(undefined);
    if (choice.mode === "new") {
      const check = cardPayload(choice.value);
      if (!check.payload) {
        setError(check.error ?? "Check the card.");
        setErrorField(check.field);
        return;
      }
    }
    setBusy(true);
    try {
      const methodId = await methodIdFor(choice);
      // The new card is saved now: if paying fails, the next try uses it as a saved card.
      if (choice.mode === "new") setChoice({ mode: "saved", id: methodId });
      if (plan) {
        const r = await billingApi.subscribe({ planId: item.id, methodId, coupon: applied?.code, key: key.current });
        setDone({
          kind: "plan",
          message:
            r.subscription.status === "trialing"
              ? `Your free trial has started. Nothing is charged until ${dateText(r.subscription.trialEnd)}.`
              : r.payment?.status === "processing"
                ? "Your bank payment is on its way. The plan starts as soon as it clears."
                : `You're subscribed. ${money(r.payment?.amount ?? 0)} was charged (test mode).`,
        });
      } else {
        const r = await billingApi.purchase({ productId: item.id, listingId: target?.listingId, stallionId: target?.stallionId, methodId, key: key.current });
        setDone({
          kind: "product",
          message: r.payment.status === "processing" ? "Your bank payment is on its way. It starts as soon as it clears." : `Paid ${money(r.payment.amount)} (test mode).`,
          receiptId: r.invoice?.id,
        });
      }
      onDone?.();
    } catch (e) {
      if (!unknownOutcome(e)) key.current = newKey();
      setError(
        unknownOutcome(e)
          ? "We couldn't confirm the payment yet. Please don't pay again: check Billing in a minute."
          : e instanceof Error
            ? e.message
            : "The payment didn't go through.",
      );
      // A plan you already have, or a code that stopped working: show the latest state.
      if (e instanceof ApiError && (e.code === "already_subscribed" || e.code === "coupon_invalid")) load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal label={plan ? `Subscribe to ${item.name}` : `Buy ${item.name}`} onClose={busy ? () => undefined : onClose} className="modal-wide gx-layer bl-dialog">
      <DialogHead kicker={plan ? "SUBSCRIBE" : "CHECKOUT"} title={item.name} onClose={busy ? undefined : onClose} />
      {done ? (
        <div className="dlg bl-done" role="status">
          <span className="bl-done-mark" aria-hidden="true">✓</span>
          <p>{done.message}</p>
          <div className="dlg-actions">
            <Link className="btn btn-quiet" to={done.receiptId ? `/billing/invoices/${done.receiptId}` : "/billing"} onClick={onClose}>
              {done.receiptId ? "See receipt" : "Go to Billing"}
            </Link>
            <button type="button" className="btn btn-primary" onClick={onClose} data-autofocus>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          className="dlg bl-checkout"
          onSubmit={(e) => {
            e.preventDefault();
            void pay();
          }}
        >
          <TestModeNotice compact />
          <div className="bl-summary">
            <div>
              <strong>{item.name}</strong>
              {target?.label && <small>{target.label}</small>}
              {item.description && <p>{item.description}</p>}
            </div>
            <div className="bl-summary-price">
              <strong>
                {money(item.amount)}
                <span>{per(item.interval)}</span>
              </strong>
              {trial && <small>Free for {item.trialDays} days</small>}
              {applied && <small>First {item.interval === "year" ? "year" : "month"}: {money(applied.firstTotal)}</small>}
            </div>
          </div>
          {plan && (
            <div className="bl-coupon">
              <label className="bl-field">
                <span className="ld-label">
                  Promo code <em>Optional</em>
                </span>
                <span className="bl-input-with">
                  <input value={coupon} maxLength={24} autoComplete="off" onChange={(e) => setCoupon(e.target.value.toUpperCase())} disabled={busy} />
                  <button type="button" className="btn btn-quiet" onClick={applyCoupon} disabled={busy || !coupon.trim()}>
                    Apply
                  </button>
                </span>
              </label>
              {couponError && <p className="bl-error" role="alert">{couponError}</p>}
              {applied && (
                <p className="bl-ok" role="status">
                  {applied.code}: {money(applied.discount)} off{" "}
                  {applied.duration === "once" ? "the first payment" : applied.duration === "forever" ? "every payment" : `for ${applied.durationMonths} payments`}.
                </p>
              )}
            </div>
          )}
          {loadError ? (
            <p className="bl-error" role="alert">
              {loadError}{" "}
              <button type="button" className="bl-link" onClick={load}>
                Try again
              </button>
            </p>
          ) : !overview || !choice ? (
            <p role="status" className="bl-muted">
              Loading your cards…
            </p>
          ) : (
            <MethodPicker methods={overview.methods} defaultId={overview.profile?.defaultMethodId} choice={choice} onChange={setChoice} disabled={busy} errorField={errorField} />
          )}
          <p className="bl-terms">
            {plan
              ? trial
                ? `Nothing is charged today. On ${dateText(renewDate.toISOString())} we charge ${money(first)}, then ${money(item.amount)}${per(item.interval)} until you cancel.`
                : `We charge ${money(first)} today, then ${money(item.amount)}${per(item.interval)} on the same day each ${item.interval === "year" ? "year" : "month"} until you cancel.`
              : `One payment of ${money(item.amount)}. No renewal.`}{" "}
            {plan && "Cancel any time in Billing: you keep access until the end of the period you paid for."}
          </p>
          {error && (
            <p className="bl-error" role="alert">
              {error}
            </p>
          )}
          <div className="dlg-actions">
            <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !choice}>
              {busy ? "Paying…" : plan ? (trial ? "Start free trial" : `Pay ${money(first)} and subscribe`) : `Pay ${money(item.amount)}`}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
