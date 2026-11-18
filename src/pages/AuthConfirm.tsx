import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import { confirmAccount, isPasswordRecovery } from "../confirmation";
import AuthLayout from "../components/auth/AuthLayout";
import { passwordRules } from "../components/auth/inbox";
import PasswordField from "../components/PasswordField";
import { profileComplete } from "./Welcome";
import type { User } from "../types";

// With 2-step login on, the app shows the 2-step screen and then opens this page again. The link's
// one-time answer is cached (see confirmation.ts), so it is applied once and never replaces the
// newer session that passed 2-step login.
let confirmationApplied = false;

type Step = "working" | "verified" | "password" | "done" | "error";

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
const Lock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2" />
  </svg>
);
const Alert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 7v6M12 17h.01" />
    <circle cx="12" cy="12" r="9.5" />
  </svg>
);

/** Opening the link in a Stayblz email: verify the account, or choose a new password (reset / invitation). */
export default function AuthConfirm() {
  const { acceptUser } = useAuth();
  const [step, setStep] = useState<Step>("working");
  const [account, setAccount] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  useEffect(() => {
    let active = true;
    confirmAccount()
      .then(({ user }) => {
        if (!active) return;
        if (!confirmationApplied) {
          confirmationApplied = true;
          acceptUser(user);
        }
        setAccount(user);
        setStep(isPasswordRecovery || user.passwordSetupRequired ? "password" : "verified");
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "This link couldn't be checked.");
        setStep("error");
      });
    return () => {
      active = false;
    };
  }, [acceptUser]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirmPassword) return setError("Passwords do not match.");
    setBusy(true);
    setError("");
    try {
      await api.post("/api/auth/password", { password, confirmPassword });
      acceptUser(null);
      setPassword("");
      setConfirmPassword("");
      setStep("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Password could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  const first = account?.profile?.firstName?.trim();
  const needsProfile = !!account && !profileComplete(account);
  return (
    <AuthLayout>
      <section className="au-solo gx-glass" aria-labelledby="confirm-title" aria-busy={step === "working"}>
        <div className={`au-emblem${step === "error" ? " is-error" : ""}`} aria-hidden="true">
          {step === "working" ? <span className="au-spin" /> : step === "error" ? <Alert /> : step === "password" ? <Lock /> : <Check />}
        </div>
        <div role={step === "error" ? undefined : "status"} aria-live={step === "error" ? undefined : "polite"} key={step}>
          <h1 id="confirm-title">
            {
              {
                working: "Checking your link…",
                verified: "You're verified",
                password: "Choose a new password",
                done: "Password saved",
                error: "This link didn't work",
              }[step]
            }
          </h1>
          <p className="au-lede" role={step === "error" ? "alert" : undefined}>
            {step === "working" && "One moment."}
            {step === "verified" &&
              (needsProfile
                ? `Welcome to Stayblz${first ? `, ${first}` : ""}. Add your racing details so people know who you are.`
                : `Your email is confirmed${first ? `, ${first}` : ""}. You're ready to go.`)}
            {step === "password" && "Pick a password you don't use anywhere else."}
            {step === "done" && "Log in with your new password."}
            {step === "error" && (error || "Links work once and expire after an hour.")}
          </p>
        </div>
        {step === "password" && (
          <form className="au-form" onSubmit={save} aria-label="Choose a new password">
            {error && (
              <p className="au-msg is-error" role="alert">
                {error}
              </p>
            )}
            <PasswordField
              label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}"
              aria-describedby="au-new-rules"
              required
            />
            <ul className="au-rules" id="au-new-rules" aria-label="Password needs">
              {passwordRules(password).map((rule) => (
                <li key={rule.label} className={rule.ok ? "is-ok" : undefined}>
                  <span aria-hidden="true">{rule.ok ? "✓" : "•"}</span> {rule.label}
                </li>
              ))}
            </ul>
            <PasswordField
              label="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <button className="au-submit" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </button>
          </form>
        )}
        {step === "verified" && (
          <div className="au-actions">
            {needsProfile ? (
              <>
                <Link className="au-submit" to="/welcome">
                  Finish your profile
                </Link>
                <Link className="au-quiet" to="/dashboard">
                  Skip for now
                </Link>
              </>
            ) : (
              <Link className="au-submit" to="/dashboard">
                Continue to Stayblz
              </Link>
            )}
          </div>
        )}
        {step === "done" && (
          <div className="au-actions">
            <Link className="au-submit" to="/login">
              Log in
            </Link>
          </div>
        )}
        {step === "error" && (
          <div className="au-actions">
            <Link className="au-submit" to="/login">
              Back to log in
            </Link>
            <p className="au-small">From the log in page you can send a new verification or password reset email.</p>
          </div>
        )}
      </section>
    </AuthLayout>
  );
}
