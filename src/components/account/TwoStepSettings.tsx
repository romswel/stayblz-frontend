import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { User } from "../../types";

type Setup = { factorId: string; qrCode: string; secret: string };
const digits = (value: string) => value.replace(/\D/g, "").slice(0, 6);

/** Profile section: turn 2-step login (authenticator app codes) on or off. */
export default function TwoStepSettings() {
  const { user, acceptUser } = useAuth();
  const enabled = !!user?.mfa?.enabled;
  const staff = (user?.platformRole ?? user?.role) !== "member";
  const [setup, setSetup] = useState<Setup | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    run(async () => {
      setSetup(await api.post<Setup>("/api/auth/mfa/enroll", {}));
      setCode("");
    });

  const confirm = (event: FormEvent) => {
    event.preventDefault();
    if (!setup) return;
    void run(async () => {
      if (code.length !== 6) throw new Error("Enter the 6-digit code from your authenticator app.");
      const result = await api.post<{ user: User }>("/api/auth/mfa/verify", {
        code,
        factorId: setup.factorId,
      });
      setSetup(null);
      setCode("");
      acceptUser(result.user);
      setNotice("2-step login is on. You'll enter a code each time you sign in.");
    });
  };

  const turnOff = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (code.length !== 6) throw new Error("Enter the 6-digit code from your authenticator app.");
      await api.post("/api/auth/mfa/disable", { code });
      // The server ends every session; sign in again with your password.
      acceptUser(null);
    });
  };

  const codeField = (label: string) => (
    <label className="acct-code">
      {label}
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(digits(e.target.value))}
      />
    </label>
  );

  return (
    <section className="panel account-profile acct-section" aria-labelledby="two-step-title">
      <h2 id="two-step-title">
        2-step login{" "}
        <span className={`acct-badge${enabled ? "" : staff ? " is-warn" : " is-off"}`}>
          {enabled ? "On" : "Off"}
        </span>
      </h2>
      <p>
        Adds a 6-digit code from an authenticator app (such as Google Authenticator or Microsoft
        Authenticator) after your password, so a stolen password alone can't open your account.
        {staff && !enabled && " Strongly recommended for admin accounts."}
      </p>

      {!enabled && !setup && (
        <button type="button" className="btn btn-quiet" onClick={() => void start()} disabled={busy}>
          {busy ? "Starting…" : "Set up 2-step login"}
        </button>
      )}

      {!enabled && setup && (
        <form onSubmit={confirm} noValidate>
          <div className="acct-qr">
            <img src={setup.qrCode} alt="QR code to add Stayblz to your authenticator app" />
            <div className="acct-qr-help">
              <p>1. In your authenticator app, add an account and scan this code.</p>
              <p>Can't scan? Enter this key instead:</p>
              <code>{setup.secret}</code>
              <p>2. Type the 6-digit code the app shows.</p>
            </div>
          </div>
          {codeField("6-digit code")}
          <div className="acct-actions">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Checking…" : "Turn on"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setSetup(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {enabled && !disabling && (
        <button type="button" className="btn btn-quiet" onClick={() => { setDisabling(true); setCode(""); }}>
          Turn off 2-step login
        </button>
      )}

      {enabled && disabling && (
        <form onSubmit={turnOff} noValidate>
          <p>Enter a current code to confirm. You'll be signed out everywhere and can sign in again with your password.</p>
          {codeField("6-digit code")}
          <div className="acct-actions">
            <button className="btn btn-quiet" disabled={busy}>
              {busy ? "Turning off…" : "Turn off and sign out"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setDisabling(false)} disabled={busy}>
              Keep it on
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
