import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";
import { confirmAccount, isPasswordRecovery } from "../confirmation";
import usePublicMotion from "../components/usePublicMotion";
import Brand from "../components/Brand";
import PasswordField from "../components/PasswordField";
import "./landing.css";
import "./AuthConfirm.css";

// With 2-step login on, the app shows the 2-step screen and then opens this page again. The link's
// one-time answer is cached (see confirmation.ts), so it is applied once and never replaces the
// newer session that passed 2-step login.
let confirmationApplied = false;

export default function AuthConfirm() {
  const pageRef = usePublicMotion();
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
          if (!confirmationApplied) {
            confirmationApplied = true;
            acceptUser(user);
          }
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
  const title = {
    working: "Checking your link…",
    password: "Set your password",
    done: "Password saved",
    verified: "Email verified",
    error: "Check your confirmation link",
  }[step];
  const description = {
    working: "One moment while we confirm your account.",
    password: "Choose a password for your Stayblz account.",
    done: "Your new password is ready. Log in to continue.",
    verified: "Your email is confirmed. You’re ready to continue.",
    error: "Return to login to request a fresh confirmation email.",
  }[step];
  return (
    <div className="landing ld-confirm-page" ref={pageRef}>
      <header className="ld-confirm-header">
        <Link className="ld-brand" to="/" aria-label="Stayblz home">
          <Brand />
          <span>
            <strong>STAYBLZ</strong>
            <small>THE RACING LEDGER</small>
          </span>
        </Link>
        <Link className="ld-confirm-home" to="/">
          Back to overview <span aria-hidden="true">↗</span>
        </Link>
      </header>
      <main className="ld-confirm-layout">
        <aside className="ld-confirm-editorial" aria-label="Stayblz racing">
          <img
            src="/images/racing-editorial.jpg"
            alt="Racehorse and jockey on the track in evening light"
          />
          <div className="ld-confirm-photo-copy">
            <span className="ld-kicker">THE RACING LEDGER</span>
            <p>
              Know the horse.
              <br />
              <em>Read the race.</em>
            </p>
            <span className="ld-confirm-caption">
              STAYBLZ / ON & OFF THE TRACK
            </span>
          </div>
        </aside>
        <section
          className="ld-confirm-card"
          aria-labelledby="confirmation-title"
          aria-busy={step === "working"}
        >
          <div className="ld-confirm-meta">
            <span className="ld-kicker">YOUR ACCOUNT</span>
            <span>STAYBLZ</span>
          </div>
          <div
            className={`ld-confirm-emblem ld-confirm-emblem-${step}`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 48 48" fill="none">
              <circle className="ld-confirm-ring" cx="24" cy="24" r="21" />
              {step === "error" ? (
                <path d="M24 13v14m0 7v1" />
              ) : step === "password" ? (
                <>
                  <rect x="15" y="22" width="18" height="15" rx="2" />
                  <path d="M18 22v-6a6 6 0 0 1 12 0v6m-6 6v4" />
                </>
              ) : step === "working" ? (
                <path d="M24 13v12l7 4" />
              ) : (
                <path className="ld-confirm-check" d="m14 24 7 7 14-15" />
              )}
            </svg>
          </div>
          <div
            className="ld-confirm-heading"
            key={step}
            role="status"
            aria-live="polite"
          >
            <h1 id="confirmation-title">{title}</h1>
            <p>{description}</p>
          </div>
          {error && (
            <p className="ld-auth-error" role="alert">
              {error}
            </p>
          )}
          {step === "password" && (
            <form onSubmit={save}>
              <PasswordField
                label="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}"
                required
              />
              <p className="ld-password-help">
                12–128 characters, uppercase, lowercase, and a number.
              </p>
              <PasswordField
                label="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
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
              <Link className="ld-button ld-button-gold" to="/dashboard">
                Continue to dashboard <span aria-hidden="true">↗</span>
              </Link>
            </>
          )}
          {(step === "done" || step === "error") && (
            <Link className="ld-button ld-button-gold" to="/login">
              Back to login
            </Link>
          )}
          <div className="ld-confirm-footnote">
            <span aria-hidden="true">◇</span>{" "}
            {step === "error"
              ? "Confirmation links can expire or be used only once."
              : "Your account. Your racing view."}
          </div>
        </section>
      </main>
      <footer className="ld-confirm-footer">
        <span>STAYBLZ</span>
        <span>Know the horse. Read the race.</span>
      </footer>
    </div>
  );
}
