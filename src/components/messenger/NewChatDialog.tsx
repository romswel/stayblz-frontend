import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ApiError } from "../../api";
import { useStableApi, type Teammate } from "../../workspace";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import type { ChatApi } from "./chatApi";
import { Avatar } from "./icons";
import type { ChatMode, ThreadResponse } from "./types";

/** Start a chat. Personal: one person by account email, or a named group with invite links. Team: pick teammates. */
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
  const [kind, setKind] = useState<"person" | "group">("person");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [noAccount, setNoAccount] = useState(false);

  const team = mode === "team";
  const stableApi = useStableApi();
  const [members, setMembers] = useState<Teammate[] | null>(null);
  const [membersError, setMembersError] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  useEffect(() => {
    if (!team) return;
    const controller = new AbortController();
    stableApi
      .get<{ members: Teammate[] }>("/api/workspaces/members", { signal: controller.signal })
      .then((d) => !controller.signal.aborted && setMembers(d.members.filter((m) => m.id !== userId)))
      .catch((e) => !controller.signal.aborted && setMembersError(e instanceof Error ? e.message : "Teammates could not be loaded."));
    return () => controller.abort();
  }, [team, stableApi, userId]);
  const shown = useMemo(
    () => (members ?? []).filter((m) => m.displayName.toLowerCase().includes(filter.trim().toLowerCase())),
    [members, filter],
  );
  const needsName = team ? picked.length > 1 : kind === "group";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNoAccount(false);
    try {
      if (team) {
        const data =
          picked.length === 1 && !title.trim()
            ? await chatApi.startDirect(picked[0])
            : await chatApi.createGroup(title.trim(), picked);
        onOpened(data, { invite: false });
      } else if (kind === "person") {
        onOpened(await chatApi.startDirect(email.trim()), { invite: false });
      } else {
        onOpened(await chatApi.createGroup(title.trim()), { invite: true });
      }
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "no_account") setNoAccount(true);
      setError(reason instanceof Error ? reason.message : "The chat could not be started.");
      setBusy(false);
    }
  }

  const canSubmit = team
    ? picked.length > 0 && (!needsName || title.trim().length > 0)
    : kind === "person"
      ? email.trim().length > 3
      : title.trim().length > 0;
  const action = team
    ? picked.length > 1 || title.trim()
      ? "Create group"
      : "Start chat"
    : kind === "person"
      ? "Start chat"
      : "Create group";

  return (
    <Modal label="New chat" onClose={onClose} className="modal-sm">
      <DialogHead kicker={team ? "Team messages" : "Messages"} title="New chat" onClose={onClose} />
      <form className="dlg mx-new" onSubmit={submit}>
        {!team && (
          <div className="mx-seg" role="group" aria-label="Chat type">
            <button type="button" aria-pressed={kind === "person"} onClick={() => setKind("person")}>
              One person
            </button>
            <button type="button" aria-pressed={kind === "group"} onClick={() => setKind("group")}>
              Group
            </button>
          </div>
        )}

        {!team && kind === "person" && (
          <>
            <label className="mx-field">
              <span className="ld-label">To</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="Their Stayblz account email"
                value={email}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
                data-autofocus
              />
            </label>
            <p className="mx-hint">
              Your first message arrives as a request. They can accept or delete it. Their email stays private.
            </p>
          </>
        )}

        {!team && kind === "group" && (
          <>
            <label className="mx-field">
              <span className="ld-label">Group name</span>
              <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Saturday syndicate" data-autofocus />
            </label>
            <p className="mx-hint">After you create it, invite people with a private link (up to 30 people).</p>
          </>
        )}

        {team && (
          <>
            <label className="mx-field">
              <span className="ld-label">To</span>
              <input type="search" placeholder="Search teammates" value={filter} onChange={(e) => setFilter(e.target.value)} data-autofocus />
            </label>
            {membersError && <p className="form-error" role="alert">{membersError}</p>}
            {!members && !membersError && <p className="mx-hint" role="status">Loading teammates…</p>}
            {members && !members.length && <p className="mx-hint">No one else is in this stable yet. Invite teammates from My stables & team.</p>}
            {members && members.length > 0 && (
              <ul className="mx-pick">
                {shown.map((m) => (
                  <li key={m.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={picked.includes(m.id)}
                        onChange={(e) =>
                          setPicked((old) => (e.target.checked ? [...old, m.id] : old.filter((id) => id !== m.id)))
                        }
                      />
                      <Avatar name={m.displayName} size="sm" />
                      <span>{m.displayName}</span>
                    </label>
                  </li>
                ))}
                {!shown.length && <li className="mx-hint">No teammates match.</li>}
              </ul>
            )}
            {(needsName || title) && (
              <label className="mx-field">
                <span className="ld-label">Group name {picked.length < 2 && <em>Optional</em>}</span>
                <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning gallops" />
              </label>
            )}
          </>
        )}

        {error && (
          <div className="form-error" role="alert">
            {error}
            {noAccount && (
              <button type="button" className="mx-link" onClick={() => { setKind("group"); setError(""); setNoAccount(false); }}>
                Start a group with an invite link instead
              </button>
            )}
          </div>
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
