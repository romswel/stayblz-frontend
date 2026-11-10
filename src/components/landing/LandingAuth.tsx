import { forwardRef, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { api, ApiError } from "../../api";
import { countries } from "./countries";
import PasswordField from "../PasswordField";
import CommunityRoleFields from "../account/CommunityRoleFields";
import { TERMS_UPDATED, TERMS_VERSION } from "../../content/legal";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import LegalDocs from "../legal/LegalDocs";
import { useDraft } from "../ui/useDraft";
import type { User } from "../../types";
import { useQuickTransition } from "../usePublicMotion";
import "./auth-extra.css";

/** Sign-up details kept on this device until the account is confirmed. Never passwords or codes. */
const emptySignup = {
  firstName: "",
  lastName: "",
  country: "",
  city: "",
  organisation: "",
  racingRole: "",
  communityRoles: [] as string[],
  email: "",
  marketingOptIn: false,
};
type SignupDraft = typeof emptySignup;

interface Props {
  mode: "login" | "signup";
  onModeChange: (mode: "login" | "signup") => void;
  destination: string;
  intent: string;
}
const LandingAuth = forwardRef<HTMLElement, Props>(function LandingAuth(
  { mode, onModeChange, destination, intent },
  ref,
) {
  const { user, login, restoreError, acceptUser } = useAuth();
  const navigate = useNavigate();
  const { key: navigationKey } = useLocation();
  const operation = useRef(0);
  // What people type is kept on this device (see useDraft), so a reload or a trip to another page loses nothing.
  const [username, setUsername, clearUsername] = useDraft("guest.login", "", { maxAgeDays: 30 });
  const [signup, setSignup, clearSignup, signupRestored] = useDraft<SignupDraft>("guest.signup", emptySignup);
  const field =
    <K extends keyof SignupDraft>(key: K) =>
    (value: SignupDraft[K]) =>
      setSignup((current) => ({ ...current, [key]: value }));
  const { firstName, lastName, country, city, organisation, racingRole, communityRoles, email, marketingOptIn } = signup;
  const setFirstName = field("firstName");
  const setLastName = field("lastName");
  const setCountry = field("country");
  const setCity = field("city");
  const setOrganisation = field("organisation");
  const setEmail = field("email");
  const setRacingRole = field("racingRole");
  const setCommunityRoles = field("communityRoles");
  const setMarketingOptIn = field("marketingOptIn");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [verification, setVerification] = useState(false);
  const bodyRef = useQuickTransition(
    `${mode}:${forgot}:${verification}:${user?.id ?? "guest"}`,
  );
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retryScope, setRetryScope] = useState<"email" | "login">("email");
  const emailRateLimited = retrySeconds > 0 && retryScope === "email";
  const submitRateLimited =
    retrySeconds > 0 &&
    retryScope === (forgot || mode === "signup" ? "email" : "login");
  useEffect(() => {
    ++operation.current;
    setForgot(false);
    setVerification(false);
    setResetSent(false);
    setCode("");
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
    setBusy(false);
    return () => {
      ++operation.current;
    };
  }, [mode, navigationKey]);
  useEffect(() => {
    if (!retryUntil) return;
    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((retryUntil - Date.now()) / 1000),
      );
      setRetrySeconds(remaining);
      if (!remaining) setRetryUntil(0);
    };
    update();
    const timer = window.setInterval(update, 1000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [retryUntil]);
  function reportError(
    reason: unknown,
    fallback: string,
    scope: "email" | "login",
  ) {
    setNotice("");
    setError(reason instanceof Error ? reason.message : fallback);
    if (reason instanceof ApiError && reason.status === 429) {
      const seconds = Math.max(1, reason.retryAfterSeconds);
      setRetrySeconds(seconds);
      setRetryUntil(Date.now() + seconds * 1000);
      setRetryScope(scope);
    }
  }
  function changeMode(next: "login" | "signup") {
    onModeChange(next);
    setError("");
    setNotice("");
    setForgot(false);
    setVerification(false);
    setResetSent(false);
    setCode("");
    setPassword("");
    setConfirmPassword("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || submitRateLimited) return;
    setError("");
    setNotice("");
    if (((mode === "signup" && !forgot) || resetSent) && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (resetSent && !/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (mode === "signup" && !forgot && (!acceptTerms || !ageConfirmed)) {
      setError("Confirm you are 18 or older and accept the Terms of Use and Privacy Notice.");
      return;
    }
    setBusy(true);
    const currentOperation = operation.current;
    try {
      if (forgot && resetSent) {
        // The code proves it's you; then the new password is saved and you log in again.
        await api.post<{ user: User }>("/api/auth/confirm", {
          email: email.trim(),
          code,
          type: "recovery",
        });
        await api.post("/api/auth/password", { password, confirmPassword });
        if (operation.current !== currentOperation) return;
        setForgot(false);
        setResetSent(false);
        setCode("");
        setPassword("");
        setConfirmPassword("");
        setUsername(email.trim());
        setNotice("Password changed. Log in with your new password.");
      } else if (forgot) {
        const response = await api.post<{ message: string }>(
          "/api/auth/forgot-password",
          { email: email.trim() },
        );
        if (operation.current !== currentOperation) return;
        setResetSent(true);
        setNotice(response.message);
      } else if (mode === "signup") {
        const response = await api.post<{
          requiresVerification: boolean;
          message: string;
        }>("/api/auth/signup", {
          firstName,
          lastName,
          country,
          city: city.trim(),
          organisation: organisation.trim(),
          racingRole,
          communityRoles,
          email: email.trim(),
          password,
          confirmPassword,
          acceptTerms,
          ageConfirmed,
          marketingOptIn,
          termsVersion: TERMS_VERSION,
        });
        if (operation.current !== currentOperation) return;
        if (!response.requiresVerification)
          throw new Error(
            "Registration could not be confirmed. Please try again.",
          );
        setPassword("");
        setConfirmPassword("");
        setVerification(true);
        setNotice(response.message);
      } else {
        await login(username.trim(), password, remember);
        if (operation.current !== currentOperation) return;
        clearUsername();
        navigate(destination, { replace: true });
      }
    } catch (reason) {
      if (operation.current !== currentOperation) return;
      reportError(
        reason,
        "The request failed. Please try again.",
        forgot || mode === "signup" ? "email" : "login",
      );
    } finally {
      if (operation.current === currentOperation) setBusy(false);
    }
  }
  async function resend() {
    if (busy || emailRateLimited) return;
    setBusy(true);
    setError("");
    setNotice("");
    const currentOperation = operation.current;
    try {
      const response = await api.post<{ message: string }>("/api/auth/resend", {
        email:
          verification || mode === "signup" || forgot
            ? email.trim()
            : username.trim(),
      });
      if (operation.current !== currentOperation) return;
      setNotice(response.message);
    } catch (reason) {
      if (operation.current !== currentOperation) return;
      reportError(reason, "Email could not be requested.", "email");
    } finally {
      if (operation.current === currentOperation) setBusy(false);
    }
  }
  async function confirmCode(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const currentOperation = operation.current;
    try {
      const response = await api.post<{ user: User }>("/api/auth/confirm", {
        email: email.trim(),
        code,
        type: "signup",
      });
      if (operation.current !== currentOperation) return;
      clearSignup();
      acceptUser(response.user);
      navigate(destination, { replace: true });
    } catch (reason) {
      if (operation.current !== currentOperation) return;
      reportError(reason, "The code could not be checked.", "email");
      setCode("");
    } finally {
      if (operation.current === currentOperation) setBusy(false);
    }
  }
  const codeField = (
    <label className="ld-field ld-code-field">
      <span className="ld-label">6-digit code from the email</span>
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        required
      />
    </label>
  );
  return (
    <section
      ref={ref}
      className="ld-auth"
      id="account"
      tabIndex={-1}
      aria-label="Your Stayblz account"
    >
      {user ? (
        <div className="ld-welcome" ref={bodyRef}>
          <span className="ld-kicker">SIGNED IN</span>
          <div className="ld-user-avatar">
            {(user.displayName || user.username).slice(0, 1).toUpperCase()}
          </div>
          <h2>
            Welcome back,
            <br />
            <em>{user.displayName || user.username}.</em>
          </h2>
          <p>Continue to your dashboard.</p>
          <Link className="ld-button ld-button-gold" to="/dashboard">
            Continue to dashboard <span aria-hidden="true">↗</span>
          </Link>
        </div>
      ) : (
        <>
          <div className="ld-auth-tabs" aria-label="Account options">
            <button
              type="button"
              aria-pressed={mode === "login"}
              onClick={() => changeMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              aria-pressed={mode === "signup"}
              onClick={() => changeMode("signup")}
            >
              Sign up
            </button>
          </div>
          <div className="ld-auth-body" ref={bodyRef}>
            <span className="ld-kicker">STAYBLZ ACCOUNT</span>
            <h2>
              {forgot
                ? "Reset your password"
                : verification
                  ? "Check your email"
                  : mode === "login"
                    ? "Log in to Stayblz"
                    : "Create an account"}
            </h2>
            <p className="ld-auth-description">
              {forgot
                ? resetSent
                  ? "Enter the code from the email and choose a new password."
                  : "We’ll email you a 6-digit code and a reset link."
                : verification
                  ? "Enter the 6-digit code we emailed you, or use the button in the email."
                  : mode === "login"
                    ? "Access your account and racing records."
                    : "Create your profile and verify your email."}
            </p>
            {intent && (
              <p className="ld-auth-intent" role="status">
                Log in or sign up to {intent.toLowerCase()}.
              </p>
            )}
            {restoreError && <p className="ld-auth-error">{restoreError}</p>}
            {error && (
              <p className="ld-auth-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="ld-auth-success" role="status">
                {notice}
              </p>
            )}
            {verification ? (
              <div className="ld-verification">
                <p>{email}</p>
                <form onSubmit={confirmCode} aria-label="Confirm your email with a code" noValidate>
                  {codeField}
                  <button
                    className="ld-button ld-button-gold ld-submit"
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? "Checking…" : "Confirm email"}
                    <span aria-hidden="true">↗</span>
                  </button>
                </form>
                <p className="ld-small-print">
                  Didn't get it? Check spam, or request a new email. Codes expire after a short time.
                </p>
                <button
                  type="button"
                  className="ld-auth-link"
                  onClick={resend}
                  disabled={busy || emailRateLimited}
                >
                  {busy
                    ? "Requesting…"
                    : emailRateLimited
                      ? `Try again in ${retrySeconds}s`
                      : "Resend confirmation email"}
                </button>
                <button
                  className="ld-auth-link"
                  onClick={() => changeMode("login")}
                >
                  Back to login
                </button>
              </div>
            ) : (
              <form
                onSubmit={submit}
                aria-label={
                  forgot
                    ? "Password reset request"
                    : mode === "login"
                      ? "Sign in to Stayblz"
                      : "Create your Stayblz account"
                }
              >
                {mode === "signup" && !forgot && (
                  <>
                    {signupRestored && (firstName || lastName || email) && (
                      <p className="ld-kept" role="status">
                        <span>We kept the details you typed earlier on this device. Passwords are never saved.</span>
                        <button
                          type="button"
                          className="ld-auth-link"
                          onClick={() => {
                            clearSignup();
                            setAcceptTerms(false);
                            setAgeConfirmed(false);
                          }}
                        >
                          Clear form
                        </button>
                      </p>
                    )}
                    <div className="ld-field-pair">
                      <label className="ld-field">
                        <span className="ld-label">First name</span>
                        <input
                          name="firstName"
                          autoComplete="given-name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          maxLength={60}
                          required
                        />
                      </label>
                      <label className="ld-field">
                        <span className="ld-label">Last name</span>
                        <input
                          name="lastName"
                          autoComplete="family-name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          maxLength={60}
                          required
                        />
                      </label>
                    </div>
                    <div className="ld-field-pair">
                      <label className="ld-field">
                        <span className="ld-label">Country</span>
                        <select
                          name="country"
                          autoComplete="country"
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          required
                        >
                          <option value="">Select country</option>
                          {countries.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="ld-field">
                        <span className="ld-label">
                          Town or city <span className="ld-optional">Optional</span>
                        </span>
                        <input
                          name="city"
                          autoComplete="address-level2"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          maxLength={80}
                        />
                      </label>
                    </div>
                    <CommunityRoleFields
                      variant="landing"
                      primary={racingRole}
                      extras={communityRoles}
                      onPrimary={setRacingRole}
                      onExtras={setCommunityRoles}
                    />
                    <label className="ld-field">
                      <span className="ld-label">
                        Stable, farm or organisation <span className="ld-optional">Optional</span>
                      </span>
                      <input
                        name="organisation"
                        autoComplete="organization"
                        value={organisation}
                        onChange={(e) => setOrganisation(e.target.value)}
                        maxLength={100}
                      />
                    </label>
                  </>
                )}
                {forgot && resetSent && codeField}
                <label className="ld-field">
                  <span className="ld-label">{mode === "login" && !forgot ? "Email" : "Email address"}</span>
                  <input
                    name="email"
                    type={mode === "login" && !forgot ? "text" : "email"}
                    autoComplete={
                      mode === "login" && !forgot ? "username" : "email"
                    }
                    value={mode === "login" && !forgot ? username : email}
                    onChange={(e) =>
                      mode === "login" && !forgot
                        ? setUsername(e.target.value)
                        : setEmail(e.target.value)
                    }
                    placeholder={
                      mode === "login" && !forgot
                        ? "you@example.com"
                        : "you@example.com"
                    }
                    maxLength={254}
                    readOnly={forgot && resetSent}
                    required
                  />
                </label>
                {(!forgot || resetSent) && (
                  <>
                    <PasswordField
                      key={`${mode}:${navigationKey}`}
                      label={resetSent ? "New password" : "Password"}
                      name="password"
                      autoComplete={mode === "login" && !resetSent ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={mode === "signup" || resetSent ? 12 : undefined}
                      maxLength={128}
                      pattern={mode === "signup" || resetSent ? "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}" : undefined}
                      aria-describedby={mode === "signup" || resetSent ? "ld-password-help" : undefined}
                      required
                    />
                    {mode === "login" && !forgot && (
                      <label className="ld-check">
                        <input
                          type="checkbox"
                          checked={remember}
                          onChange={(e) => setRemember(e.target.checked)}
                        />
                        <span>
                          Keep me signed in
                          <small>Turn off on shared or public computers.</small>
                        </span>
                      </label>
                    )}
                    {(mode === "signup" || resetSent) && (
                      <>
                        <p className="ld-password-help" id="ld-password-help">
                          12–128 characters, with uppercase, lowercase, and a
                          number.
                        </p>
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
                        {mode === "signup" && !forgot && (
                          <fieldset className="ld-agreements">
                            <legend>Before you join</legend>
                            <label className="ld-check">
                              <input
                                type="checkbox"
                                name="acceptTerms"
                                checked={acceptTerms}
                                onChange={(e) => setAcceptTerms(e.target.checked)}
                                required
                              />
                              <span>
                                I agree to the{" "}
                                <button type="button" className="ld-inline-link" onClick={() => setLegalOpen(true)}>
                                  Terms of Use and Privacy Notice
                                </button>
                                .<small>Both are on one page. Read them here without leaving this form.</small>
                              </span>
                            </label>
                            <label className="ld-check">
                              <input
                                type="checkbox"
                                name="ageConfirmed"
                                checked={ageConfirmed}
                                onChange={(e) => setAgeConfirmed(e.target.checked)}
                                required
                              />
                              <span>I'm 18 or older.</span>
                            </label>
                            <label className="ld-check">
                              <input
                                type="checkbox"
                                name="marketingOptIn"
                                checked={marketingOptIn}
                                onChange={(e) => setMarketingOptIn(e.target.checked)}
                              />
                              <span>
                                Email me Stayblz news and updates <small>Optional. You can change this later.</small>
                              </span>
                            </label>
                          </fieldset>
                        )}
                      </>
                    )}
                  </>
                )}
                <button
                  className="ld-button ld-button-gold ld-submit"
                  type="submit"
                  disabled={busy || submitRateLimited}
                >
                  {submitRateLimited
                    ? `Try again in ${retrySeconds}s`
                    : busy
                      ? "Please wait…"
                      : forgot
                        ? resetSent
                          ? "Set new password"
                          : "Send reset email"
                        : mode === "login"
                          ? "Sign in"
                          : "Create account"}
                  <span aria-hidden="true">↗</span>
                </button>
              </form>
            )}
            {!verification && (
              <div className="ld-account-links">
                {mode === "login" && !forgot && (
                  <>
                    <button
                      className="ld-auth-link"
                      onClick={() => {
                        setForgot(true);
                        if (username.includes("@")) setEmail(username);
                        setError("");
                        setNotice("");
                      }}
                    >
                      Forgot password?
                    </button>
                    {username.includes("@") && (
                      <button
                        className="ld-auth-link"
                        onClick={resend}
                        disabled={busy || emailRateLimited}
                      >
                        Resend verification email
                      </button>
                    )}
                  </>
                )}
                {forgot && resetSent && (
                  <button
                    className="ld-auth-link"
                    onClick={() => {
                      setResetSent(false);
                      setCode("");
                      setNotice("");
                    }}
                  >
                    Didn't get the email? Send it again
                  </button>
                )}
                <p className="ld-auth-switch">
                  {forgot
                    ? "Remember your password?"
                    : mode === "login"
                      ? "New here?"
                      : "Already have an account?"}{" "}
                  <button
                    onClick={() =>
                      changeMode(
                        forgot
                          ? "login"
                          : mode === "login"
                            ? "signup"
                            : "login",
                      )
                    }
                  >
                    {forgot
                      ? "Back to login"
                      : mode === "login"
                        ? "Sign up"
                        : "Log in"}
                  </button>
                </p>
              </div>
            )}
          </div>
          <div className="ld-auth-foot">
            Verified email · Private account access ·{" "}
            <Link to="/legal">Terms &amp; Privacy</Link>
          </div>
          {legalOpen && (
            <Modal label="Terms of Use and Privacy Notice" className="modal-wide modal-landing" onClose={() => setLegalOpen(false)}>
              <DialogHead
                kicker={`Updated ${TERMS_UPDATED}`}
                title="Terms of Use & Privacy Notice"
                onClose={() => setLegalOpen(false)}
              />
              <div className="legal-dialog-jump" role="group" aria-label="Jump to">
                {(["terms", "privacy"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => document.getElementById(`dlg-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
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
                    setAcceptTerms(true);
                    setLegalOpen(false);
                  }}
                >
                  I agree to both
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </section>
  );
});
export default LandingAuth;
