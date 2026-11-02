import { Link } from "react-router-dom";
import { useWorkspace, StableGate } from "../workspace";
import StableActivity from "../components/overview/StableActivity";
import "../components/overview/overview.css";
export default function StableWorkspace() {
  const { active } = useWorkspace();
  return (
    <div className="overview">
      <header className="ov-heading">
        <div>
          <span className="ov-kicker">OPTIONAL · STABLE OPERATIONS</span>
          <h1>
            {active?.name ?? "Stable workspace"}
            <span>.</span>
          </h1>
          <p>
            A private place for your horses, training records, and team’s daily
            work.
          </p>
        </div>
        <Link className="ws-button" to="/dashboard">
          Racing overview ↗
        </Link>
      </header>
      <nav className="ov-jumps" aria-label="Stable workspace sections">
        {[
          ["/stables", "Stables & team"],
          ["/inventory", "Horse inventory"],
          ["/tracker", "Training & condition"],
          ["/team-messages", "Team messages"],
        ].map(([to, label]) => (
          <Link key={to} to={to}>
            {label} ↗
          </Link>
        ))}
      </nav>
      <StableGate>
        <StableActivity />
      </StableGate>
    </div>
  );
}
