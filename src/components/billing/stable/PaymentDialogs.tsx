import { useRef, useState } from "react";
import Modal from "../../Modal";
import DialogHead from "../../ui/DialogHead";
import CardFields, { cardPayload, emptyCard } from "../CardFields";
import TestModeNotice from "../TestModeNotice";
import { centsToInput, methodLabel, money, newKey, offlineLabel, parseDollars, percent, unknownOutcome, type Invoice, type Payment } from "../billingApi";
import { useStableBilling, type Rate } from "./stableBillingApi";

const feeOf = (r: Rate | undefined, amount: number) => {
  if (!r) return 0;
  let v = Math.floor((amount * r.bps + 5000) / 10000) + r.fixed;
  if (r.cap) v = Math.min(v, r.cap);
  return Math.max(0, Math.min(v, amount));
};

/** Take a payment for an invoice: a card read out over the phone, the card reader, or money received another way. */
export function TakePaymentDialog({ invoice, fees, onClose, onDone }: { invoice: Invoice; fees: Record<string, Rate> | undefined; onClose: () => void; onDone: (message: string) => void }) {
  const billing = useStableBilling();
  const [how, setHow] = useState<"keyed" | "reader" | "offline">(invoice.allowCard ? "keyed" : "offline");
  const [card, setCard] = useState(emptyCard("card"));
  const [field, setField] = useState<string>();
  const [kind, setKind] = useState("check");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(centsToInput(invoice.due));
  const [reader, setReader] = useState<"approve" | "decline">("approve");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(newKey());
  const fee = how === "offline" ? 0 : feeOf(fees?.[how], invoice.due);

  async function take() {
    setError("");
    setField(undefined);
    let body: Record<string, unknown>;
    if (how === "offline") {
      const cents = parseDollars(amount);
      if (cents === null || cents <= 0) return setError("Enter the amount received.");
      if (cents > invoice.due) return setError(`That's more than the ${money(invoice.due)} due.`);
      body = { channel: "offline", offlineKind: kind, reference, amountCents: cents, key: key.current };
    } else if (how === "reader") {
      // Test mode: the reader is simulated (a real one connects through the payment processor).
      body = { channel: "reader", token: reader === "approve" ? "tok_visa" : "tok_declined", key: key.current };
    } else {
      const check = cardPayload(card);
      if (!check.payload) {
        setField(check.field);
        return setError(check.error ?? "Check the card.");
      }
      body = { channel: "keyed", token: check.payload.token, key: key.current };
    }
    setBusy(true);
    try {
      const r = await billing.takePayment(invoice.id, body);
      onDone(how === "offline" ? `${money(r.payment.amount)} recorded.` : `${money(r.payment.amount)} paid by card (test mode).`);
    } catch (e) {
      if (!unknownOutcome(e)) key.current = newKey();
      setError(unknownOutcome(e) ? "We couldn't confirm the payment yet. Don't charge again: check this invoice in a minute." : e instanceof Error ? e.message : "The payment didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal label="Take a payment" onClose={busy ? () => undefined : onClose} className="modal-wide gx-layer bl-dialog">
      <DialogHead kicker={invoice.number ?? "INVOICE"} title={`Take a payment · ${money(invoice.due)} due`} onClose={busy ? undefined : onClose} />
      <form
        className="dlg bl-checkout"
        onSubmit={(e) => {
          e.preventDefault();
          void take();
        }}
      >
        <div className="bl-seg" role="radiogroup" aria-label="How">
          {invoice.allowCard && (
            <>
              <button type="button" role="radio" aria-checked={how === "keyed"} className={how === "keyed" ? "is-on" : ""} onClick={() => setHow("keyed")}>
                Card by phone
              </button>
              <button type="button" role="radio" aria-checked={how === "reader"} className={how === "reader" ? "is-on" : ""} onClick={() => setHow("reader")}>
                Card reader
              </button>
            </>
          )}
          <button type="button" role="radio" aria-checked={how === "offline"} className={how === "offline" ? "is-on" : ""} onClick={() => setHow("offline")}>
            Cash or cheque
          </button>
        </div>
        {how !== "offline" && <TestModeNotice compact />}
        {how === "keyed" && <CardFields value={card} onChange={setCard} allowBank={false} errorField={field} disabled={busy} />}
        {how === "reader" && (
          <div className="bl-form">
            <p className="bl-muted">Test mode has a simulated reader. A real reader is paired once a payment processor is connected.</p>
            <div className="bl-seg bl-seg-sm" role="radiogroup" aria-label="Test reader result">
              {(["approve", "decline"] as const).map((r) => (
                <button key={r} type="button" role="radio" aria-checked={reader === r} className={reader === r ? "is-on" : ""} onClick={() => setReader(r)}>
                  {r === "approve" ? "Card approved" : "Card declined"}
                </button>
              ))}
            </div>
          </div>
        )}
        {how === "offline" && (
          <div className="bl-form">
            <div className="bl-row2">
              <label className="bl-field">
                <span>Received as</span>
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {Object.entries(offlineLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="bl-field">
                <span>Amount ($)</span>
                <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
            </div>
            <label className="bl-field">
              <span className="ld-label">
                Reference <em>Optional, e.g. cheque number</em>
              </span>
              <input value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} />
            </label>
            <p className="bl-hint">Records money you received outside Stayblz. No fee, and it doesn't go into your Stayblz balance.</p>
          </div>
        )}
        {how !== "offline" && (
          <p className="bl-hint">
            Card payments pay the full {money(invoice.due)}. Stayblz fee {fees?.[how] ? `(${percent(fees[how].bps)}${fees[how].fixed ? ` + ${money(fees[how].fixed)}` : ""})` : ""}: {money(fee)} · you get {money(invoice.due - fee)}.
          </p>
        )}
        {error && <p className="bl-error" role="alert">{error}</p>}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Working…" : how === "offline" ? "Record payment" : `Charge ${money(invoice.due)}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const REASONS = [
  ["requested_by_customer", "The client asked"],
  ["service_issue", "Problem with the service"],
  ["duplicate", "Paid twice"],
  ["fraudulent", "Not authorised by the card holder"],
  ["other", "Other"],
] as const;

/** Refund all or part of a payment. Card/bank money goes back to the client; Stayblz's fee isn't returned. */
export function RefundDialog({
  payment,
  refund,
  onClose,
  onDone,
}: {
  payment: Payment;
  refund: (body: Record<string, unknown>) => Promise<unknown>;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const left = payment.amount - payment.refunded;
  const [amount, setAmount] = useState(centsToInput(left));
  const [reason, setReason] = useState("requested_by_customer");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(newKey());
  return (
    <Modal label="Refund" onClose={busy ? () => undefined : onClose} className="gx-layer bl-dialog" role="alertdialog">
      <DialogHead kicker={payment.channel === "offline" ? "RECORDED PAYMENT" : methodLabel(payment.method) || "PAYMENT"} title={`Refund up to ${money(left)}`} onClose={busy ? undefined : onClose} />
      <form
        className="dlg bl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const cents = parseDollars(amount);
          if (cents === null || cents <= 0) return setError("Enter the amount to refund.");
          if (cents > left) return setError(`At most ${money(left)} can be refunded.`);
          setBusy(true);
          setError("");
          try {
            await refund({ amountCents: cents, reason, note, key: key.current });
            onDone(payment.channel === "offline" ? `${money(cents)} refund recorded.` : `${money(cents)} refunded to the client (test mode).`);
          } catch (err) {
            if (!unknownOutcome(err)) key.current = newKey();
            setError(err instanceof Error ? err.message : "The refund didn't go through.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="bl-field">
          <span>Amount ($)</span>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} data-autofocus />
        </label>
        <label className="bl-field">
          <span>Reason</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="bl-field">
          <span className="ld-label">
            Note <em>Optional</em>
          </span>
          <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </label>
        <p className="bl-hint">
          {payment.channel === "offline"
            ? "This only records that you gave money back outside Stayblz."
            : "The money goes back to the client's card or bank in a few days. It comes out of your balance; Stayblz's fee isn't returned. This can't be undone."}
        </p>
        {error && <p className="bl-error" role="alert">{error}</p>}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy}>
            {busy ? "Refunding…" : "Refund"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
