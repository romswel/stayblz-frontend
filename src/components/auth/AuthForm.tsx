import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { api, ApiError } from "../../api";
import PasswordField from "../PasswordField";
import { TERMS_UPDATED, TERMS_VERSION } from "../../content/legal";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import LegalDocs from "../legal/LegalDocs";
import { useDraft } from "../ui/useDraft";
import { useQuickTransition } from "../usePublicMotion";
import { inboxFor, passwordRules } from "./inbox";
import "../../pages/legal.css";

/** What people type is kept on this device until the account exists (never passwords). */
const emptySignup = { firstName: "", lastName: "", email: "" };
type SignupDraft = typeof emptySignup;
type View = "login" | "signup" | "forgot" | "inbox";
/** What the "Check your inbox" screen is about. */
type InboxKind = "verify" | "unverified" | "reset";

interface Props {
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
  destination: string;
  intent: string;
}

/**
 * The Stayblz account card: log in, sign up (name, email, password, one agreement), forgot password, and
 * "Check your inbox" after we email a link. Verification and password resets work by link only (no codes).
 */
export default function AuthForm({ mode, onModeChange, destination, intent }: Props) {
  const { login, restoreError } = useAuth();
  const navigate = useNavigate();
  const { key: navigationKey } = useLocation();
  // Bumped on every new screen, so a late answer from an old request can't change the new one.
  const operation = useRef(0);
  const [username, setUsername, clearUsername] = useDraft("guest.login", "", { maxAgeDays: 30 });
  const [draft, setDraft, clearSignup, signupRestored] = useDraft<SignupDraft>("guest.signup", emptySignup);
  const signup = { ...emptySignup, ...draft };
  const set = (key: keyof SignupDraft) => (value: string) => setDraft((current) => ({ ...emptySignup, ...current, [key]: value }));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [remember, setRemember] = useState(true);
  const [view, setView] = useState<View>(mode);
  const [inbox, setInbox] = useState<{ kind: InboxKind; email: string }>({ kind: "verify", email: "" });
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const bodyRef = useQuickTransition(`${view}:${inbox.kind}`);
  const moved = useRef(false);

  // A new mode or a new visit to /login or /signup starts clean.
  useEffect(() => {
    ++operation.current;
    setView(mode);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
    setBusy(false);
    return () => {
      ++operation.current;
    };
  }, [mode, navigationKey]);
  // After the person switches screens, focus goes to that screen's first field.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    bodyRef.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([readonly]), .au-inbox-title")?.focus();
  }, [view, bodyRef]);
  useEffect(() => {
    if (!retryUntil) return;
    const update = () => {
      const left = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
      setRetrySeconds(left);
      if (!left) setRetryUntil(0);
    };
    update();
    const timer = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [retryUntil]);
  const waiting = retrySeconds > 0;

  function go(next: View) {
    ++operation.current;
    moved.current = true;
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
    setBusy(false);
    setView(next);
    if (next === "login" || next === "signup") onModeChange(next);
  }
  function report(reason: unknown, fallback: string) {
    setNotice("");
    setError(reason instanceof Error ? reason.message : fallback);
    if (reason instanceof ApiError && reason.status === 429) {
      const seconds = Math.max(1, reason.retryAfterSeconds);
      setRetrySeconds(seconds);
      setRetryUntil(Date.now() + seconds * 1000);
    }
  }
  function showInbox(kind: InboxKind, email: string) {
    moved.current = true;
    setInbox({ kind, email });
    setError("");
    setNotice("");
    setView("inbox");
  }

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const current = ++operation.current;
    try {
      await login(username.trim(), password, remember);
      if (operation.current !== current) return;
      clearUsername();
      navigate(destination, { replace: true });
    } catch (reason) {
      if (operation.current !== current) return;
      if (reason instanceof ApiError && reason.code === "email_not_confirmed") {
        setPassword("");
        showInbox("unverified", username.trim());
        return;
      }
      report(reason, "Log in failed. Please try again.");
    } finally {
      if (operation.current === current) setBusy(false);
    }
  }

  async function submitSignup(event: FormEvent) {
    event.preventDefault();
    if (busy || waiting) return;
    setError("");
    setNotice("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!agreed) return setError("Confirm you're 18 or older and agree to the Terms of Use and Privacy Notice.");
    setBusy(true);
    const current = ++operation.current;
    const email = signup.email.trim();
    try {
      const answer = await api.post<{ requiresVerification: boolean; message: string }>("/api/auth/signup", {
        firstName: signup.firstName,
        lastName: signup.lastName,
        email,
        password,
        confirmPassword,
        acceptTerms: true,
        ageConfirmed: true,
        marketingOptIn: false,
        termsVersion: TERMS_VERSION,
      });
      if (operation.current !== current) return;
      if (!answer.requiresVerification) throw new Error("Registration could not be confirmed. Please try again.");
      setPassword("");
      setConfirmPassword("");
      // The account exists now: forget what was typed on this device (shared computers).
      clearSignup();
      setAgreed(false);
      showInbox("verify", email);
    } catch (reason) {
      if (operation.current !== current) return;
      report(reason, "Your account could not be created. Please try again.");
    } finally {
      if (operation.current === current) setBusy(false);
    }
  }

  async function submitForgot(event: FormEvent) {
    event.preventDefault();
    if (busy || waiting) return;
    setBusy(true);
    setError("");
    setNotice("");
    const current = ++operation.current;
    const email = resetEmail.trim();
    try {
      await api.post("/api/auth/forgot-password", { email });
      if (operation.current !== current) return;
      showInbox("reset", email);
    } catch (reason) {
      if (operation.current !== current) return;
      report(reason, "The reset email could not be requested.");
    } finally {
      if (operation.current === current) setBusy(false);
    }
  }

  /** Sends the link again: the verification link, or the password reset link. */
  async function resend() {
    if (busy || waiting) return;
    setBusy(true);
    setError("");
    setNotice("");
    const current = ++operation.current;
    try {
      await api.post(inbox.kind === "reset" ? "/api/auth/forgot-password" : "/api/auth/resend", { email: inbox.email });
      if (operation.current !== current) return;
      setNotice(`Sent. Look for the newest email from Stayblz${inbox.kind === "reset" ? "" : " and open its link"}.`);
      const seconds = 60;
      setRetrySeconds(seconds);
      setRetryUntil(Date.now() + seconds * 1000);
    } catch (reason) {
      if (operation.current !== current) return;
      report(reason, "The email could not be sent. Try again shortly.");
    } finally {
      if (operation.current === current) setBusy(false);
    }
  }

  const rules = passwordRules(password);
  const title = {
    login: "Welcome back",
    signup: "Create your account",
    forgot: "Reset your password",
    inbox: "Check your inbox",
  }[view];
  const lede = {
    login: "Log in to your Stayblz account.",
    signup: "It takes a minute. You can add your racing details after.",
    forgot: "Enter your account email and we'll send you a link to choose a new password.",
    inbox: "",
  }[view];
  const webmail = view === "inbox" ? inboxFor(inbox.email) : null;

  return (
    <section className="au-card" id="account" aria-label="Your Stayblz account">
      {view !== "inbox" && view !== "forgot" && (
        <div className="au-tabs" role="tablist" aria-label="Log in or sign up">
          <button type="button" role="tab" aria-selected={view === "login"} onClick={() => view !== "login" && go("login")}>
            Log in
          </button>
          <button type="button" role="tab" aria-selected={view === "signup"} onClick={() => view !== "signup" && go("signup")}>
            Sign up
          </button>
          <span className={`au-tabs-pill${view === "signup" ? " is-right" : ""}`} aria-hidden="true" />
        </div>
      )}
      <div className="au-body" ref={bodyRef}>
        {view !== "inbox" && (
          <header className="au-head">
            <h1>{title}</h1>
            <p>{lede}</p>
          </header>
        )}
        {intent && view !== "inbox" && (
          <p className="au-intent" role="status">
            Log in or sign up to {intent.toLowerCase()}.
          </p>
        )}
        {restoreError && <p className="au-msg is-error">{restoreError}</p>}
        {error && (
          <p className="au-msg is-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="au-msg is-ok" role="status">
            {notice}
          </p>
        )}

        {view === "login" && (
          <form className="au-form" onSubmit={submitLogin} aria-label="Log in to Stayblz">
            <label className="au-field">
              <span>Email</span>
              <input
                name="email"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="you@example.com"
                maxLength={254}
                required
              />
            </label>
            <div className="au-field-row">
              <PasswordField
                key={`login:${navigationKey}`}
                label="Password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
                required
              />
              <button
                type="button"
                className="au-link au-forgot"
                onClick={() => {
                  if (username.includes("@")) setResetEmail(username.trim());
                  go("forgot");
                }}
              >
                Forgot password?
              </button>
            </div>
            <label className="au-check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>
                Keep me signed in
                <small>Turn off on shared or public computers.</small>
              </span>
            </label>
            <button className="au-submit" type="submit" disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
          </form>
        )}

        {view === "signup" && (
          <form className="au-form" onSubmit={submitSignup} aria-label="Create your Stayblz account">
            {signupRestored && (signup.firstName || signup.lastName || signup.email) && (
              <p className="au-kept" role="status">
                <span>We kept what you typed earlier on this device.</span>
                <button
                  type="button"
                  className="au-link"
                  onClick={() => {
                    clearSignup();
                    setAgreed(false);
                  }}
                >
                  Clear
                </button>
              </p>
            )}
            <div className="au-pair">
              <label className="au-field">
                <span>First name</span>
                <input name="firstName" autoComplete="given-name" value={signup.firstName} onChange={(e) => set("firstName")(e.target.value)} maxLength={60} required />
              </label>
              <label className="au-field">
                <span>Last name</span>
                <input name="lastName" autoComplete="family-name" value={signup.lastName} onChange={(e) => set("lastName")(e.target.value)} maxLength={60} required />
              </label>
            </div>
            <label className="au-field">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={signup.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="you@example.com"
                maxLength={254}
                required
              />
            </label>
            <PasswordField
              key={`signup:${navigationKey}`}
              label="Password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              maxLength={128}
              pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}"
              aria-describedby="au-password-rules"
              required
            />
            <ul className="au-rules" id="au-password-rules" aria-label="Password needs">
              {rules.map((rule) => (
                <li key={rule.label} className={rule.ok ? "is-ok" : undefined}>
                  <span aria-hidden="true">{rule.ok ? "✓" : "•"}</span> {rule.label}
                </li>
              ))}
            </ul>
            <PasswordField
              label="Confirm password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
            <label className="au-check">
              <input type="checkbox" name="acceptTerms" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
              <span>
                I'm 18 or older and I agree to the{" "}
                <button type="button" className="au-inline" onClick={() => setLegalOpen(true)}>
                  Terms of Use and Privacy Notice
                </button>
                .
              </span>
            </label>
            <button className="au-submit" type="submit" disabled={busy || waiting}>
              {waiting ? `Try again in ${retrySeconds}s` : busy ? "Creating your account…" : "Create account"}
            </button>
          </form>
        )}

        {view === "forgot" && (
          <form className="au-form" onSubmit={submitForgot} aria-label="Reset your password">
            <label className="au-field">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
                maxLength={254}
                required
              />
            </label>
            <button className="au-submit" type="submit" disabled={busy || waiting}>
              {waiting ? `Try again in ${retrySeconds}s` : busy ? "Sending…" : "Send reset link"}
            </button>
            <button type="button" className="au-back" onClick={() => go("login")}>
              <span aria-hidden="true">←</span> Back to log in
            </button>
          </form>
        )}

        {view === "inbox" && (
          <div className="au-inbox">
            <span className="au-envelope" aria-hidden="true">
              <svg viewBox="0 0 64 64" width="64" height="64" fill="none">
                <rect x="8" y="16" width="48" height="34" rx="7" className="au-env-back" />
                <path d="m10 20 22 16 22-16" className="au-env-flap" />
                <circle cx="50" cy="16" r="8" className="au-env-dot" />
                <path d="m46.5 16 2.4 2.4 4.6-4.8" className="au-env-tick" />
              </svg>
            </span>
            <h1 className="au-inbox-title" tabIndex={-1}>
              {inbox.kind === "unverified" ? "Verify your email first" : "Check your inbox"}
            </h1>
            <p className="au-inbox-text">
              {inbox.kind === "reset" ? (
                <>
                  If <strong>{inbox.email}</strong> has a Stayblz account, we sent it a link to choose a new password.
                </>
              ) : inbox.kind === "unverified" ? (
                <>
                  Open the link we sent to <strong>{inbox.email}</strong> to verify your account, then log in. Can't find it? Send a new one.
                </>
              ) : (
                <>
                  We sent a link to <strong>{inbox.email}</strong>. Open it to verify your email and finish creating your account.
                </>
              )}
            </p>
            {webmail && (
              <a className="au-submit au-webmail" href={webmail.url} target="_blank" rel="noopener noreferrer">
                Open {webmail.name}
              </a>
            )}
            <p className="au-small">Not there? Check spam or junk. The link works once and expires in 1 hour.</p>
            <div className="au-inbox-actions">
              <button type="button" className="au-quiet" onClick={resend} disabled={busy || waiting}>
                {waiting ? `Send again in ${retrySeconds}s` : busy ? "Sending…" : "Send a new link"}
              </button>
              <button type="button" className="au-quiet" onClick={() => go(inbox.kind === "verify" ? "signup" : inbox.kind === "reset" ? "forgot" : "login")}>
                Use a different email
              </button>
            </div>
            <button type="button" className="au-back" onClick={() => go("login")}>
              <span aria-hidden="true">←</span> Back to log in
            </button>
          </div>
        )}

        {(view === "login" || view === "signup") && (
          <p className="au-switch">
            {view === "login" ? "New to Stayblz?" : "Already have an account?"}{" "}
            <button type="button" className="au-link" onClick={() => go(view === "login" ? "signup" : "login")}>
              {view === "login" ? "Create an account" : "Log in"}
            </button>
          </p>
        )}
      </div>
      {legalOpen && (
        <Modal label="Terms of Use and Privacy Notice" className="modal-wide modal-landing gx-layer" onClose={() => setLegalOpen(false)}>
          <DialogHead kicker={`Updated ${TERMS_UPDATED}`} title="Terms of Use & Privacy Notice" onClose={() => setLegalOpen(false)} />
          <div className="legal-dialog-jump" role="group" aria-label="Jump to">
            {(["terms", "privacy"] as const).map((key) => (
              <button key={key} type="button" onClick={() => document.getElementById(`dlg-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                {key === "terms" ? "Terms of Use" : "Privacy Notice"}
              </button>
            ))}
          </div>
          <div className="legal-dialog-body" tabIndex={0} role="region" aria-label="Terms of Use and Privacy Notice text">
            <LegalDocs kind="all" idPrefix="dlg-" />
          </div>
          <div className="legal-dialog-foot">
            <button type="button" className="btn btn-quiet" onClick={() => setLegalOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setAgreed(true);
                setLegalOpen(false);
              }}
            >
              I agree to both
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
