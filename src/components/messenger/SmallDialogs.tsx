import { useEffect, useState, type FormEvent } from "react";
import { useStableApi, type Teammate } from "../../workspace";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import type { ChatApi } from "./chatApi";
import PersonPicker from "./PersonPicker";
import type { ChatMode, Person } from "./types";

/** Name a folder (new or rename). */
export function FolderNameDialog({
  initial = "",
  onSave,
  onClose,
}: {
  initial?: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onSave(name.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The folder couldn't be saved.");
      setBusy(false);
    }
  }
  return (
    <Modal label={initial ? "Rename folder" : "New folder"} onClose={onClose} className="modal-sm">
      <DialogHead kicker="Folders" title={initial ? "Rename folder" : "New folder"} onClose={onClose} />
      <form className="dlg mx-new" onSubmit={submit}>
        <label className="mx-field">
          <span className="ld-label">Folder name</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trainers" data-autofocus />
        </label>
        <p className="mx-hint">Folders are only for you. Put a chat in a folder from its ⋯ menu or Chat info.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? "Saving…" : initial ? "Rename" : "Create folder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Add people to a group: members by name (personal) or teammates (team). */
export function AddPeopleDialog({
  mode,
  chatApi,
  chatId,
  memberIds,
  onClose,
  onAdded,
}: {
  mode: ChatMode;
  chatApi: ChatApi;
  chatId: string;
  memberIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const stableApi = useStableApi();
  const [picked, setPicked] = useState<Person[]>([]);
  const [roster, setRoster] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (mode !== "team") return;
    const c = new AbortController();
    stableApi
      .get<{ members: Teammate[] }>("/api/workspaces/members", { signal: c.signal })
      .then((d) => !c.signal.aborted && setRoster(d.members.map((m) => ({ id: m.id, name: m.displayName }))))
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Teammates could not be loaded."));
    return () => c.abort();
  }, [mode, stableApi]);

  async function add() {
    if (!picked.length || busy) return;
    setBusy(true);
    setError("");
    try {
      await chatApi.addMembers(chatId, picked.map((p) => p.id));
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "They couldn't be added.");
      setBusy(false);
    }
  }
  return (
    <Modal label="Add people" onClose={onClose} className="modal-sm">
      <DialogHead kicker="Group" title="Add people" onClose={onClose} />
      <div className="dlg mx-new">
        <PersonPicker picked={picked} onChange={setPicked} exclude={memberIds} pool={mode === "team" ? roster : undefined} max={30 - memberIds.length} />
        <p className="mx-hint">They'll see the group's earlier messages.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!picked.length || busy} onClick={() => void add()}>
            {busy ? "Adding…" : picked.length > 1 ? `Add ${picked.length} people` : "Add"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
