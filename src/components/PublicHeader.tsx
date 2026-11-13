import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import Brand from "./Brand";
import { VERSION_LABEL, VERSION_TITLE } from "../version";
import DevNotice from "./status/DevNotice";

const iconProps = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export default function PublicHeader({
  onAuth,
  themeButton = false,
}: {
  onAuth?: (mode: "login" | "signup") => void;
  /** Show the light/dark button (pages whose colours follow the theme). */
  themeButton?: boolean;
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
    <>
    <DevNotice variant="public" />
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
          <em className="ld-version" title={VERSION_TITLE}>
            {VERSION_LABEL}
          </em>
        </button>
        <nav className="ld-header-account" aria-label="Public navigation">
          {themeButton && (
            <button
              type="button"
              className="ld-theme-button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
              }
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
                <svg {...iconProps}>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg {...iconProps}>
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
                </svg>
              )}
            </button>
          )}
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
    </>
  );
}
