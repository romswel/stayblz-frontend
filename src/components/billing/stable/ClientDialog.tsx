import { useState } from "react";
import Modal from "../../Modal";
import DialogHead from "../../ui/DialogHead";
import { useStableBilling, type Client } from "./stableBillingApi";

/** Add or edit a client (an owner, a partnership, a breeder you bill). */
export default function ClientDialog({ client, onClose, onSaved }: { client?: Client; onClose: () => void; onSaved: (c: Client) => void }) {
  const billing = useStableBilling();
  const [form, setForm] = useState({ name: client?.name ?? "", email: client?.email ?? "", phone: client?.phone ?? "", company: client?.company ?? "", notes: client?.notes ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal label={client ? "Edit client" : "New client"} onClose={busy ? () => undefined : onClose} className="gx-layer bl-dialog">
      <DialogHead kicker="CLIENTS" title={client ? `Edit ${client.name}` : "New client"} onClose={busy ? undefined : onClose} />
      <form
        className="dlg bl-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!form.name.trim()) return setError("Enter a name.");
          setBusy(true);
          setError("");
          try {
            const r = client ? await billing.editClient(client.id, form) : await billing.addClient(form);
            onSaved(r.client);
          } catch (err) {
            setError(err instanceof Error ? err.message : "The client couldn't be saved.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="bl-field">
          <span>Name</span>
          <input value={form.name} onChange={set("name")} maxLength={120} data-autofocus />
        </label>
        <label className="bl-field">
          <span className="ld-label">
            Email <em>Recommended</em>
          </span>
          <input type="email" value={form.email} onChange={set("email")} maxLength={254} />
        </label>
        <p className="bl-hint">If they use Stayblz with this email, their bills appear in their Billing page and they're told when one arrives.</p>
        <div className="bl-row2">
          <label className="bl-field">
            <span className="ld-label">
              Phone <em>Optional</em>
            </span>
            <input type="tel" value={form.phone} onChange={set("phone")} maxLength={40} />
          </label>
          <label className="bl-field">
            <span className="ld-label">
              Company or partnership <em>Optional</em>
            </span>
            <input value={form.company} onChange={set("company")} maxLength={120} />
          </label>
        </div>
        <label className="bl-field">
          <span className="ld-label">
            Private notes <em>Optional</em>
          </span>
          <textarea value={form.notes} onChange={set("notes")} maxLength={1000} />
        </label>
        {error && <p className="bl-error" role="alert">{error}</p>}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save client"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
