import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Brand from "../Brand";
import ThemeSwitch from "../ThemeSwitch";
import { PublicAmbient } from "../PublicHeader";
import DevNotice from "../status/DevNotice";
import { InstallButton } from "../../install/InstallGuide";
import { VERSION_LABEL, VERSION_TITLE } from "../../version";
import "./auth.css";

/**
 * The frame for account pages: log in / sign up, email links (/auth/confirm), "This wasn't me" and
 * "Finish your profile". Just the logo, "Get the app" and the theme switch on top; a few links below.
 */
export default function AuthLayout({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`gx-layer gx-public au-page ${className}`.trim()}>
      <a className="au-skip" href="#au-main">
        Skip to main content
      </a>
      <PublicAmbient />
      <DevNotice variant="public" />
      <header className="au-top">
        <Link className="au-brand" to="/" aria-label="Stayblz home">
          <span className="au-brand-mark">
            <Brand />
          </span>
          <span className="au-brand-name">STAYBLZ</span>
        </Link>
        <div className="au-top-actions">
          <InstallButton />
          <ThemeSwitch />
        </div>
      </header>
      <main className="au-main" id="au-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="au-foot">
        <nav aria-label="More from Stayblz">
          <Link to="/legal">Terms &amp; Privacy</Link>
          <Link to="/faq">Help</Link>
          <Link to="/updates">Updates</Link>
        </nav>
        <span title={VERSION_TITLE}>© Stayblz · {VERSION_LABEL}</span>
      </footer>
    </div>
  );
}
