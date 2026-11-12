import { useEffect, useState, type FormEvent } from "react";
import { ApiError } from "../../api";
import { useStableApi, type Teammate } from "../../workspace";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { peopleApi, type ChatApi } from "./chatApi";
import PersonPicker from "./PersonPicker";
import type { ChatMode, Person, ThreadResponse } from "./types";

/**
 * Start a chat. Pick one person for a one-to-one chat, or several for a group (name it).
 * Personal chats can also start by account email, or as an empty group shared with an invite link.
 */
export default function NewChatDialog({
  mode,
  chatApi,
  userId,
  onClose,
  onOpened,
}: {
  mode: ChatMode;
  chatApi: ChatApi;
  userId: string;
  onClose: () => void;
  onOpened: (data: ThreadResponse, opts: { invite: boolean }) => void;
}) {
  const team = mode === "team";
  const stableApi = useStableApi();
  const [picked, setPicked] = useState<Person[]>([]);
  const [title, setTitle] = useState("");
  const [byEmail, setByEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [roster, setRoster] = useState<Person[] | null>(null);

  useEffect(() => {
    if (!team) return;
    const c = new AbortController();
    stableApi
      .get<{ members: Teammate[] }>("/api/workspaces/members", { signal: c.signal })
      .then((d) => !c.signal.aborted && setRoster(d.members.filter((m) => m.id !== userId).map((m) => ({ id: m.id, name: m.displayName }))))
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Teammates could not be loaded."));
    return () => c.abort();
  }, [team, stableApi, userId]);

  const group = picked.length > 1;
  const emptyGroup = !team && !byEmail && picked.length === 0 && title.trim().length > 0;
  const canSubmit = byEmail ? email.trim().length > 3 : group ? title.trim().length > 0 : picked.length === 1 || emptyGroup;
  const action = byEmail || picked.length === 1 ? "Start chat" : "Create group";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setError("");
    try {
      if (byEmail) return onOpened(await chatApi.startDirect(email.trim()), { invite: false });
      if (picked.length === 1)
        return onOpened(team ? await chatApi.startDirect(picked[0].id) : await peopleApi.chatWith(picked[0].id), { invite: false });
      const ids = picked.map((p) => p.id);
      const created = await chatApi.createGroup(title.trim(), team ? ids : []);
      let added = true;
      if (!team && ids.length) added = await chatApi.addMembers(created.conversation.id, ids).then(() => true, () => false);
      // The group exists either way; if adding people failed, open it with the invite tools so nothing is lost.
      onOpened(created, { invite: !team && (ids.length === 0 || !added) });
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.code === "no_account"
          ? "No Stayblz account uses that email. Check the spelling, or create a group and send them an invite link."
          : reason instanceof Error
            ? reason.message
            : "The chat could not be started.",
      );
      setBusy(false);
    }
  }

  return (
    <Modal label="New chat" onClose={onClose} className="modal-sm">
      <DialogHead kicker={team ? "Team chat" : "Stayblz Chat"} title="New chat" onClose={onClose} />
      <form className="dlg mx-new" onSubmit={submit}>
        {byEmail ? (
          <>
            <label className="mx-field">
              <span className="ld-label">Their account email</span>
              <input type="email" inputMode="email" autoComplete="off" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} data-autofocus />
            </label>
            <p className="mx-hint">If you're not friends, your first message arrives as a request. Their email stays private.</p>
          </>
        ) : (
          <PersonPicker picked={picked} onChange={setPicked} exclude={[userId]} pool={team ? roster : undefined} />
        )}

        {!byEmail && (group || (!team && picked.length === 0)) && (
          <label className="mx-field">
            <span className="ld-label">
              Group name {!group && <em>Only for a group with an invite link</em>}
            </span>
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Saturday syndicate" />
          </label>
        )}
        {!team && (
          <button type="button" className="mx-link" onClick={() => setByEmail((v) => !v)}>
            {byEmail ? "Pick people by name instead" : "Use an account email instead"}
          </button>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || busy}>
            {busy ? "Starting…" : action}
          </button>
        </div>
      </form>
    </Modal>
  );
}
