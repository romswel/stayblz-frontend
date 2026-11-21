import { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../../Modal";
import DialogHead from "../../ui/DialogHead";
import { useConfirm } from "../../ui/Confirm";
import { CHARGE_CATEGORIES, categoryLabel, centsToInput, dateText, money, parseDollars, type Invoice } from "../billingApi";
import { useLoad } from "../useLoad";
import { lineAmount } from "./InvoiceEditor";
import { useStableBilling, type Charge, type Client, type HorseOwners } from "./stableBillingApi";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Charges: work done for a horse (billed to its owners by their shares) or for one client, waiting to be billed.
 * "Bill owners" turns everything up to a date into one draft invoice per owner.
 */
export default function StableCharges() {
  const billing = useStableBilling();
  const confirm = useConfirm();
  const [view, setView] = useState<"unbilled" | "billed">("unbilled");
  const charges = useLoad(() => billing.charges(view).then((r) => r.charges), [billing, view]);
  const horses = useLoad(() => billing.horses().then((r) => r.horses), [billing]);
  const clients = useLoad(() => billing.clients().then((r) => r.clients), [billing]);
  const [editing, setEditing] = useState<Charge | "new" | null>(null);
  const [billingRun, setBillingRun] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const total = (charges.data ?? []).reduce((n, c) => n + c.amount, 0);
  const clientName = (id: string | null) => clients.data?.find((c) => c.id === id)?.name ?? "";

  return (
    <section className="bl-card gx-glass" aria-labelledby="sb-charges-h">
      <div className="bl-card-head">
        <h2 id="sb-charges-h">Charges</h2>
        <div className="bl-actions">
          <button type="button" className="btn btn-quiet" onClick={() => setEditing("new")}>
            Add charge
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setBillingRun(true)} disabled={view === "unbilled" && !charges.data?.length}>
            Bill owners
          </button>
        </div>
      </div>
      <p className="bl-muted">Day rates, board, vet, farrier, shipping, entry fees… A horse's charges are split between its owners by their shares (set them in Clients).</p>
      <div className="bl-chips" role="group" aria-label="Show">
        <button type="button" aria-pressed={view === "unbilled"} onClick={() => setView("unbilled")}>
          Waiting to be billed
        </button>
        <button type="button" aria-pressed={view === "billed"} onClick={() => setView("billed")}>
          Billed
        </button>
      </div>
      {notice && <p className="bl-ok" role="status">{notice}</p>}
      {(charges.error || error) && <p className="bl-error" role="alert">{charges.error || error}</p>}
      {!charges.data ? (
        !charges.error && <p className="bl-muted" role="status">Loading charges…</p>
      ) : charges.data.length === 0 ? (
        <div className="bl-empty">
          <strong>{view === "unbilled" ? "Nothing waiting to be billed" : "Nothing billed yet"}</strong>
          {view === "unbilled" && "Add the month's day rates and expenses here as they happen."}
        </div>
      ) : (
        <div className="bl-table-wrap">
          <table className="bl-table">
            <caption className="sr-only">Charges</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Charge</th>
                <th scope="col">Bill to</th>
                <th scope="col" className="num">Qty × price</th>
                <th scope="col" className="num">Amount</th>
                {view === "unbilled" && <th scope="col"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {charges.data.map((c) => (
                <tr key={c.id}>
                  <td>{dateText(c.serviceOn)}</td>
                  <td>
                    <span className="bl-line-desc">{c.description}</span>
                    <small>{categoryLabel[c.category]}</small>
                  </td>
                  <td>{c.clientId ? clientName(c.clientId) || "Client" : c.horseName ? `${c.horseName}'s owners` : "—"}</td>
                  <td className="num">
                    {c.quantity} × {money(c.unit)}
                  </td>
                  <td className="num">{money(c.amount)}</td>
                  {view === "unbilled" && (
                    <td className="num">
                      <button type="button" className="bl-link" onClick={() => setEditing(c)}>
                        Edit
                      </button>{" "}
                      <button
                        type="button"
                        className="bl-link"
                        onClick={async () => {
                          if (!(await confirm({ title: "Remove this charge?", message: c.description, confirmLabel: "Remove", tone: "danger" }))) return;
                          try {
                            await billing.removeCharge(c.id);
                            void charges.reload();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "It couldn't be removed.");
                          }
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td className="num">
                  <strong>{money(total)}</strong>
                </td>
                {view === "unbilled" && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {editing && (
        <ChargeDialog
          charge={editing === "new" ? undefined : editing}
          horses={horses.data ?? []}
          clients={clients.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice("Charge saved.");
            void charges.reload();
          }}
        />
      )}
      {billingRun && (
        <BillOwnersDialog
          onClose={() => setBillingRun(false)}
          onDone={() => {
            void charges.reload();
          }}
        />
      )}
    </section>
  );
}

function ChargeDialog({ charge, horses, clients, onClose, onSaved }: { charge?: Charge; horses: HorseOwners[]; clients: Client[]; onClose: () => void; onSaved: () => void }) {
  const billing = useStableBilling();
  const [form, setForm] = useState({
    billTo: charge?.clientId ? "client" : "horse",
    horseId: charge?.horseId ?? horses[0]?.id ?? "",
    clientId: charge?.clientId ?? clients[0]?.id ?? "",
    category: charge?.category ?? "training",
    description: charge?.description ?? "",
    quantity: String(charge?.quantity ?? 1),
    price: charge ? centsToInput(Math.abs(charge.unit)) : "",
    serviceOn: charge?.serviceOn ?? today(),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const cents = parseDollars(form.price);
  const unit = cents === null ? null : form.category === "credit" ? -Math.abs(cents) : Math.abs(cents);
  const q = Number(form.quantity);
  const horse = horses.find((h) => h.id === form.horseId);
  return (
    <Modal label={charge ? "Edit charge" : "Add charge"} onClose={busy ? () => undefined : onClose} className="modal-wide gx-layer bl-dialog">
      <DialogHead kicker="CHARGES" title={charge ? "Edit charge" : "Add a charge"} onClose={busy ? undefined : onClose} />
      <form
        className="dlg bl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (unit === null) return setError("Enter a price like 95.00.");
          if (!Number.isFinite(q) || q <= 0) return setError("Enter a quantity above 0.");
          setBusy(true);
          setError("");
          const body = {
            horseId: form.billTo === "horse" ? form.horseId || null : null,
            clientId: form.billTo === "client" ? form.clientId || null : null,
            category: form.category,
            description: form.description,
            quantity: q,
            unitCents: unit,
            serviceOn: form.serviceOn,
          };
          try {
            if (charge) await billing.editCharge(charge.id, body);
            else await billing.addCharge(body);
            onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : "The charge couldn't be saved.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="bl-seg" role="radiogroup" aria-label="Bill to">
          <button type="button" role="radio" aria-checked={form.billTo === "horse"} className={form.billTo === "horse" ? "is-on" : ""} onClick={() => set({ billTo: "horse" })}>
            A horse's owners
          </button>
          <button type="button" role="radio" aria-checked={form.billTo === "client"} className={form.billTo === "client" ? "is-on" : ""} onClick={() => set({ billTo: "client" })}>
            One client
          </button>
        </div>
        {form.billTo === "horse" ? (
          <label className="bl-field">
            <span>Horse</span>
            <select value={form.horseId} onChange={(e) => set({ horseId: e.target.value })}>
              {horses.length === 0 && <option value="">Add horses in Inventory first</option>}
              {horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.owners.length ? ` (${h.owners.map((o) => o.name).join(", ")})` : " (no owners yet)"}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="bl-field">
            <span>Client</span>
            <select value={form.clientId} onChange={(e) => set({ clientId: e.target.value })}>
              {clients.length === 0 && <option value="">Add a client first</option>}
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {form.billTo === "horse" && horse && horse.owners.length === 0 && (
          <p className="bl-hint">
            {horse.name} has no owners yet: the charge waits until you add them in <Link to="/workspace/billing/clients">Clients</Link>.
          </p>
        )}
        <div className="bl-row2">
          <label className="bl-field">
            <span>Type</span>
            <select value={form.category} onChange={(e) => set({ category: e.target.value })}>
              {CHARGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel[c]}
                </option>
              ))}
            </select>
          </label>
          <label className="bl-field">
            <span>Date</span>
            <input type="date" value={form.serviceOn} onChange={(e) => set({ serviceOn: e.target.value })} required />
          </label>
        </div>
        <label className="bl-field">
          <span>Description</span>
          <input value={form.description} maxLength={200} onChange={(e) => set({ description: e.target.value })} placeholder="Day rate, November 1-30" data-autofocus />
        </label>
        <div className="bl-row2">
          <label className="bl-field">
            <span>Quantity (days, items…)</span>
            <input inputMode="decimal" value={form.quantity} onChange={(e) => set({ quantity: e.target.value.replace(/[^\d.]/g, "") })} />
          </label>
          <label className="bl-field">
            <span>{form.category === "credit" ? "Credit ($)" : "Price each ($)"}</span>
            <input inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="95.00" />
          </label>
        </div>
        <p className="bl-ok">Amount: {money(unit === null || !Number.isFinite(q) ? 0 : lineAmount(q, unit, null))}</p>
        {error && <p className="bl-error" role="alert">{error}</p>}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save charge"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BillOwnersDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const billing = useStableBilling();
  const [through, setThrough] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ invoices: Invoice[]; skipped: { chargeId: string; horseName: string; description: string; amount: number; reason: string }[] } | null>(null);
  return (
    <Modal label="Bill owners" onClose={busy ? () => undefined : onClose} className="modal-wide gx-layer bl-dialog">
      <DialogHead kicker="CHARGES" title="Bill owners" onClose={busy ? undefined : onClose} />
      {result ? (
        <div className="dlg bl-form" role="status">
          {result.invoices.length === 0 ? (
            <p className="bl-muted">No invoices were made: nothing up to that date had owners or a client to bill.</p>
          ) : (
            <>
              <p className="bl-ok">
                {result.invoices.length} draft invoice{result.invoices.length === 1 ? "" : "s"} made. Check them, then send.
              </p>
              <ul className="bl-list">
                {result.invoices.map((i) => (
                  <li key={i.id}>
                    <span className="bl-list-main">
                      <Link to={`/workspace/billing/invoices/${i.id}`} onClick={onClose}>
                        {i.billTo?.name}
                      </Link>
                    </span>
                    <span className="bl-amount">{money(i.total)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.skipped.length > 0 && (
            <>
              <p className="bl-error">{result.skipped.length} charge{result.skipped.length === 1 ? " is" : "s are"} still waiting (no owners on the horse):</p>
              <ul className="bl-list">
                {result.skipped.map((s) => (
                  <li key={s.chargeId}>
                    <span className="bl-list-main">
                      <strong>{s.horseName || "No horse"}</strong>
                      <small>{s.description}</small>
                    </span>
                    <span className="bl-amount">{money(s.amount)}</span>
                  </li>
                ))}
              </ul>
              <Link className="btn btn-quiet" to="/workspace/billing/clients" onClick={onClose}>
                Set owners in Clients
              </Link>
            </>
          )}
          <div className="dlg-actions">
            <Link className="btn btn-quiet" to="/workspace/billing/invoices" onClick={onClose}>
              See invoices
            </Link>
            <button type="button" className="btn btn-primary" onClick={onClose} data-autofocus>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form
          className="dlg bl-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await billing.billOwners({ through });
              setResult(r);
              onDone();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Billing couldn't run.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="bl-muted">
            Every charge waiting to be billed, up to this date, goes on one draft invoice per owner. A horse's charges are split by owner shares, to the cent. Nothing is sent until you send each invoice.
          </p>
          <label className="bl-field">
            <span>Bill charges up to</span>
            <input type="date" value={through} onChange={(e) => setThrough(e.target.value)} required />
          </label>
          {error && <p className="bl-error" role="alert">{error}</p>}
          <div className="dlg-actions">
            <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Making invoices…" : "Make draft invoices"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
