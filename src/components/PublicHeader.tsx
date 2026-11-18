import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import Brand from "./Brand";
import { VERSION_LABEL, VERSION_TITLE } from "../version";
import DevNotice from "./status/DevNotice";
import "./public-glass.css";

const iconProps = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const SunIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MoonIcon = () => (
  <svg {...iconProps}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

/** The ambient glass background (soft orbs + faint grid) shared with the signed-in app. */
export function PublicAmbient() {
  return (
    <div className="gx-ambient pg-ambient" aria-hidden="true">
      <span className="gx-orb gx-orb-a" />
      <span className="gx-orb gx-orb-b" />
      <span className="gx-orb gx-orb-c" />
      <span className="gx-grid" />
    </div>
  );
}

/**
 * Header for public pages (home, FAQ, legal, Updates, confirm): a floating glass bar like the
 * signed-in app's. The logo still flips light/dark (a small Easter egg); the switch does it plainly.
 */
export default function PublicHeader({
  onAuth,
}: {
  onAuth?: (mode: "login" | "signup") => void;
  /** Kept for older callers: every public page now follows the theme and shows the switch. */
  themeButton?: boolean;
}) {
  const { user } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();
  const { pathname } = useLocation();
  function openAccount(mode: "login" | "signup") {
    if (onAuth) onAuth(mode);
    else
      navigate(mode === "signup" ? "/signup" : "/login", {
        state: { focusAccount: true },
      });
  }
  const here = (path: string) => (pathname === path || pathname.startsWith(`${path}/`) ? "page" : undefined);
  return (
    <>
      <PublicAmbient />
      <DevNotice variant="public" />
      <header className="ld-header pg-header">
        <div className="ld-header-inner gx-glass">
          <button
            type="button"
            className="ld-brand ld-brand-toggle gx-brand"
            aria-label={`Stayblz logo: switch to ${isDark ? "light" : "dark"} mode`}
            aria-pressed={isDark}
            onClick={toggleTheme}
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            <span className="gx-brand-mark">
              <Brand />
            </span>
            <span className="ld-brand-spark" aria-hidden="true">
              ✦
            </span>
            <span className="gx-brand-text">
              STAYBLZ<small>THE RACING LEDGER</small>
            </span>
            <em className="gx-version" title={VERSION_TITLE}>
              {VERSION_LABEL}
            </em>
          </button>
          <nav className="ld-header-account pg-nav" aria-label="Public navigation">
            <Link className="pg-link pg-hide-sm" to="/updates" aria-current={here("/updates")}>
              Updates
            </Link>
            <Link className="pg-link pg-hide-xs" to="/faq" aria-current={here("/faq")}>
              FAQ
            </Link>
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              className="gx-theme pg-theme"
              onClick={toggleTheme}
              aria-label="Dark mode"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              <span className="gx-theme-track" aria-hidden="true">
                <SunIcon />
                <MoonIcon />
              </span>
              <span className="gx-theme-knob" aria-hidden="true">
                {isDark ? <MoonIcon /> : <SunIcon />}
              </span>
            </button>
            {user ? (
              <Link className="ld-button ld-button-gold pg-primary ld-header-continue" to="/dashboard">
                <span className="pg-hide-sm">{user.displayName || user.username} · </span>Continue to dashboard
              </Link>
            ) : (
              <>
                <button type="button" className="pg-link" onClick={() => openAccount("login")}>
                  Log in
                </button>
                <button type="button" className="ld-button ld-button-gold pg-primary" onClick={() => openAccount("signup")}>
                  Sign up
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
