import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import TwoStepSettings from "../../components/account/TwoStepSettings";
import ViewAsSettings from "../../components/account/ViewAsSettings";
import AccountHeader from "./AccountNav";

function ChangePassword() {
  const { acceptUser } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/api/auth/password", { password, confirmPassword: confirm });
      // Changing the password ends every session, including this one.
      acceptUser(null);
      navigate("/login", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The password could not be changed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel account-profile acct-section" aria-labelledby="password-title">
      <h2 id="password-title">Password</h2>
      <p>Use 12–128 characters with uppercase, lowercase and a number. Changing it signs you out on every device.</p>
      <form className="acct-form-grid profile-fields" onSubmit={submit}>
        <label>
          New password
          <input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <label>
          Confirm new password
          <input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="acct-actions">
          <button className="btn btn-quiet" disabled={busy}>
            {busy ? "Saving…" : "Change password"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Devices() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function everywhere() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await logout(true);
      navigate("/login", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Signing out could not be confirmed.");
      setBusy(false);
    }
  }
  return (
    <section className="panel account-profile acct-section acct-danger" aria-labelledby="devices-title">
      <h2 id="devices-title">Signed-in devices</h2>
      <p>
        Logging out normally only signs out this device. If you used Stayblz on a shared computer or think someone else
        is signed in, sign out everywhere.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="acct-actions">
        <button type="button" className="btn btn-quiet" onClick={() => void everywhere()} disabled={busy}>
          {busy ? "Signing out…" : "Sign out of all devices"}
        </button>
      </div>
    </section>
  );
}

export default function AccountSecurity() {
  return (
    <>
      <AccountHeader title="Security" intro="Your password, 2-step login and signed-in devices." />
      <div className="acct-sections">
        <TwoStepSettings />
        <ChangePassword />
        <Devices />
        <ViewAsSettings />
      </div>
    </>
  );
}
