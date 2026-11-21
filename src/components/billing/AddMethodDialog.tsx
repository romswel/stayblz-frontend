import { useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import CardFields, { cardPayload, emptyCard } from "./CardFields";
import TestModeNotice from "./TestModeNotice";
import { billingApi } from "./billingApi";
import "./billing.css";

/** Add a card or bank account to your account (test mode: Stayblz test numbers only). */
export default function AddMethodDialog({ onClose, onAdded, first }: { onClose: () => void; onAdded: () => void; first: boolean }) {
  const [value, setValue] = useState(emptyCard());
  const [makeDefault, setMakeDefault] = useState(first);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [field, setField] = useState<string>();

  async function save() {
    const check = cardPayload(value);
    setField(check.field);
    if (!check.payload) return setError(check.error ?? "Check the details.");
    setBusy(true);
    setError("");
    try {
      await billingApi.addMethod({ ...check.payload, makeDefault });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "It couldn't be added.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal label="Add a payment method" onClose={busy ? () => undefined : onClose} className="modal-wide gx-layer bl-dialog">
      <DialogHead kicker="PAYMENT METHODS" title="Add a card or bank account" onClose={busy ? undefined : onClose} />
      <form
        className="dlg bl-checkout"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TestModeNotice compact />
        <CardFields value={value} onChange={setValue} errorField={field} disabled={busy} />
        <label className="bl-check">
          <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} disabled={busy || first} />
          <span>Use it for my plans and bills by default</span>
        </label>
        <p className="bl-hint">Stayblz keeps only the last 4 digits and the expiry. The full number is never stored.</p>
        {error && <p className="bl-error" role="alert">{error}</p>}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : value.kind === "card" ? "Save card" : "Save bank account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
