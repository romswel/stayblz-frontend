/** The plain "this is test mode" line every money screen shows until a real processor is connected. */
export default function TestModeNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`bl-testmode${compact ? " is-compact" : ""}`} role="note">
      <span className="bl-testmode-tag">Test mode</span>
      {compact
        ? "No real money moves. Use a Stayblz test card."
        : "Stayblz Billing is in test mode: only Stayblz test cards and bank accounts work, and no real money is charged or paid out."}
    </p>
  );
}
