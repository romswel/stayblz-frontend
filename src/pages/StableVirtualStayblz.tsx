import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useWorkspace } from "../workspace";
import VirtualStayblz from "../components/virtual/VirtualStayblz";
import "../components/overview/overview.css";
import "../components/stable-glass.css";

/** The active stable's shared Virtual Stayblz (horses the team tracks without owning them). */
export default function StableVirtualStayblz() {
  const { active, stables, select } = useWorkspace();
  // Alert links carry ?stable=<id>: open that stable's list (when you're in it), then drop the parameter.
  const [params, setParams] = useSearchParams();
  const wanted = params.get("stable");
  useEffect(() => {
    if (!wanted) return;
    if (stables.some((s) => s.id === wanted) && active?.id !== wanted) select(wanted);
    const next = new URLSearchParams(params);
    next.delete("stable");
    setParams(next, { replace: true });
  }, [wanted, stables]);
  return (
    <div className="overview sg-page vs-page">
      <header className="ov-heading">
        <div>
          <span className="ov-kicker">STABLE WORKSPACE · SHARED WITH YOUR TEAM</span>
          <h1>
            Virtual Stayblz<span>.</span>
          </h1>
          <p>Horses {active?.name ?? "your stable"} is watching: performance, workouts, races and sales entries in one shared list.</p>
        </div>
        <Link className="ws-button" to="/my-racing?tab=virtual">
          My private list ↗
        </Link>
      </header>
      <section className="panel vs-panel gx-glass">
        <VirtualStayblz mode="stable" />
      </section>
    </div>
  );
}
