export default function StartupLoader() {
  return (
    <div
      className="sb-startup"
      role="status"
      aria-live="polite"
      aria-label="Loading Stayblz"
    >
      <div className="sb-startup-content">
        <div className="sb-startup-mark">
          <img src="/favicon.svg" alt="" />
        </div>
        <strong className="sb-startup-name">
          STAYBLZ<span>.</span>
        </strong>
        <span className="sb-startup-ledger">THE RACING LEDGER</span>
        <div className="sb-startup-line" aria-hidden="true" />
        <p className="sb-startup-message">Getting things ready…</p>
      </div>
    </div>
  );
}
