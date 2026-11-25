import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import Brand from "./Brand";
import "./public.css";
import "./public-glass.css";

export default function PublicFooter() {
  const { user } = useAuth();
  return (
    <footer className="ld-public-footer pg-footer">
      <div className="pg-footer-card gx-glass">
        <div className="ld-public-footer-top ld-reveal">
          <Link to="/" className="ld-brand gx-brand" aria-label="Stayblz overview">
            <span className="gx-brand-mark">
              <Brand />
            </span>
            <span className="gx-brand-text">
              STAYBLZ<small>THE RACING LEDGER</small>
            </span>
          </Link>
          <p>
            Know the horse. <em>Read the race.</em>
          </p>
          <nav aria-label="Footer navigation">
            <span className="ld-kicker">EXPLORE</span>
            <Link to="/faq">Frequently asked questions</Link>
            <Link to="/status">Service status</Link>
            <Link to="/updates">Updates & news</Link>
            <Link to="/terms">Terms of Use</Link>
            <Link to="/privacy">Privacy Notice</Link>
            <Link to={user ? "/dashboard" : "/login"}>{user ? "Your account" : "Log in"}</Link>
            {!user && <Link to="/signup">Create an account</Link>}
          </nav>
        </div>
        <div className="ld-public-footer-bottom">
          <small>© {new Date().getFullYear()} Stayblz</small>
          <span className="pg-preview-pill">DEVELOPMENT PREVIEW</span>
          <a href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}
