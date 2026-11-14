import { Link, useSearchParams } from "react-router-dom";
import VirtualStable from "./VirtualStable";
import NotesPanel from "../components/my-racing/NotesPanel";
import PreferencesPanel from "../components/my-racing/PreferencesPanel";
import "../components/overview/overview.css";
import "../components/my-racing/my-racing.css";
import "../components/my-racing/my-racing-glass.css";

const I = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;
const StarIcon = () => (<svg {...I}><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.8l-5.8 3 1.1-6.4L2.6 9.8l6.5-.9z" /></svg>);
const NoteIcon = () => (<svg {...I}><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></svg>);
const BellIcon = () => (<svg {...I}><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z" /><path d="M10 21h4" /></svg>);
const ChatIcon = () => (<svg {...I}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>);
const UserIcon = () => (<svg {...I} width={16} height={16}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>);
const Arrow = () => (<svg {...I} width={14} height={14} strokeWidth={2.2}><path d="M7 17 17 7M8 7h9v9" /></svg>);
const BoxIcon = () => (<svg {...I} width={16} height={16}><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4M12 11v10" /></svg>);
const ClockIcon = () => (<svg {...I} width={16} height={16}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
const TeamIcon = () => (<svg {...I} width={16} height={16}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></svg>);

const TABS = [
  { key: "following", label: "Following", hint: "Horses, jockeys & trainers", icon: <StarIcon /> },
  { key: "notes", label: "My notes", hint: "Private, only you can see", icon: <NoteIcon /> },
  { key: "alerts", label: "Alert settings", hint: "Choose your updates", icon: <BellIcon /> },
] as const;

export default function MyRacing() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("tab");
  const tab = selected === "notes" || selected === "alerts" ? selected : "following";
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div className="mrg">
      {/* ---------- Header ---------- */}
      <header className="mrg-hero gx-glass">
        <div className="mrg-hero-main">
          <span className="mrg-kicker">
            <span className="mrg-pulse" aria-hidden="true" /> Saved items and settings
          </span>
          <h1>
            My racing<span>.</span>
          </h1>
          <p>Manage your followed horses, notes, messages, and alert settings.</p>
        </div>
        <Link className="mrg-btn" to="/account">
          <UserIcon /> My account <Arrow />
        </Link>
      </header>

      {/* ---------- Section tabs ---------- */}
      <nav className="mrg-tabs" aria-label="My racing sections">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.key}
            className="mrg-tab gx-glass"
            aria-pressed={tab === t.key}
            onClick={() => setParams(t.key === "following" ? {} : { tab: t.key })}
          >
            <span className="mrg-tab-icon">{t.icon}</span>
            <span className="mrg-tab-text">
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
            </span>
          </button>
        ))}
        <Link to="/messages" className="mrg-tab mrg-tab-link gx-glass">
          <span className="mrg-tab-icon"><ChatIcon /></span>
          <span className="mrg-tab-text">
            <strong>Messages</strong>
            <small>Private conversations</small>
          </span>
          <span className="mrg-tab-arrow" aria-hidden="true"><Arrow /></span>
        </Link>
      </nav>

      {/* ---------- Active panel ---------- */}
      <section className="mrg-panel gx-glass" aria-labelledby="mrg-panel-title">
        <header className="mrg-panel-head">
          <span className="mrg-panel-icon" aria-hidden="true">{current.icon}</span>
          <div>
            <h2 id="mrg-panel-title">{current.label}</h2>
            <p>{current.hint}</p>
          </div>
        </header>
        <div className="mrg-panel-body" key={tab}>
          {tab === "following" ? <VirtualStable embedded /> : tab === "notes" ? <NotesPanel /> : <PreferencesPanel />}
        </div>
      </section>

      {/* ---------- Stable tools ---------- */}
      <aside className="mrg-stable gx-glass" aria-labelledby="mrg-stable-title">
        <div className="mrg-stable-main">
          <span className="mrg-kicker is-gold">For owners, trainers &amp; teams</span>
          <h2 id="mrg-stable-title">Stable tools</h2>
          <p>Manage horse records, training updates, and team messages in your stable workspace.</p>
          <ul className="mrg-features">
            <li><BoxIcon /> Horse records</li>
            <li><ClockIcon /> Training updates</li>
            <li><TeamIcon /> Team messages</li>
          </ul>
        </div>
        <Link className="mrg-btn mrg-btn-primary" to="/workspace">
          Open stable workspace <Arrow />
        </Link>
      </aside>
    </div>
  );
}