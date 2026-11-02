import { Link, useSearchParams } from "react-router-dom";
import VirtualStable from "./VirtualStable";
import NotesPanel from "../components/my-racing/NotesPanel";
import PreferencesPanel from "../components/my-racing/PreferencesPanel";
import "../components/overview/overview.css";
import "../components/my-racing/my-racing.css";
export default function MyRacing() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("tab");
  const tab =
    selected === "notes" || selected === "alerts" ? selected : "following";
  return (
    <div className="my-racing">
      <header className="ov-heading">
        <div>
          <span className="ov-kicker">YOUR ACCOUNT. YOUR RACING.</span>
          <h1>
            My racing<span>.</span>
          </h1>
          <p>
            The horses you follow, the details you notice, and the people you
            talk racing with.
          </p>
        </div>
        <Link className="ws-button" to="/account">
          My account ↗
        </Link>
      </header>
      <nav className="mr-tabs" aria-label="My racing sections">
        {[
          ["following", "Following"],
          ["notes", "Race notebook"],
          ["alerts", "Alert preferences"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setParams(key === "following" ? {} : { tab: key })}
          >
            {label}
          </button>
        ))}
        <Link to="/messages">Messages ↗</Link>
      </nav>
      {tab === "following" ? (
        <VirtualStable embedded />
      ) : tab === "notes" ? (
        <NotesPanel />
      ) : (
        <PreferencesPanel />
      )}
      <aside className="mr-optional">
        <div>
          <span className="ov-kicker">FOR OWNERS, TRAINERS & TEAMS</span>
          <h2>Run a stable, too?</h2>
          <p>
            Horse inventory, training records, and team updates have their own
            optional workspace.
          </p>
        </div>
        <Link className="ws-button" to="/workspace">
          Explore stable workspace ↗
        </Link>
      </aside>
    </div>
  );
}
