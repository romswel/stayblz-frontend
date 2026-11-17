import { useState } from "react";
import { useAuth } from "../../auth";
import PersonPicker from "../messenger/PersonPicker";
import type { Person } from "../messenger/types";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { PADDOCK_NAME } from "./brand";
import type { PaddockCall } from "./engine/call";
import { LAYOUTS, type LayoutMode, type ViewPrefs } from "./layout";
import "../messenger/messenger.css";
import "../messenger/panels.css";

/** Add Stayblz members to this meeting: they join straight in, and their phones and browsers ring. */
export function AddPeopleDialog({ call, onClose }: { call: PaddockCall; onClose: () => void }) {
  const { user } = useAuth();
  const [picked, setPicked] = useState<Person[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function add() {
    if (!picked.length) return setError("Choose at least one person.");
    setBusy(true);
    setError("");
    try {
      await call.addPeople(picked.map((p) => p.id));
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "They weren't added. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal label="Add people" className="modal-sm gx-layer pd-modal" onClose={onClose}>
      <DialogHead kicker={PADDOCK_NAME} title="Add people" onClose={onClose} />
      <div className="dlg pd-dlg">
        <p className="pd-small">They can join straight away. We'll ring them on Stayblz wherever they're signed in.</p>
        <PersonPicker picked={picked} onChange={setPicked} exclude={user ? [user.id] : []} max={20} />
        {error && (
          <p className="pd-error-text" role="alert">
            {error}
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !picked.length} onClick={() => void add()}>
            {busy ? "Adding…" : picked.length > 1 ? `Add and ring ${picked.length} people` : "Add and ring"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Little drawings of each layout. */
function LayoutArt({ mode }: { mode: LayoutMode }) {
  const box = (x: number, y: number, w: number, h: number, key: string, strong = false) => (
    <rect key={key} x={x} y={y} width={w} height={h} rx="3" className={strong ? "is-strong" : undefined} />
  );
  const shapes =
    mode === "grid"
      ? [box(4, 4, 26, 17, "a"), box(34, 4, 26, 17, "b"), box(4, 25, 26, 17, "c"), box(34, 25, 26, 17, "d")]
      : mode === "spotlight"
        ? [box(4, 4, 56, 38, "a", true)]
        : mode === "sidebar"
          ? [box(4, 4, 40, 38, "a", true), box(48, 4, 12, 11, "b"), box(48, 17.5, 12, 11, "c"), box(48, 31, 12, 11, "d")]
          : [box(4, 4, 56, 38, "a", true), box(44, 28, 14, 11, "b")];
  return (
    <svg className="pd-layout-art" viewBox="0 0 64 46" aria-hidden="true">
      {shapes}
    </svg>
  );
}

export function LayoutDialog({ prefs, onChange, onClose }: { prefs: ViewPrefs; onChange: (prefs: ViewPrefs) => void; onClose: () => void }) {
  return (
    <Modal label="Change layout" className="modal-sm gx-layer pd-modal" onClose={onClose}>
      <DialogHead kicker={PADDOCK_NAME} title="Change layout" onClose={onClose} />
      <div className="dlg pd-dlg">
        <p className="pd-small">Only changes what you see. It's saved on this device.</p>
        <fieldset className="pd-layouts">
          <legend className="sr-only">Layout</legend>
          {LAYOUTS.map((l) => (
            <label key={l.value} className={`pd-layout${prefs.mode === l.value ? " is-on" : ""}`}>
              <input type="radio" name="pd-layout" checked={prefs.mode === l.value} onChange={() => onChange({ ...prefs, mode: l.value })} />
              <LayoutArt mode={l.value} />
              <span>
                <strong>{l.label}</strong>
                <small>{l.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="pd-switch">
          <span>
            <strong>Hide tiles without video</strong>
            <small>People with their camera off still show in People, and when they talk.</small>
          </span>
          <input type="checkbox" role="switch" checked={prefs.hideNoVideo} onChange={(e) => onChange({ ...prefs, hideNoVideo: e.target.checked })} />
        </label>
        <label className="pd-switch">
          <span>
            <strong>Hide my own tile</strong>
            <small>Others still see you.</small>
          </span>
          <input type="checkbox" role="switch" checked={prefs.hideSelf} onChange={(e) => onChange({ ...prefs, hideSelf: e.target.checked })} />
        </label>
        <div className="dlg-actions">
          <span />
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
