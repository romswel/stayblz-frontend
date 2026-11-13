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
  // The reset code was accepted, so a failed password save can be retried without a new code.
  const [resetVerified, setResetVerified] = useState(false);
  // 2-step login is on for the account being reset: its authenticator code is needed too.
  const [resetMfa, setResetMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  // The address being confirmed with a code: from sign-up, or from logging in before confirming.
  const [verifyEmail, setVerifyEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [verification, setVerification] = useState(false);
  // Sign-up has two pages: 1 = name, email and password; 2 = location, racing roles and agreements.
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const signingUp = mode === "signup" && !forgot;
  const step2 = signingUp && signupStep === 2;
  // Set when the person moves between pages, so focus goes to that page's first field.
  const stepMoved = useRef(false);
  const bodyRef = useQuickTransition(
    `${mode}:${forgot}:${verification}:${signupStep}:${user?.id ?? "guest"}`,
  );
  useEffect(() => {
    if (!stepMoved.current) return;
    stepMoved.current = false;
    bodyRef.current
      ?.querySelector<HTMLElement>("form input:not([type=hidden]), form select")
      ?.focus();
  }, [signupStep]);
  function goToStep(step: 1 | 2) {
    stepMoved.current = true;
    setError("");
    setNotice("");
    setSignupStep(step);
  }
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
    setResetVerified(false);
    setResetMfa(false);
    setMfaCode("");
    setCode("");
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
    setSignupStep(1);
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
  /** The reset code was accepted, but the account has 2-step login: ask for that code next. */
  function askForMfa() {
    setResetMfa(true);
    setMfaCode("");
    setError("");
    setNotice(
      "2-step login is on for this account. Enter the 6-digit code from your authenticator app to finish.",
    );
  }
  function changeMode(next: "login" | "signup") {
    onModeChange(next);
    setError("");
    setNotice("");
    setForgot(false);
    setVerification(false);
    setResetSent(false);
    setResetVerified(false);
    setResetMfa(false);
    setMfaCode("");
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setSignupStep(1);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || submitRateLimited) return;
    setError("");
    setNotice("");
    if ((signingUp || resetSent) && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (signingUp && signupStep === 1) {
      // The browser has already checked the required fields on this page.
      goToStep(2);
      return;
    }
    if (resetSent && !resetVerified && !/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (resetSent && resetMfa && !/^\d{6}$/.test(mfaCode)) {
      setError("Enter the 6-digit code from your authenticator app.");
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
        // A code works once, so after it's accepted a failed save is retried without it.
        if (!resetVerified) {
          let confirmed: { user: User };
          try {
            confirmed = await api.post<{ user: User }>("/api/auth/confirm", {
              email: email.trim(),
              code,
              type: "recovery",
            });
          } catch (reason) {
            if (reason instanceof ApiError && reason.code === "code_invalid") setCode("");
            throw reason;
          }
          if (operation.current !== currentOperation) return;
          setResetVerified(true);
          if (confirmed.user.mfaPending) {
            askForMfa();
            return;
          }
        }
        if (resetMfa) {
          try {
            await api.post<{ user: User }>("/api/auth/mfa/verify", { code: mfaCode });
          } catch (reason) {
            setMfaCode("");
            throw reason;
          }
          if (operation.current !== currentOperation) return;
          setResetMfa(false);
          setMfaCode("");
        }
        try {
          await api.post("/api/auth/password", { password, confirmPassword });
        } catch (reason) {
          if (reason instanceof ApiError && reason.code === "mfa_required") {
            if (operation.current === currentOperation) askForMfa();
            return;
          }
          throw reason;
        }
        if (operation.current !== currentOperation) return;
        setForgot(false);
        setResetSent(false);
        setResetVerified(false);
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
        setSignupStep(1);
        setVerifyEmail(email.trim());
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
      if (
        mode === "login" &&
        !forgot &&
        reason instanceof ApiError &&
        reason.code === "email_not_confirmed"
      ) {
        // Signed up but never confirmed: ask for the code from the sign-up email right here.
        setPassword("");
        setCode("");
        setVerifyEmail(username.trim());
        setVerification(true);
        setError("");
        setNotice(reason.message);
        return;
      }
      // The email address was refused: go back to page 1, where that field is.
      if (
        signingUp &&
        reason instanceof ApiError &&
        reason.status !== 429 &&
        /email/i.test(reason.code ?? "")
      )
        setSignupStep(1);
      reportError(
        reason,
        "The request failed. Please try again.",
        forgot || mode === "signup" ? "email" : "login",
      );
    } finally {
      if (operation.current === currentOperation) setBusy(false);
    }
  }
  /**
   * Sends a new code: the sign-up code on the "Check your email" screen or from the login tab
   * (which then opens the code screen), or the reset code on the "Reset your password" screen.
   */
  async function resend() {
    if (busy || emailRateLimited) return;
    setBusy(true);
    setError("");
    setNotice("");
    const currentOperation = operation.current;
    const address = forgot
      ? email.trim()
      : verification
        ? verifyEmail
        : mode === "login"
          ? username.trim()
          : email.trim();
    try {
      const response = await api.post<{ message: string }>(
        forgot ? "/api/auth/forgot-password" : "/api/auth/resend",
        { email: address },
      );
      if (operation.current !== currentOperation) return;
      setCode("");
      if (!forgot && !verification) {
        setVerifyEmail(address);
        setVerification(true);
      }
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
        email: verifyEmail,
        code,
        type: "signup",
      });
      if (operation.current !== currentOperation) return;
      // The saved sign-up or login details are done with once this address is confirmed.
      const confirmed = verifyEmail.toLowerCase();
      if (email.trim().toLowerCase() === confirmed) clearSignup();
      if (username.trim().toLowerCase() === confirmed) clearUsername();
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
  const mfaField = (
    <label className="ld-field ld-code-field">
      <span className="ld-label">6-digit code from your authenticator app</span>
      <input
        name="mfaCode"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={mfaCode}
        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                  ? resetMfa
                    ? "Code accepted. Enter your 2-step login code to finish."
                    : resetVerified
                    ? "Code accepted. Choose a new password."
                    : "Enter the 6-digit code from the email and choose a new password."
                  : "We’ll email you a 6-digit code."
                : verification
                  ? "Enter the 6-digit code we emailed you."
                  : mode === "login"
                    ? "Access your account and racing records."
                    : signupStep === 1
                      ? "Step 1 of 2 · Your name and login details."
                      : "Step 2 of 2 · Where you are and your part in racing."}
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
                <p>{verifyEmail}</p>
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
                  Didn't get it? Check spam or junk, or send a new code. Only the newest code works.
                </p>
                <div className="ld-account-links">
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
                        : "Send a new code"}
                  </button>
                  <button
                    type="button"
                    className="ld-auth-link"
                    onClick={() => changeMode("login")}
                  >
                    Back to login
                  </button>
                </div>
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
                {signingUp && signupStep === 1 && (
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
                  </>
                )}
                {forgot && resetSent && !resetVerified && codeField}
                {forgot && resetSent && resetMfa && mfaField}
                {!step2 && (
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
                )}
                {(!forgot || resetSent) && !step2 && (
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
                      </>
                    )}
                  </>
                )}
                {step2 && (
                  <>
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
                  </>
                )}
                <div className={step2 ? "ld-step-actions" : undefined}>
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
                            : signupStep === 1
                              ? "Continue"
                              : "Create account"}
                    <span aria-hidden="true">{signingUp && signupStep === 1 ? "→" : "↗"}</span>
                  </button>
                  {step2 && (
                    <button
                      type="button"
                      className="ld-button ld-button-quiet ld-step-back"
                      onClick={() => goToStep(1)}
                      disabled={busy}
                    >
                      <span aria-hidden="true">←</span> Back
                    </button>
                  )}
                </div>
              </form>
            )}
            {!verification && (
              <div
                className={`ld-account-links${mode === "login" && !forgot ? " ld-links-login" : ""}`}
              >
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
                {forgot && resetSent && !resetVerified && (
                  <>
                    <p className="ld-small-print">
                      Didn't get it? Check spam or junk, or send a new code. Only the newest code works.
                    </p>
                    <button
                      type="button"
                      className="ld-auth-link"
                      onClick={resend}
                      disabled={busy || emailRateLimited}
                    >
                      {emailRateLimited ? `Try again in ${retrySeconds}s` : "Send a new code"}
                    </button>
                    <button
                      type="button"
                      className="ld-auth-link"
                      onClick={() => {
                        setResetSent(false);
                        setCode("");
                        setError("");
                        setNotice("");
                      }}
                    >
                      Use a different email
                    </button>
                  </>
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
