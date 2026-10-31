import { forwardRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
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
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode !== "login" || busy) return;
    setError("");
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(destination, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }
  function changeMode(next: "login" | "signup") {
    onModeChange(next);
    setError("");
    setPassword("");
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
            <h2>{mode === "login" ? "Log in to Stayblz" : "Sign up"}</h2>
            <p className="ld-auth-description">
              {mode === "login"
                ? "Access your account and racing records."
                : "Email verification is being configured."}
            </p>
            {intent && (
              <p className="ld-auth-intent" role="status">
                Log in or sign up to {intent.toLowerCase()}.
              </p>
            )}
            {error && (
              <p className="ld-auth-error" role="alert">
                {error}
              </p>
            )}
            {mode === "signup" && (
              <p className="ld-registration-note">
                Registration is not available yet. Details entered here are not
                submitted or saved.
              </p>
            )}
            <form
              onSubmit={submit}
              aria-label={
                mode === "login" ? "Sign in to Stayblz" : "Registration preview"
              }
            >
              <label className="ld-field">
                {mode === "login" ? "Email or admin username" : "Email address"}
                <input
                  type={mode === "login" ? "text" : "email"}
                  autoComplete={mode === "login" ? "username" : "email"}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </label>
              <label className="ld-field">
                Password
                <span className="ld-password">
                  <input
                    type={visible ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    aria-label={visible ? "Hide password" : "Show password"}
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
              <button
                className="ld-button ld-button-gold ld-submit"
                type="submit"
                disabled={busy || mode === "signup"}
              >
                {busy
                  ? "Signing in…"
                  : mode === "login"
                    ? "Sign in"
                    : "Registration opens soon"}
                <span aria-hidden="true">↗</span>
              </button>
            </form>
            <p className="ld-auth-switch">
              {mode === "login" ? "New here?" : "Already have an account?"}{" "}
              <button
                onClick={() =>
                  changeMode(mode === "login" ? "signup" : "login")
                }
              >
                {mode === "login" ? "Sign up" : "Log in"}
              </button>
            </p>
          </div>
          <div className="ld-auth-foot">Private account access</div>
        </>
      )}
    </section>
  );
});
export default LandingAuth;
