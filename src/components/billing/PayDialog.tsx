import { useEffect, useRef, useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import MethodPicker, { initialChoice, methodIdFor, type MethodChoice } from "./MethodPicker";
import TestModeNotice from "./TestModeNotice";
import { cardPayload } from "./CardFields";
import { billingApi, money, newKey, unknownOutcome, type Invoice, type Overview } from "./billingApi";
import "./billing.css";

/** Pay a bill (a stable's invoice, or a plan's unpaid invoice) with a saved or new card / bank account. */
export default function PayDialog({
  invoice,
  subscriptionId,
  onClose,
  onPaid,
}: {
  invoice: Pick<Invoice, "id" | "number" | "due" | "allowCard" | "allowBank" | "stableName" | "issuer">;
  /** Paying a plan's invoice: also makes this card the plan's card. */
  subscriptionId?: string;
  onClose: () => void;
  onPaid: (message: string) => void;
}) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [choice, setChoice] = useState<MethodChoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorField, setErrorField] = useState<string>();
  const key = useRef(newKey());
  const allow = { card: invoice.allowCard, bank: invoice.allowBank };

  useEffect(() => {
    billingApi
      .overview()
      .then((o) => {
        setOverview(o);
        setChoice(initialChoice(o.methods, o.profile?.defaultMethodId, allow));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Billing couldn't be loaded."));
  }, []);

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
      if (choice.mode === "new") setChoice({ mode: "saved", id: methodId });
      const r = subscriptionId
        ? await billingApi.paySubscription(subscriptionId, { methodId, key: key.current })
        : await billingApi.payInvoice(invoice.id, { methodId, key: key.current });
      onPaid(
        r.payment.status === "processing"
          ? `Your bank payment of ${money(r.payment.amount)} is on its way. We'll mark the bill paid when it clears.`
          : `Paid ${money(r.payment.amount)}${invoice.number ? ` for ${invoice.number}` : ""} (test mode).`,
      );
    } catch (e) {
      if (!unknownOutcome(e)) key.current = newKey();
      setError(unknownOutcome(e) ? "We couldn't confirm the payment yet. Please don't pay again: check back in a minute." : e instanceof Error ? e.message : "The payment didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal label={`Pay ${invoice.number ?? "bill"}`} onClose={busy ? () => undefined : onClose} className="modal-wide gx-layer bl-dialog">
      <DialogHead kicker={invoice.issuer === "stable" ? (invoice.stableName ?? "BILL") : "STAYBLZ"} title={`Pay ${money(invoice.due)}`} onClose={busy ? undefined : onClose} />
      <form
        className="dlg bl-checkout"
        onSubmit={(e) => {
          e.preventDefault();
          void pay();
        }}
      >
        <TestModeNotice compact />
        {!overview || !choice ? (
          error ? null : <p role="status" className="bl-muted">Loading your cards…</p>
        ) : (
          <MethodPicker methods={overview.methods} defaultId={overview.profile?.defaultMethodId} choice={choice} onChange={setChoice} allowCard={allow.card} allowBank={allow.bank} disabled={busy} errorField={errorField} />
        )}
        {error && <p className="bl-error" role="alert">{error}</p>}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !choice}>
            {busy ? "Paying…" : `Pay ${money(invoice.due)}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
