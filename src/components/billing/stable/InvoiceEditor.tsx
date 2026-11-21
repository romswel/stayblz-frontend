import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../auth";
import { useConfirm } from "../../ui/Confirm";
import { accountDraftKey, useDraft } from "../../ui/useDraft";
import { CHARGE_CATEGORIES, categoryLabel, centsToInput, money, parseDollars, percent, type Invoice } from "../billingApi";
import { useLoad } from "../useLoad";
import ClientDialog from "./ClientDialog";
import { useStableBilling, type Client, type HorseOwners, type LineDraft } from "./stableBillingApi";

type Row = { key: string; category: string; description: string; quantity: string; price: string; taxable: boolean; horseId: string; serviceOn: string; shareBps: number | null; chargeId: string | null };
type Form = { clientId: string; dueOn: string; memo: string; taxRate: string; allowCard: boolean; allowBank: boolean; rows: Row[] };

let rowSeq = 0;
const blankRow = (): Row => ({ key: `r${++rowSeq}`, category: "training", description: "", quantity: "1", price: "", taxable: false, horseId: "", serviceOn: "", shareBps: null, chargeId: null });
/** Same rounding as the server: whole cents, half away from zero. */
export function lineAmount(quantity: number, unitCents: number, shareBps: number | null) {
  const n = Math.round(quantity * 100) * unitCents * (shareBps ?? 10000);
  return Math.sign(n) * Math.floor((Math.abs(n) + 500000) / 1000000);
}
const toRow = (l: NonNullable<Invoice["lines"]>[number]): Row => ({
  key: `r${++rowSeq}`,
  category: l.category,
  description: l.description,
  quantity: String(l.quantity),
  price: centsToInput(Math.abs(l.unit)),
  taxable: l.taxable,
  horseId: l.horseId ?? "",
  serviceOn: l.serviceOn ?? "",
  shareBps: l.shareBps,
  chargeId: l.chargeId,
});

