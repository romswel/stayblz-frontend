import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../../../api";
import { useConfirm } from "../../ui/Confirm";
import InvoiceView from "../InvoiceView";
import { dateText, methodLabel, money, offlineLabel, type Invoice, type Payment } from "../billingApi";
import { useLoad } from "../useLoad";
import InvoiceEditor from "./InvoiceEditor";
import { RefundDialog, TakePaymentDialog } from "./PaymentDialogs";
import { payLink, useStableBilling, type Rate } from "./stableBillingApi";

const EVENT_WORDS: Record<string, string> = {
  "invoice.sent": "Sent",
  "invoice.voided": "Cancelled",
  "payment.succeeded": "Payment received",
  "payment.failed": "Payment failed",
  "payment.processing": "Bank payment started",
  "payment.refunded": "Refunded",
  "invoice.collect_failed": "Autopay try failed",
};

/** One invoice for the stable: send it, share its pay link, take payments, refund, cancel. */
export default function StableInvoiceDetail({ id, fees }: { id: string; fees?: Record<string, Rate> }) {
  const billing = useStableBilling();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const inv = useLoad(() => billing.invoice(id).then((r) => r.invoice), [billing, id]);
  const [editing, setEditing] = useState(false);
  const [taking, setTaking] = useState(false);
  const [refunding, setRefunding] = useState<Payment | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = inv.reload;
  useEffect(() => {
    if (!inv.data?.inFlight) return;
    const t = window.setInterval(() => document.visibilityState === "visible" && void reload(), 20_000);
    return () => window.clearInterval(t);
  }, [inv.data?.inFlight, reload]);

  if (inv.error && !inv.data)
    return (
      <section className="bl-card gx-glass" role="alert">
        <p className="bl-error">{inv.error}</p>
        <div className="bl-actions">
          <Link className="btn btn-quiet" to="/workspace/billing/invoices">
            All invoices
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => void inv.reload()}>
            Try again
          </button>
        </div>
      </section>
    );
  if (!inv.data) return <p className="bl-muted" role="status">Loading the invoice…</p>;
  const invoice: Invoice = inv.data;
  if (editing && invoice.status === "draft")
    return (
      <InvoiceEditor
        invoice={invoice}
        onSaved={(saved) => {
          setEditing(false);
          inv.setData(null);
          void inv.reload();
          setNotice(saved.status === "draft" ? "Draft saved." : `${saved.number} was sent.`);
        }}
      />
    );

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setNotice(done);
      await inv.reload();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }
  const link = payLink(invoice.payToken);
  const succeeded = (invoice.payments ?? []).filter((p) => p.status === "succeeded" && p.amount > p.refunded);

  return (
    <>
      {notice && <p className="bl-ok" role="status">{notice}</p>}
      {error && <p className="bl-error" role="alert">{error}</p>}
      <InvoiceView
        invoice={invoice}
        showFees
        actions={
          <>
            {invoice.status === "draft" && (
              <>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={async () => {
                  const ok = await confirm({ title: `Send ${money(invoice.total)} invoice to ${invoice.billTo?.name}?`, message: "It gets its number and a pay link. Sent invoices can't be edited, only cancelled.", confirmLabel: "Send invoice" });
                  if (ok) await act(() => billing.sendInvoice(invoice.id), "Sent. Share the pay link with your client.");
                }}>
                  Send
                </button>
                <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => setEditing(true)}>
                  Edit
                </button>
                <button type="button" className="btn btn-quiet" disabled={busy} onClick={async () => {
                  const ok = await confirm({ title: "Delete this draft?", message: "Its charges go back to Waiting to be billed.", confirmLabel: "Delete draft", tone: "danger" });
                  if (!ok) return;
                  setBusy(true);
                  try {
                    await billing.voidInvoice(invoice.id);
                    navigate("/workspace/billing/invoices", { replace: true });
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "It couldn't be deleted.");
                    setBusy(false);
                  }
                }}>
                  Delete draft
                </button>
              </>
            )}
            {invoice.status === "open" && (
              <>
                {!invoice.inFlight && (
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setTaking(true)}>
                    Take a payment
                  </button>
                )}
                {link && (
                  <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => navigator.clipboard?.writeText(link).then(() => setNotice("Pay link copied. Send it to your client by text, email or chat."), () => setNotice(link))}>
                    Copy pay link
                  </button>
                )}
                <button type="button" className="btn btn-quiet" disabled={busy} onClick={async () => {
                  const ok = await confirm({ title: "Make a new pay link?", message: "The old link stops working. Use this if a link was sent to the wrong person.", confirmLabel: "New link" });
                  if (ok) await act(() => billing.newLink(invoice.id), "New pay link made. The old one no longer works.");
                }}>
                  New link
                </button>
                {invoice.paid === 0 && !invoice.inFlight && (
                  <button type="button" className="btn btn-quiet" disabled={busy} onClick={async () => {
                    const ok = await confirm({ title: `Cancel ${invoice.number}?`, message: "The pay link stops working and its charges can be billed again. The number isn't reused.", confirmLabel: "Cancel invoice", tone: "danger" });
                    if (ok) await act(() => billing.voidInvoice(invoice.id), `${invoice.number} was cancelled.`);
                  }}>
                    Cancel invoice
                  </button>
                )}
              </>
            )}
            <button type="button" className="btn btn-quiet" onClick={() => window.print()}>
              Print or save as PDF
            </button>
          </>
        }
      />
      {link && invoice.status === "open" && (
        <section className="bl-card gx-glass bl-no-print" aria-labelledby="sb-link-h">
          <h2 id="sb-link-h">Pay link</h2>
          <p className="bl-muted">Anyone with this link can see and pay this bill, without a Stayblz account.</p>
          <label className="bl-field">
            <span className="sr-only">Pay link</span>
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
          </label>
          {invoice.autoCollect && <p className="bl-hint">Autopay is on for this client: we'll charge their saved card on {dateText(invoice.nextAttemptAt ?? invoice.dueOn)}.</p>}
        </section>
      )}
      {succeeded.length > 0 && (
        <section className="bl-card gx-glass bl-no-print" aria-labelledby="sb-refund-h">
          <h2 id="sb-refund-h">Refunds</h2>
          <ul className="bl-list">
            {succeeded.map((p) => (
              <li key={p.id}>
                <span className="bl-list-main">
                  <strong>{p.channel === "offline" ? offlineLabel[p.offlineKind ?? ""] ?? "Recorded" : methodLabel(p.method)}</strong>
                  <small>
                    {dateText(p.createdAt)} · {money(p.amount)}
                    {p.refunded ? ` · ${money(p.refunded)} refunded` : ""}
                  </small>
                </span>
                <button type="button" className="btn btn-quiet" onClick={() => setRefunding(p)}>
                  Refund
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(invoice.events?.length ?? 0) > 0 && (
        <details className="bl-card gx-glass bl-no-print">
          <summary>History</summary>
          <ul className="bl-list">
            {invoice.events!.map((e, i) => (
              <li key={i}>
                <span className="bl-list-main">
                  <strong>{EVENT_WORDS[e.event] ?? e.event}</strong>
                  <small>{new Date(e.at).toLocaleString()}</small>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {taking && (
        <TakePaymentDialog
          invoice={invoice}
          fees={fees}
          onClose={() => setTaking(false)}
          onDone={(m) => {
            setTaking(false);
            setNotice(m);
            void inv.reload();
          }}
        />
      )}
      {refunding && (
        <RefundDialog
          payment={refunding}
          refund={(body) => billing.refund(refunding.id, body)}
          onClose={() => setRefunding(null)}
          onDone={(m) => {
            setRefunding(null);
            setNotice(m);
            void inv.reload();
          }}
        />
      )}
    </>
  );
}
