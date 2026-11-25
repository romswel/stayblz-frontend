import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * First-load screen. The API runs on a free server that sleeps when idle, so the first
 * visit can take up to a minute. After 5 seconds we explain that, instead of looking stuck.
 */
export default function StartupLoader() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage(1), 5000),
      window.setTimeout(() => setStage(2), 25000),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);
  return (
    <div className="sb-startup" role="status" aria-live="polite" aria-label="Loading Stayblz">
      <div className="sb-startup-content">
        <div className="sb-startup-mark">
          {/* The ink crest (same as the header logo), coloured by the theme. */}
          <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path d="M24 3 42 10v15c0 10-10 17-18 20C16 42 6 35 6 25V10L24 3Z" stroke="currentColor" strokeWidth="1.4" />
            <path d="M15 34c1-8 6-9 8-14l-7 3-2-3 8-7 1-5 5 5c7 4 9 12 8 21H15Z" fill="currentColor" />
            <path d="m25 14 5 4-4 3M13 38h23" stroke="#142820" strokeWidth="1.5" />
            <circle cx="24.5" cy="16.5" r="1" fill="#142820" />
          </svg>
        </div>
        <strong className="sb-startup-name">
          STAYBLZ<span>.</span>
        </strong>
        <span className="sb-startup-ledger">THE RACING LEDGER</span>
        <div className="sb-startup-line" aria-hidden="true" />
        <p className="sb-startup-message">
          {stage === 0
            ? "Getting things ready…"
            : stage === 1
              ? "Starting the server… this can take up to a minute on the first visit."
              : "Still starting. Thanks for waiting. It's almost ready."}
        </p>
        {stage > 0 && (
          <p className="sb-startup-note">
            Stayblz is a development preview running on a free server that sleeps when nobody is using it.
            Expect some bugs and missing features while we build.
          </p>
        )}
        {stage > 0 && (
          <Link className="sb-startup-status" to="/status">
            Check Stayblz status
          </Link>
        )}
      </div>
    </div>
  );
}
