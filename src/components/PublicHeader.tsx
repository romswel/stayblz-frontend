import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import Brand from "./Brand";

export default function PublicHeader({
  onAuth,
}: {
  onAuth?: (mode: "login" | "signup") => void;
}) {
  const { user } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  function openAccount(mode: "login" | "signup") {
    if (onAuth) onAuth(mode);
    else
      navigate(mode === "signup" ? "/signup" : "/login", {
        state: { focusAccount: true },
      });
  }
  return (
    <header className="ld-header">
      <div className="ld-header-inner">
        <button
          type="button"
          className="ld-brand ld-brand-toggle"
          aria-label={`Stayblz logo: switch to ${theme === "dark" ? "light" : "dark"} mode`}
          aria-pressed={theme === "dark"}
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <Brand />
          <span className="ld-brand-spark" aria-hidden="true">
            ✦
          </span>
          <span>
            <strong>
              STAYBLZ<span className="ld-wordmark-dot">.</span>
            </strong>
            <small>THE RACING LEDGER</small>
          </span>
        </button>
        <nav className="ld-header-account" aria-label="Public navigation">
          {pathname === "/faq" && (
            <Link className="ld-text-button" to="/">
              Overview
            </Link>
          )}
          <Link
            className="ld-text-button"
            to="/faq"
            aria-current={pathname === "/faq" ? "page" : undefined}
          >
            FAQ
          </Link>
          {user ? (
            <>
              <span className="ld-account-name">
                {user.displayName || user.username}
              </span>
              <Link
                className="ld-button ld-button-gold ld-header-continue"
                to="/dashboard"
              >
                Continue to dashboard <span aria-hidden="true">↗</span>
              </Link>
            </>
          ) : (
            <>
              <button
                className="ld-text-button"
                onClick={() => openAccount("login")}
              >
                Log in
              </button>
              <button
                className="ld-button ld-button-gold"
                onClick={() => openAccount("signup")}
              >
                Sign up <span aria-hidden="true">↗</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
