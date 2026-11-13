import { Link } from "react-router-dom";
import { TV_NAME } from "../components/tv/brand";
import "../components/overview/overview.css";
import "../components/subscription/subscription.css";

/**
 * Subscription (Support menu). No plans, prices or payments exist yet, so the page says so
 * plainly: no sample plan, price or "subscribe" button that wouldn't work.
 */
export default function Subscription() {
  return (
    <div className="sub-page">
      <header className="ov-heading">
        <div>
          <span className="ov-kicker">ACCOUNT</span>
          <h1>
            Subscription<span>.</span>
          </h1>
          <p>Your Stayblz plan and what it includes.</p>
        </div>
      </header>
      <section className="sub-card" aria-labelledby="sub-current">
        <span className="sub-label">Current plan</span>
        <h2 id="sub-current">No subscription</h2>
        <p>Subscriptions aren't available yet. No plans, prices or payment methods are set up, and nothing is charged.</p>
      </section>
      <section className="sub-card" aria-labelledby="sub-coming">
        <h2 id="sub-coming">Coming with subscriptions</h2>
        <ul>
          <li>
            Watching <Link to="/tv">{TV_NAME}</Link> live race telecasts.
          </li>
        </ul>
        <p className="sub-note">Plans and prices will be announced in Updates before anything is charged.</p>
        <Link className="ws-button" to="/updates">
          See Updates
        </Link>
      </section>
    </div>
  );
}
