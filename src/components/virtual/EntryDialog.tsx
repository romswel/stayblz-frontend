import { useState, type FormEvent } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { TopLayer } from "../community/HorseShare";
import { KIND_LABELS, SALE_LABELS, todayIso, type EntryInput, type EntryKind, type SaleResult, type VirtualEntry } from "./api";

const SURFACES = ["", "Dirt", "Turf", "Synthetic", "All weather"];

/** Log (or edit) a workout, race, sales entry or note. The fields shown depend on the kind. */
export default function EntryDialog({
  horseName,
  kind: initialKind,
  entry,
  onClose,
  onSave,
}: {
  horseName: string;
  kind: EntryKind;
  entry?: VirtualEntry;
  onClose: () => void;
  onSave: (input: EntryInput) => Promise<void>;
}) {
  const [kind, setKind] = useState<EntryKind>(entry?.kind ?? initialKind);
  const [f, setF] = useState({
    entryDate: entry?.entryDate ?? todayIso(),
    title: entry?.title ?? "",
    track: entry?.track ?? "",
    distance: entry?.distance ?? "",
    surface: entry?.surface ?? "",
    timeText: entry?.timeText ?? "",
    finish: entry?.finish ? String(entry.finish) : "",
    fieldSize: entry?.fieldSize ? String(entry.fieldSize) : "",
    result: entry?.result ?? (initialKind === "sale" ? "entered" : ""),
    hipNumber: entry?.hipNumber ?? "",
    amount: entry?.amountCents != null ? String(entry.amountCents / 100) : "",
    notes: entry?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const amount = f.amount.trim() === "" ? null : Math.round(Number(f.amount.replace(/[$,\s]/g, "")) * 100);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return setError("Enter the amount in dollars, like 25000.");
    setBusy(true);
    setError("");
    try {
      await onSave({
        kind,
        entryDate: f.entryDate,
        title: f.title,
        track: f.track,
        distance: f.distance,
        surface: f.surface,
        timeText: f.timeText,
        finish: f.finish ? Number(f.finish) : null,
        fieldSize: f.fieldSize ? Number(f.fieldSize) : null,
        result: kind === "sale" ? f.result || "entered" : f.result,
        hipNumber: f.hipNumber,
        amountCents: amount,
        notes: f.notes,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "This entry couldn't be saved.");
      setBusy(false);
    }
  }

  const input = (k: keyof typeof f, label: string, max: number, extra: Record<string, unknown> = {}) => (
    <label className="vs-field">
      <span>{label}</span>
      <input value={f[k]} onChange={set(k)} maxLength={max} {...extra} />
    </label>
  );
  const surface = (
    <label className="vs-field">
      <span>Surface</span>
      <select value={f.surface} onChange={set("surface")}>
        {SURFACES.map((s) => (
          <option key={s} value={s}>{s || "—"}</option>
        ))}
      </select>
    </label>
  );

  return (
    <TopLayer>
      <Modal label={`${entry ? "Edit" : "Log"} ${KIND_LABELS[kind].toLowerCase()} for ${horseName}`} className="gx-layer vs-dialog" onClose={onClose}>
        <DialogHead kicker={horseName} title={`${entry ? "Edit" : "Log a"} ${KIND_LABELS[kind].toLowerCase()}`} onClose={onClose} />
        <form className="vs-form" onSubmit={submit}>
          {!entry && (
            <div className="vs-seg" role="radiogroup" aria-label="Entry type">
              {(Object.keys(KIND_LABELS) as EntryKind[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} className="vs-seg-btn" onClick={() => setKind(k)}>
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          )}
          <div className="vs-grid">
            {input("entryDate", "Date *", 10, { type: "date", required: true })}
            {kind === "workout" && (
              <>
                {input("track", "Track", 80)}
                {input("distance", "Distance", 40, { placeholder: "4f" })}
                {surface}
                {input("timeText", "Time", 20, { placeholder: ":48.20" })}
                {input("result", "Rank / grade", 40, { placeholder: "3/42, breezing" })}
              </>
            )}
            {kind === "race" && (
              <>
                {input("title", "Race", 120, { placeholder: "Maiden Special Weight" })}
                {input("track", "Track", 80)}
                {input("distance", "Distance", 40, { placeholder: "6f" })}
                {surface}
                {input("finish", "Finish", 2, { inputMode: "numeric", type: "number", min: 1, max: 40 })}
                {input("fieldSize", "Field size", 2, { inputMode: "numeric", type: "number", min: 1, max: 40 })}
                {input("amount", "Earnings ($)", 16, { inputMode: "decimal" })}
              </>
            )}
            {kind === "sale" && (
              <>
                {input("title", "Sale / auction *", 120, { required: true, placeholder: "Keeneland September Yearling" })}
                {input("track", "Location", 80)}
                {input("hipNumber", "Hip number", 20)}
                <label className="vs-field">
                  <span>Status</span>
                  <select value={f.result || "entered"} onChange={set("result")}>
                    {(Object.keys(SALE_LABELS) as SaleResult[]).map((r) => (
                      <option key={r} value={r}>{SALE_LABELS[r]}</option>
                    ))}
                  </select>
                </label>
                {input("amount", f.result === "sold" || f.result === "private" ? "Price ($)" : "Price / reserve ($)", 16, { inputMode: "decimal" })}
              </>
            )}
            {kind === "note" && input("title", "Title", 120)}
          </div>
          <label className="vs-field">
            <span>{kind === "note" ? "Note *" : "Notes"}</span>
            <textarea value={f.notes} onChange={set("notes")} maxLength={2000} rows={kind === "note" ? 5 : 3} required={kind === "note"} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="vs-form-actions">
            <button type="button" className="vs-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="vs-btn vs-btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </TopLayer>
  );
}
