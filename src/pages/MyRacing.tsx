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
          <span className="ov-kicker">SAVED ITEMS AND SETTINGS</span>
          <h1>
            My racing<span>.</span>
          </h1>
          <p>
            Manage your followed horses, notes, messages, and alert settings.
          </p>
        </div>
        <Link className="ws-button" to="/account">
          My account ↗
        </Link>
      </header>
      <nav className="mr-tabs" aria-label="My racing sections">
        {[
          ["following", "Following"],
          ["notes", "My notes"],
          ["alerts", "Alert settings"],
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
          <h2>Stable tools</h2>
          <p>
            Manage horse records, training updates, and team messages in your stable workspace.
          </p>
        </div>
        <Link className="ws-button" to="/workspace">
          Open stable workspace ↗
        </Link>
      </aside>
    </div>
  );
}
