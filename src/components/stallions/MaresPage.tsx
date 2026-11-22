import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth";
import Modal from "../Modal";
import { useConfirm } from "../ui/Confirm";
import DialogHead from "../ui/DialogHead";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import { stallionsApi } from "./api";
import MareFields, { emptyMare } from "./MareFields";
import { GENETIC_TESTS, breedLabel, geneticResult } from "./options";
import StallionsNav from "./StallionsNav";
import type { MareDraft, SavedMare } from "./types";

/** Your mares (pedigree and genetic tests), ready for the mating check and breeding requests. Only you see them. */
export default function MaresPage() {
  const confirm = useConfirm();
  const [state, setState] = useState<{ loading: boolean; error: string; list: SavedMare[] }>({ loading: true, error: "", list: [] });
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<SavedMare | "new" | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    stallionsApi
      .mares()
      .then((list) => live && setState({ loading: false, error: "", list }))
      .catch((e) => live && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Your mares couldn't be loaded." })));
    return () => {
      live = false;
    };
  }, [version]);

  async function remove(m: SavedMare) {
    if (!(await confirm({ title: `Remove ${m.name}?`, message: "She's taken off your saved mares. Requests you already sent keep her details.", confirmLabel: "Remove mare", tone: "danger" }))) return;
    setNotice("");
    try {
      await stallionsApi.removeMare(m.id);
      setState((s) => ({ ...s, list: s.list.filter((x) => x.id !== m.id) }));
    } catch (e) {
      setNotice(`${m.name} couldn't be removed. ${e instanceof Error ? e.message : "Try again."}`);
    }
  }

  return (
    <div className="st-page">
      <StallionsNav
        signedIn
        title="My mares"
        lead="Save your mares once, then check them against any stallion and send requests in a click. Only you see them."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            Add a mare
          </button>
        }
      />
      {notice && (
        <p className="st-alert is-error" role="alert">
          {notice}
        </p>
      )}
      {state.loading && !state.list.length ? (
        <p className="st-count-line" role="status">
          Loading…
        </p>
      ) : state.error && !state.list.length ? (
        <div className="st-empty gx-glass" role="alert">
          <h2>Your mares couldn't be loaded.</h2>
          <p>{state.error}</p>
          <button type="button" className="btn btn-quiet" onClick={() => setVersion((v) => v + 1)}>
            Try again
          </button>
        </div>
      ) : !state.list.length ? (
        <div className="st-empty gx-glass">
          <h2>No mares saved yet.</h2>
          <p>Add her name and pedigree (we fill in what Stayblz knows) and any genetic test results.</p>
          <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
            Add a mare
          </button>
        </div>
      ) : (
        <ul className="st-mares">
          {state.list.map((m) => {
            const tests = GENETIC_TESTS.filter((t) => m.genetics[t.key] !== undefined);
            return (
              <li key={m.id} className="st-mare-card gx-glass">
                <h2>{m.name}</h2>
                <p className="st-muted">
                  {breedLabel(m.breed)}
                  {m.foaled ? ` · ${m.foaled}` : ""}
                </p>
                <p>{[m.pedigree.s && `by ${m.pedigree.s}`, m.pedigree.d && `out of ${m.pedigree.d}`, m.pedigree.ds && `(by ${m.pedigree.ds})`].filter(Boolean).join(" ") || "No pedigree yet"}</p>
                {tests.length > 0 && <p className="st-muted">{tests.map((t) => `${t.label} ${geneticResult(t.key, m.genetics[t.key])}`).join(" · ")}</p>}
                <div className="st-actions">
                  <Link to="/stallions/mating" className="btn btn-primary">
                    Check against stallions
                  </Link>
                  <button type="button" className="btn btn-quiet" onClick={() => setEditing(m)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-quiet st-danger-text" onClick={() => void remove(m)}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <MareDialog
          mare={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setState((s) => ({ ...s, list: [...s.list.filter((x) => x.id !== m.id), m].sort((a, b) => a.name.localeCompare(b.name)) }));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MareDialog({ mare, onClose, onSaved }: { mare: SavedMare | null; onClose: () => void; onSaved: (m: SavedMare) => void }) {
  const { user } = useAuth();
  const [value, setValue, clearDraft, restored] = useDraft<MareDraft & { notes: string }>(
    mare ? null : accountDraftKey(user?.id, "stallions.new-mare"),
    mare ? { ...mare } : { ...emptyMare(), notes: "" },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!value.name.trim()) return setError("Add her name.");
    setBusy(true);
    setError("");
    try {
      const saved = mare ? await stallionsApi.updateMare(mare.id, value) : await stallionsApi.addMare(value);
      clearDraft();
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "She couldn't be saved.");
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} label={mare ? `Edit ${mare.name}` : "Add a mare"} className="gx-layer modal-wide">
      <DialogHead kicker="My mares" title={mare ? `Edit ${mare.name}` : "Add a mare"} onClose={onClose} />
      <form className="dlg" onSubmit={submit} noValidate>
        {restored && (
          <p className="st-muted">
            We kept what you typed.{" "}
            <button type="button" className="st-link" onClick={clearDraft}>
              Start again
            </button>
          </p>
        )}
        <MareFields value={value} onChange={(m) => setValue((v) => ({ ...v, ...m }))} disabled={busy} idPrefix="saved-mare" />
        <label className="st-field">
          <span>
            Notes <em>Only you see these</em>
          </span>
          <textarea rows={2} maxLength={500} value={value.notes} onChange={(e) => setValue((v) => ({ ...v, notes: e.target.value }))} />
        </label>
        {error && (
          <p className="st-alert is-error" role="alert">
            {error}
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Saving…" : mare ? "Save changes" : "Save mare"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
