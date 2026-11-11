import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";

/** A group invite link (/messages#invite=…) opened while signed in. The code is cleared from the address bar. */
export default function InviteAccept({ onJoined }: { onJoined: (conversationId: string) => void }) {
  const [code, setCode] = useState(() => new URLSearchParams(location.hash.slice(1)).get("invite") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (location.hash.includes("invite=")) history.replaceState(history.state, "", location.pathname + location.search);
  }, []);
  if (!code) return null;

  async function accept(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const d = await api.post<{ conversationId: string }>("/api/messages/accept-invitation", { token: code.trim() });
      setCode("");
      onJoined(d.conversationId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Invitation could not be accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mx-banner is-invite" onSubmit={accept}>
      <div className="mx-banner-main">
        <p>
          <strong>You've been invited to a group chat.</strong> Accept with the account the invite was sent to. You'll
          see the group's earlier messages.
        </p>
        <input
          aria-label="Conversation invitation code"
          type="password"
          value={code}
          maxLength={64}
          onChange={(e) => setCode(e.target.value)}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="mx-banner-actions">
        <button type="button" className="btn btn-quiet" onClick={() => setCode("")} disabled={busy}>
          Not now
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy || !code.trim()}>
          {busy ? "Joining…" : "Join group"}
        </button>
      </div>
    </form>
  );
}
