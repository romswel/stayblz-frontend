import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { User } from "../../types";
import AuthLayout from "../auth/AuthLayout";

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
    <AuthLayout>
      <section className="au-solo gx-glass" aria-labelledby="mfa-title">
        <div className="au-emblem" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="2.5" width="12" height="19" rx="3" />
            <path d="M10 6.5h4M9.5 14l2 2 3.5-4" />
          </svg>
        </div>
        <h1 id="mfa-title">2-step login</h1>
        <p className="au-lede">
          Open your authenticator app and enter the 6-digit Stayblz code
          {user?.email ? ` for ${user.email}` : ""}.
        </p>
        <form className="au-form" onSubmit={submit} noValidate>
          <label className="au-field">
            <span>6-digit code</span>
            <input
              ref={input}
              className="au-code"
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
            <p id="mfa-error" className="au-msg is-error" role="alert">
              {error}
            </p>
          )}
          <button className="au-submit" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
          <button type="button" className="au-back" onClick={() => void logout().catch(() => undefined)}>
            Sign out
          </button>
        </form>
      </section>
    </AuthLayout>
  );
}
