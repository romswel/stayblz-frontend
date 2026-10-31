import { forwardRef, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { api, ApiError } from "../../api";
import { countries } from "./countries";

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
  const { user, login, restoreError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [racingRole, setRacingRole] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [verification, setVerification] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [retryUntil, setRetryUntil] = useState(0);
  const [retryScope, setRetryScope] = useState<"email" | "login">("email");
  const emailRateLimited = retrySeconds > 0 && retryScope === "email";
  const submitRateLimited =
    retrySeconds > 0 &&
    retryScope === (forgot || mode === "signup" ? "email" : "login");
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
    setPassword("");
    setConfirmPassword("");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || submitRateLimited) return;
    setError("");
    setNotice("");
    if (mode === "signup" && !forgot && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (forgot) {
        const response = await api.post<{ message: string }>(
          "/api/auth/forgot-password",
          { email: email.trim() },
        );
        setNotice(response.message);
      } else if (mode === "signup") {
        const response = await api.post<{
          requiresVerification: boolean;
          message: string;
        }>("/api/auth/signup", {
          firstName,
          lastName,
          country,
          racingRole,
          email: email.trim(),
          password,
          confirmPassword,
        });
        if (!response.requiresVerification)
          throw new Error(
            "Registration could not be confirmed. Please try again.",
          );
        setPassword("");
        setConfirmPassword("");
        setVerification(true);
        setNotice(response.message);
      } else {
        await login(username.trim(), password);
        navigate(destination, { replace: true });
      }
    } catch (reason) {
      reportError(
        reason,
        "The request failed. Please try again.",
        forgot || mode === "signup" ? "email" : "login",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    if (busy || emailRateLimited) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api.post<{ message: string }>("/api/auth/resend", {
        email:
          verification || mode === "signup" || forgot
            ? email.trim()
            : username.trim(),
      });
      setNotice(response.message);
    } catch (reason) {
      reportError(reason, "Email could not be requested.", "email");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      ref={ref}
      className="ld-auth"
      id="account"
      tabIndex={-1}
      aria-label="Your Stayblz account"
    >
      {user ? (
        <div className="ld-welcome">
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
          <div className="ld-auth-body">
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
                ? "We’ll send a password reset link."
                : verification
                  ? "Use the confirmation link to verify your address."
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
                <button
                  type="button"
                  className="ld-button ld-button-gold ld-submit"
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
                    <div className="ld-field-pair">
                      <label className="ld-field">
                        First name
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
                        Last name
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
                        Country
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
                        Racing role
                        <select
                          name="racingRole"
                          value={racingRole}
                          onChange={(e) => setRacingRole(e.target.value)}
                          required
                        >
                          <option value="">Select role</option>
                          <option value="owner">Owner</option>
                          <option value="trainer">Trainer</option>
                          <option value="jockey">Jockey</option>
                          <option value="staff">Stable staff</option>
                          <option value="fan">Racing fan</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                    </div>
                  </>
                )}
                <label className="ld-field">
                  {mode === "login" && !forgot
                    ? "Email or admin username"
                    : "Email address"}
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
                        ? "Email or superadmin"
                        : "you@example.com"
                    }
                    maxLength={254}
                    required
                  />
                </label>
                {!forgot && (
                  <>
                    <label className="ld-field">
                      Password
                      <span className="ld-password">
                        <input
                          name="password"
                          type={visible ? "text" : "password"}
                          autoComplete={
                            mode === "login"
                              ? "current-password"
                              : "new-password"
                          }
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          minLength={mode === "signup" ? 12 : undefined}
                          maxLength={128}
                          pattern={
                            mode === "signup"
                              ? "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,128}"
                              : undefined
                          }
                          aria-describedby={
                            mode === "signup" ? "ld-password-help" : undefined
                          }
                          required
                        />
                        <button
                          type="button"
                          aria-label={
                            visible ? "Hide password" : "Show password"
                          }
                          aria-pressed={visible}
                          onClick={() => setVisible(!visible)}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            aria-hidden="true"
                          >
                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                            <circle cx="12" cy="12" r="2.5" />
                            {visible && <path d="m3 3 18 18" />}
                          </svg>
                        </button>
                      </span>
                    </label>
                    {mode === "signup" && (
                      <>
                        <p className="ld-password-help" id="ld-password-help">
                          12–128 characters, with uppercase, lowercase, and a
                          number.
                        </p>
                        <label className="ld-field">
                          Confirm password
                          <input
                            name="confirmPassword"
                            type={visible ? "text" : "password"}
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            minLength={12}
                            maxLength={128}
                            required
                          />
                        </label>
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
                        ? "Send reset email"
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
                        setEmail(username.includes("@") ? username : "");
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
            Verified email · Private account access
          </div>
        </>
      )}
    </section>
  );
});
export default LandingAuth;