export default function InvoiceEditor({ invoice, onSaved }: { invoice?: Invoice; onSaved?: (i: Invoice) => void }) {
  const billing = useStableBilling();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const clients = useLoad(() => billing.clients().then((r) => r.clients), [billing]);
  const horses = useLoad(() => billing.horses().then((r) => r.horses), [billing]);
  const [addingClient, setAddingClient] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const initial: Form = useMemo(
    () =>
      invoice
        ? {
            clientId: invoice.clientId ?? "",
            dueOn: invoice.dueOn ?? "",
            memo: invoice.memo,
            taxRate: invoice.taxRateBps ? String(invoice.taxRateBps / 100) : "",
            allowCard: invoice.allowCard,
            allowBank: invoice.allowBank,
            rows: (invoice.lines ?? []).map(toRow),
          }
        : { clientId: params.get("clientId") ?? "", dueOn: "", memo: "", taxRate: "", allowCard: true, allowBank: true, rows: [blankRow()] },
    // The form starts from the invoice it opened with.
    [invoice?.id],
  );
  // Only a brand-new invoice is kept as a draft in this browser (a saved draft lives on the server).
  const draftKey = invoice ? null : accountDraftKey(user?.id, `stable-invoice-${billing.stableId}`);
  const [form, setForm, discard, restored] = useDraft<Form>(draftKey, initial);
  useEffect(() => {
    if (!form.rows.length) setForm((f) => ({ ...f, rows: [blankRow()] }));
  }, [form.rows.length, setForm]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const setRow = (key: string, patch: Partial<Row>) => setForm((f) => ({ ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));

  const parsed = form.rows.map((r) => {
    const q = Number(r.quantity);
    const p = parseDollars(r.price);
    const unit = p === null ? null : r.category === "credit" ? -Math.abs(p) : Math.abs(p);
    return { row: r, quantity: q, unit, amount: unit === null || !Number.isFinite(q) ? 0 : lineAmount(q, unit, r.shareBps) };
  });
  const subtotal = parsed.reduce((n, p) => n + p.amount, 0);
  const taxBps = Math.round(Number(form.taxRate || 0) * 100);
  const taxable = parsed.filter((p) => p.row.taxable).reduce((n, p) => n + p.amount, 0);
  const tax = taxable > 0 && Number.isFinite(taxBps) ? Math.floor((taxable * taxBps + 5000) / 10000) : 0;
  const total = subtotal + tax;

  function body() {
    if (!form.clientId) throw new Error("Choose who the invoice is for.");
    const lines: LineDraft[] = parsed.map((p, i) => {
      if (!p.row.description.trim()) throw new Error(`Line ${i + 1}: add a description.`);
      if (!Number.isFinite(p.quantity) || p.quantity <= 0 || Math.round(p.quantity * 100) !== p.quantity * 100) throw new Error(`Line ${i + 1}: the quantity must be a number above 0, with up to 2 decimals.`);
      if (p.unit === null) throw new Error(`Line ${i + 1}: enter a price like 95.00.`);
      return {
        category: p.row.category,
        description: p.row.description.trim(),
        quantity: p.quantity,
        unitCents: p.unit,
        taxable: p.row.taxable,
        horseId: p.row.horseId || null,
        serviceOn: p.row.serviceOn || null,
        shareBps: p.row.shareBps,
        chargeId: p.row.chargeId,
      };
    });
    if (!Number.isFinite(taxBps) || taxBps < 0 || taxBps > 2500) throw new Error("Tax is 0 to 25%.");
    if (total < 0) throw new Error("The total can't be below zero.");
    if (!form.allowCard && !form.allowBank) throw new Error("Allow card or bank payments.");
    return { clientId: form.clientId, lines, memo: form.memo, dueOn: form.dueOn || null, taxRateBps: taxBps, allowCard: form.allowCard, allowBank: form.allowBank };
  }

  async function save(andSend: boolean) {
    setError("");
    let b;
    try {
      b = body();
    } catch (e) {
      return setError(e instanceof Error ? e.message : "Check the invoice.");
    }
    if (andSend) {
      const who = clients.data?.find((c) => c.id === form.clientId);
      const ok = await confirm({
        title: `Send ${money(total)} invoice to ${who?.name ?? "the client"}?`,
        message: `It gets its invoice number and a pay link.${who?.email ? ` If ${who.email} uses Stayblz, it also appears in their Billing page.` : " Share the pay link with them yourself."} Sent invoices can't be edited, only cancelled.`,
        confirmLabel: "Send invoice",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      let saved = invoice ? (await billing.saveInvoice(invoice.id, b)).invoice : (await billing.createInvoice(b)).invoice;
      if (!invoice) discard();
      if (andSend) saved = (await billing.sendInvoice(saved.id)).invoice;
      if (onSaved) onSaved(saved);
      else navigate(`/workspace/billing/invoices/${saved.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The invoice couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }

  const horseList: HorseOwners[] = horses.data ?? [];
  const clientList: Client[] = clients.data ?? [];

  return (
    <section className="bl-card gx-glass" aria-labelledby="sb-edit-h">
      <div className="bl-card-head">
        <h2 id="sb-edit-h">{invoice ? "Edit draft invoice" : "New invoice"}</h2>
        {restored && !invoice && (
          <p className="bl-hint" role="status">
            We kept what you typed.{" "}
            <button type="button" className="bl-link" onClick={discard}>
              Start over
            </button>
          </p>
        )}
      </div>
      {(clients.error || horses.error) && <p className="bl-error" role="alert">{clients.error || horses.error}</p>}
      <form
        className="bl-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <div className="bl-row2">
          <label className="bl-field">
            <span>Bill to</span>
            <span className="bl-input-with">
              <select value={form.clientId} onChange={(e) => set({ clientId: e.target.value })} disabled={busy}>
                <option value="">{clients.loading && !clients.data ? "Loading clients…" : "Choose a client"}</option>
                {clientList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.email ? ` (${c.email})` : ""}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-quiet" onClick={() => setAddingClient(true)} disabled={busy}>
                New client
              </button>
            </span>
          </label>
          <label className="bl-field">
            <span className="ld-label">
              Due date <em>Optional: your usual terms</em>
            </span>
            <input type="date" value={form.dueOn} onChange={(e) => set({ dueOn: e.target.value })} disabled={busy} />
          </label>
        </div>

        <fieldset className="bl-lines-edit" disabled={busy}>
          <legend>Lines</legend>
          {form.rows.map((r, i) => {
            const p = parsed[i];
            return (
              <div className="bl-line-row" key={r.key}>
                <label className="bl-field">
                  <span>Type</span>
                  <select value={r.category} onChange={(e) => setRow(r.key, { category: e.target.value })}>
                    {CHARGE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="bl-field bl-line-desc-field">
                  <span>Description</span>
                  <input value={r.description} maxLength={200} onChange={(e) => setRow(r.key, { description: e.target.value })} placeholder={r.category === "training" ? "Day rate, November" : ""} />
                </label>
                <label className="bl-field">
                  <span className="ld-label">
                    Horse <em>Optional</em>
                  </span>
                  <select value={r.horseId} onChange={(e) => setRow(r.key, { horseId: e.target.value })}>
                    <option value="">—</option>
                    {horseList.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="bl-field bl-line-qty">
                  <span>Qty</span>
                  <input inputMode="decimal" value={r.quantity} onChange={(e) => setRow(r.key, { quantity: e.target.value.replace(/[^\d.]/g, "") })} />
                </label>
                <label className="bl-field bl-line-price">
                  <span>{r.category === "credit" ? "Credit ($)" : "Price ($)"}</span>
                  <input inputMode="decimal" value={r.price} onChange={(e) => setRow(r.key, { price: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="0.00" />
                </label>
                <div className="bl-line-total">
                  <span className="bl-label">Amount</span>
                  <strong>{money(p.amount)}</strong>
                  {r.shareBps && <small>{percent(r.shareBps)} share</small>}
                </div>
                <label className="bl-check bl-line-tax">
                  <input type="checkbox" checked={r.taxable} onChange={(e) => setRow(r.key, { taxable: e.target.checked })} />
                  <span>Taxed</span>
                </label>
                <button
                  type="button"
                  className="btn btn-quiet bl-line-remove"
                  aria-label={`Remove line ${i + 1}`}
                  onClick={() => setForm((f) => ({ ...f, rows: f.rows.filter((x) => x.key !== r.key) }))}
                  disabled={form.rows.length === 1}
                >
                  Remove
                </button>
              </div>
            );
          })}
          <button type="button" className="btn btn-quiet" onClick={() => setForm((f) => ({ ...f, rows: [...f.rows, blankRow()] }))} disabled={form.rows.length >= 100}>
            Add line
          </button>
        </fieldset>

        <div className="bl-row3">
          <label className="bl-field">
            <span className="ld-label">
              Sales tax % <em>Only on lines marked Taxed</em>
            </span>
            <input inputMode="decimal" value={form.taxRate} onChange={(e) => set({ taxRate: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0" disabled={busy} />
          </label>
          <label className="bl-check">
            <input type="checkbox" checked={form.allowCard} onChange={(e) => set({ allowCard: e.target.checked })} disabled={busy} />
            <span>Accept cards</span>
          </label>
          <label className="bl-check">
            <input type="checkbox" checked={form.allowBank} onChange={(e) => set({ allowBank: e.target.checked })} disabled={busy} />
            <span>Accept bank transfer (lowest fee)</span>
          </label>
        </div>
        <label className="bl-field">
          <span className="ld-label">
            Note to the client <em>Optional</em>
          </span>
          <textarea value={form.memo} maxLength={1000} onChange={(e) => set({ memo: e.target.value })} placeholder="Thank you! Questions about this bill? Message us in Stayblz Chat." disabled={busy} />
        </label>

        <dl className="bl-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          {tax > 0 && (
            <div>
              <dt>Tax ({form.taxRate}%)</dt>
              <dd>{money(tax)}</dd>
            </div>
          )}
          <div className="is-total">
            <dt>Total</dt>
            <dd>{money(total)}</dd>
          </div>
        </dl>
        {error && <p className="bl-error" role="alert">{error}</p>}
        <div className="bl-actions">
          <Link className="btn btn-quiet" to={invoice ? `/workspace/billing/invoices/${invoice.id}` : "/workspace/billing/invoices"}>
            Cancel
          </Link>
          <button type="submit" className="btn btn-quiet" disabled={busy}>
            {busy ? "Saving…" : "Save draft"}
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save(true)}>
            Save and send
          </button>
        </div>
      </form>
      {addingClient && (
        <ClientDialog
          onClose={() => setAddingClient(false)}
          onSaved={(c) => {
            setAddingClient(false);
            void clients.reload().then(() => set({ clientId: c.id }));
          }}
        />
      )}
    </section>
  );
}
