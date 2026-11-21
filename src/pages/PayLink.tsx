import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import PublicHeader from "../components/PublicHeader";
import InvoiceView from "../components/billing/InvoiceView";
import CardFields, { cardPayload, emptyCard, type CardValue } from "../components/billing/CardFields";
import MethodPicker, { initialChoice, methodIdFor, type MethodChoice } from "../components/billing/MethodPicker";
import TestModeNotice from "../components/billing/TestModeNotice";
import { billingApi, dateText, money, newKey, unknownOutcome, type Invoice, type Overview, type Payment } from "../components/billing/billingApi";
import "./landing.css";
import "../components/billing/billing.css";

/**
 * A stable's pay link (/pay/<token>): anyone with the link can see and pay that one bill, no account needed.
 * Signed in, saved cards can be used too. Inside the app when signed in, a public page otherwise.
 */
export default function PayLink({ standalone = false }: { standalone?: boolean }) {
  const { token = "" } = useParams();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [choice, setChoice] = useState<MethodChoice | null>(null);
  const [card, setCard] = useState<CardValue>(emptyCard());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [field, setField] = useState<string>();
  const [result, setResult] = useState<Payment | null>(null);
  const key = useRef(newKey());

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ invoice: Invoice }>(`/api/pay/${encodeURIComponent(token)}`);
      setInvoice(r.invoice);
      setLoadError("");
      setCard((c) => (r.invoice.allowCard ? c : { ...c, kind: "bank" }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
      else setLoadError(e instanceof Error ? e.message : "This bill couldn't be loaded.");
    }
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!user || !invoice) return;
    billingApi
      .overview()
      .then((o) => {
        setOverview(o);
        setChoice(initialChoice(o.methods, o.profile?.defaultMethodId, { card: invoice.allowCard, bank: invoice.allowBank }));
      })
      .catch(() => setOverview(null));
    // Only once the bill is known (which methods it accepts).
  }, [user, invoice?.id]);

  async function pay() {
    if (busy || !invoice) return;
    setError("");
    setField(undefined);
    let body: Record<string, unknown>;
    try {
      if (user && choice) {
        if (choice.mode === "new") {
          const check = cardPayload(choice.value);
          if (!check.payload) {
            setField(check.field);
            throw new Error(check.error);
          }
        }
        setBusy(true);
        const methodId = await methodIdFor(choice);
        if (choice.mode === "new") setChoice({ mode: "saved", id: methodId });
        body = { methodId, key: key.current };
      } else {
        const check = cardPayload(card);
        if (!check.payload) {
          setField(check.field);
          throw new Error(check.error);
        }
        body = { type: check.payload.type, token: check.payload.token, key: key.current };
        setBusy(true);
      }
      const r = await api.post<{ payment: Payment; invoice: Invoice | null; paid: boolean }>(`/api/pay/${encodeURIComponent(token)}/pay`, body);
      setResult(r.payment);
      if (r.invoice) setInvoice(r.invoice);
    } catch (e) {
      if (!unknownOutcome(e)) key.current = newKey();
      setError(unknownOutcome(e) ? "We couldn't confirm the payment yet. Please don't pay again: reload this page in a minute." : e instanceof Error ? e.message : "The payment didn't go through.");
      if (e instanceof ApiError && e.status === 402) void load();
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <div className="bl-pay-page">
      <header className="bl-head">
        <div>
          <span className="bl-kicker">PAY A BILL</span>
          <h1>{invoice ? `${invoice.from?.name ?? invoice.stableName ?? "Your stable"}` : "Pay a bill"}</h1>
          {invoice && <p>{invoice.number} · secure payment through Stayblz</p>}
        </div>
      </header>
      <TestModeNotice />
      {missing ? (
        <div className="bl-card gx-glass bl-empty" role="alert">
          <strong>This pay link isn't active</strong>
          The bill was paid, cancelled or replaced by a new link. Ask whoever sent it for a new one.
        </div>
      ) : !invoice ? (
        loadError ? (
          <div className="bl-card gx-glass" role="alert">
            <p className="bl-error">{loadError}</p>
            <button type="button" className="btn btn-primary" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : (
          <p className="bl-muted" role="status">Loading the bill…</p>
        )
      ) : (
        <div className="bl-pay-grid">
          <InvoiceView invoice={invoice} actions={<button type="button" className="btn btn-quiet" onClick={() => window.print()}>Print or save as PDF</button>} />
          <aside className="bl-pay-box gx-glass bl-no-print" aria-label="Payment">
            {invoice.status === "paid" || result?.status === "succeeded" ? (
              <div className="bl-done" role="status">
                <span className="bl-done-mark" aria-hidden="true">✓</span>
                <p>
                  <strong>Paid. Thank you.</strong>
                  <br />
                  {result ? `${money(result.amount)} was paid (test mode).` : "This bill is paid."} Keep this page as your receipt, or print it.
                </p>
                {user ? <Link className="btn btn-quiet" to="/billing">Go to Billing</Link> : <Link className="btn btn-quiet" to="/signup">Create a free Stayblz account</Link>}
              </div>
            ) : result?.status === "processing" || invoice.inFlight ? (
              <div className="bl-done" role="status">
                <span className="bl-done-mark" aria-hidden="true">…</span>
                <p>Your bank payment is on its way. The bill is marked paid when it clears (a few days; minutes in test mode).</p>
              </div>
            ) : (
              <form
                className="bl-checkout"
                onSubmit={(e) => {
                  e.preventDefault();
                  void pay();
                }}
              >
                <div className="bl-summary">
                  <div>
                    <strong>Amount due</strong>
                    <small>{invoice.dueOn ? `Due ${dateText(invoice.dueOn)}` : ""}</small>
                  </div>
                  <div className="bl-summary-price">
                    <strong>{money(invoice.due)}</strong>
                  </div>
                </div>
                {user && overview && choice ? (
                  <MethodPicker methods={overview.methods} defaultId={overview.profile?.defaultMethodId} choice={choice} onChange={setChoice} allowCard={invoice.allowCard} allowBank={invoice.allowBank} disabled={busy} errorField={field} />
                ) : (
                  <CardFields value={card} onChange={setCard} allowCard={invoice.allowCard} allowBank={invoice.allowBank} errorField={field} disabled={busy} />
                )}
                {error && <p className="bl-error" role="alert">{error}</p>}
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? "Paying…" : `Pay ${money(invoice.due)}`}
                </button>
                <p className="bl-hint">
                  {invoice.allowBank ? "Bank transfers cost the stable less. " : ""}The stable never sees your card number.
                  {!user && " No Stayblz account needed."}
                </p>
              </form>
            )}
          </aside>
        </div>
      )}
    </div>
  );

  if (!standalone) return body;
  return (
    <div className="landing gx-layer gx-public">
      <PublicHeader />
      <main id="pay-main">{body}</main>
    </div>
  );
}
