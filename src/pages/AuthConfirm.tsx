import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import { confirmAccount, isPasswordRecovery } from "../confirmation";
import Brand from "../components/Brand";
import "./landing.css";

export default function AuthConfirm() {
  const { acceptUser } = useAuth();
  const [step, setStep] = useState<
    "working" | "verified" | "password" | "done" | "error"
  >("working");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  useEffect(() => {
    let active = true;
    confirmAccount()
      .then(({ user }) => {
        if (active) {
          acceptUser(user);
          setStep(
            isPasswordRecovery || user.passwordSetupRequired
              ? "password"
              : "verified",
          );
        }
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Confirmation failed.",
          );
          setStep("error");
        }
      });
    return () => {
      active = false;
    };
  }, [acceptUser]);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/api/auth/password", { password, confirmPassword });
      acceptUser(null);
      setPassword("");
      setConfirmPassword("");
      setStep("done");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Password could not be changed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="landing ld-confirm-page">
      <div className="ld-confirm-card">
        <Brand />
        <span className="ld-kicker">STAYBLZ ACCOUNT</span>
        <h1>
          {step === "working"
            ? "Checking your link…"
            : step === "password"
              ? "Set your password"
              : step === "done"
                ? "Password saved"
                : step === "verified"
                  ? "Email verified"
                  : "Check your confirmation link"}
        </h1>
        {error && (
          <p className="ld-auth-error" role="alert">
            {error}
          </p>
        )}
        {step === "password" && (
          <form onSubmit={save}>
            <label className="ld-field">
              New password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}"
                required
              />
            </label>
            <p className="ld-password-help">
              12–128 characters, uppercase, lowercase, and a number.
            </p>
            <label className="ld-field">
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <button
              className="ld-button ld-button-gold ld-submit"
              disabled={busy}
            >
              {busy ? "Saving…" : "Save password"}
            </button>
          </form>
        )}
        {step === "verified" && (
          <>
            <p>You can now access your account.</p>
            <Link className="ld-button ld-button-gold" to="/dashboard">
              Continue to dashboard
            </Link>
          </>
        )}
        {(step === "done" || step === "error") && (
          <Link className="ld-button ld-button-gold" to="/login">
            Back to login
          </Link>
        )}
      </div>
    </div>
  );
}
