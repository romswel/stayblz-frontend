import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";
import { useConfirm } from "../ui/Confirm";
export default function ConversationInvites({
  conversationId,
}: {
  conversationId: string;
}) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [invitations, setInvitations] = useState<
    { id: string; email: string; expires_at: string }[]
  >([]);
  useEffect(() => {
    if (!open) return;
    const c = new AbortController();
    api
      .get<{ invitations: typeof invitations }>(
        `/api/messages/${conversationId}/invitations`,
        { signal: c.signal },
      )
      .then((d) => {
        if (!c.signal.aborted) setInvitations(d.invitations);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [open, conversationId, version]);
  async function invite(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const d = await api.post<{ token: string }>(
        `/api/messages/${conversationId}/invitations`,
        { email },
      );
      setLink(`${location.origin}/messages#invite=${d.token}`);
      setEmail("");
      setVersion((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Invitation could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    if (busy) return;
    const sure = await confirm({
      title: "Cancel this invitation?",
      message: "The link stops working. Anyone who hasn't joined yet will need a new invitation.",
      confirmLabel: "Cancel invitation",
      cancelLabel: "Keep it",
    });
    if (!sure) return;
    setBusy(true);
    setError("");
    try {
      await api.post(
        `/api/messages/${conversationId}/invitations/${id}/revoke`,
      );
      setInvitations((old) => old.filter((i) => i.id !== id));
      setLink("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Invitation could not be revoked.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mr-conversation-invites">
      <button
        className="ws-button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Invite someone
      </button>
      {open && (
        <div>
          <p>
            Only the invited account can accept. They will be able to read this
            conversation’s history. Links expire in seven days. No email is sent
            automatically.
          </p>
          <form onSubmit={invite}>
            <label>
              Recipient email
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="ws-button" disabled={busy}>
              {busy ? "Creating…" : "Create private invitation"}
            </button>
          </form>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {link && (
            <label>
              Private conversation invitation
              <input readOnly value={link} onFocus={(e) => e.target.select()} />
            </label>
          )}
          {invitations.map((i) => (
            <div key={i.id} className="mr-pending-invite">
              <span>{i.email}</span>
              <button
                className="ws-button"
                disabled={busy}
                onClick={() => void revoke(i.id)}
              >
                Revoke invitation
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
