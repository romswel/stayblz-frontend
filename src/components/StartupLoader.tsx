import { useEffect, useState } from "react";

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
          <img src="/favicon.svg" alt="" />
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
      </div>
    </div>
  );
}
