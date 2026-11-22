/**
 * "Under work": parts of Stayblz Stallions that aren't finished yet say so plainly, right where they'd be used.
 * Remove a line here (or the whole note) as each part goes live.
 */
export function UnderWorkTag() {
  return <span className="st-tag is-warn st-underwork-tag">Under work</span>;
}

/** The directory's short "what's still coming" line. */
export function StallionsUnderWork() {
  return (
    <p className="st-underwork" role="note">
      <UnderWorkTag />
      <span>
        Stayblz Stallions is new and still growing. Offspring figures only cover races in Great Britain, Ireland, France and
        Hong Kong until US results arrive, and featuring a stallion runs on Stayblz Billing's test mode (no real money).
      </span>
    </p>
  );
}
