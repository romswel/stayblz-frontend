import { useEffect, useState, type FormEvent } from "react";
import { useStableApi, type Teammate } from "../../workspace";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import type { ChatApi } from "./chatApi";
import PersonPicker from "./PersonPicker";
import type { ChatMode, Person } from "./types";

const MUTE_CHOICES = [
  { key: "15", label: "For 15 minutes", minutes: 15 },
  { key: "60", label: "For 1 hour", minutes: 60 },
  { key: "480", label: "For 8 hours", minutes: 480 },
  { key: "1440", label: "For 24 hours", minutes: 1440 },
  { key: "always", label: "Until I turn it back on", minutes: 0 },
];

/** Mute a chat's notifications for a while, or until you turn them back on (Messenger's choices). */
export function MuteDialog({ title, onMute, onClose }: { title: string; onMute: (minutes: number | null) => void; onClose: () => void }) {
  const [choice, setChoice] = useState("60");
  return (
    <Modal label="Mute notifications" onClose={onClose} className="modal-sm mx-dialog mx-layer gx-layer">
      <DialogHead kicker={title} title="Mute notifications" onClose={onClose} />
      <form
        className="dlg mx-new"
        onSubmit={(e) => {
          e.preventDefault();
          const picked = MUTE_CHOICES.find((c) => c.key === choice)!;
          onMute(picked.minutes || null);
        }}
      >
        <fieldset className="mx-choices">
          <legend className="sr-only">How long</legend>
          {MUTE_CHOICES.map((c) => (
            <label key={c.key} className="mx-choice">
              <input type="radio" name="mute" value={c.key} checked={choice === c.key} onChange={() => setChoice(c.key)} />
              <span>{c.label}</span>
            </label>
          ))}
        </fieldset>
        <p className="mx-hint">You won't get alerts for this chat and it won't count in your unread badge. Messages still arrive.</p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Mute
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Rename a group (everyone sees the new name). */
export function RenameDialog({ initial, onSave, onClose }: { initial: string; onSave: (title: string) => Promise<void>; onClose: () => void }) {
  const [title, setTitle] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = title.trim();
    if (busy || !next || next === initial) return;
    setBusy(true);
    setError("");
    try {
      await onSave(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The name wasn't saved.");
      setBusy(false);
    }
  }
  return (
    <Modal label="Change chat name" onClose={onClose} className="modal-sm mx-dialog mx-layer gx-layer">
      <DialogHead kicker="Group" title="Change chat name" onClose={onClose} />
      <form className="dlg mx-new" onSubmit={submit}>
        <label className="mx-field">
          <span className="ld-label">Chat name</span>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} data-autofocus />
        </label>
        <p className="mx-hint">Everyone in the group sees the new name.</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !title.trim() || title.trim() === initial}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

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
    <Modal label={initial ? "Rename folder" : "New folder"} onClose={onClose} className="modal-sm mx-dialog mx-layer gx-layer">
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
    <Modal label="Add people" onClose={onClose} className="modal-sm mx-dialog mx-layer gx-layer">
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
