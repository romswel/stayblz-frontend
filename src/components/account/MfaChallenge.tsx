import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { User } from "../../types";
import Brand from "../Brand";
import "./account.css";

/** Shown instead of the app when 2-step login is on and this session has not passed it. */
export default function MfaChallenge() {
  const { user, acceptUser, logout } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ user: User }>("/api/auth/mfa/verify", { code });
      acceptUser(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The code could not be checked.");
      setCode("");
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="acct-gate">
      <section className="panel acct-gate-card" aria-labelledby="mfa-title">
        <Brand />
        <h1 id="mfa-title">2-step login</h1>
        <p>
          Open your authenticator app and enter the 6-digit Stayblz code
          {user?.email ? ` for ${user.email}` : ""}.
        </p>
        <form onSubmit={submit} noValidate>
          <label className="acct-code">
            6-digit code
            <input
              ref={input}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-invalid={!!error}
              aria-describedby={error ? "mfa-error" : undefined}
            />
          </label>
          {error && (
            <p id="mfa-error" className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="acct-actions">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Checking…" : "Continue"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => void logout().catch(() => undefined)}>
              Sign out
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
