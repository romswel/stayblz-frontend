import { Link } from "react-router-dom";
import { TV_NAME } from "../components/tv/brand";
import "../components/overview/overview.css";
import "../components/tv/tv.css";

/**
 * Live race telecasts. No broadcast source is connected yet, so the screen says so plainly:
 * no sample video, schedule or "live" badge that isn't real.
 */
export default function StayblzTV() {
  return (
    <div className="tv-page">
      <header className="ov-heading">
        <div>
          <span className="ov-kicker">LIVE RACE TELECAST</span>
          <h1>
            {TV_NAME}
            <span>.</span>
          </h1>
          <p>Watch races live from the track, right inside Stayblz.</p>
        </div>
      </header>
      <section className="tv-screen" aria-label={`${TV_NAME} player`}>
        <div className="tv-screen-inner">
          <span className="tv-status">
            <span className="tv-dot" aria-hidden="true" />
            Off air
          </span>
          <svg className="tv-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="2.5" y="6" width="19" height="13" rx="2" />
            <path d="M8 2.5l4 3.5 4-3.5" />
            <path d="M10.2 10.2v5.6l4.6-2.8z" />
          </svg>
          <h2>No live broadcast right now</h2>
          <p>
            Live race telecasts aren't connected yet. When {TV_NAME} goes on air, races will play here and this
            screen will show what's live.
          </p>
        </div>
      </section>
      <div className="tv-next">
        <p>Follow Updates for news about {TV_NAME}.</p>
        <Link className="ws-button" to="/updates">
          See Updates
        </Link>
      </div>
    </div>
  );
}
