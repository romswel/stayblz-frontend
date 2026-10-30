import { Fragment, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useTheme } from '../theme';
import logo from '../assets/logo.png';

const ICON_PROPS = {
  width: 17,
  height: 17,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const;

const DashboardIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="3" y="3" width="8" height="10" rx="1.5" /><rect x="13" y="3" width="8" height="6" rx="1.5" />
    <rect x="13" y="11" width="8" height="10" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" />
  </svg>
);
const MessagesIcon = () => (
  <svg {...ICON_PROPS}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
const InventoryIcon = () => (
  <svg {...ICON_PROPS}><path d="M3 7l9-4 9 4v10l-9 4-9-4z" /><path d="M3 7l9 4 9-4" /><path d="M12 11v10" /></svg>
);
const TrackerIcon = () => (
  <svg {...ICON_PROPS}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
const EntriesIcon = () => (
  <svg {...ICON_PROPS}><path d="M5 3v18" /><path d="M5 4h13l-3 4 3 4H5" /></svg>
);
const ResultsIcon = () => (
  <svg {...ICON_PROPS}><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4a3 3 0 0 0 3 4" /><path d="M17 6h3a3 3 0 0 1-3 4" /></svg>
);
const WorkoutsIcon = () => (
  <svg {...ICON_PROPS}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2" /><path d="M10 2h4" /></svg>
);
const FiguresIcon = () => (
  <svg {...ICON_PROPS}><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-8" /><path d="M22 19H2" /></svg>
);
const StatsIcon = () => (
  <svg {...ICON_PROPS}><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 6-6" /></svg>
);
const StakesIcon = () => (
  <svg {...ICON_PROPS}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /></svg>
);
const BettingIcon = () => (
  <svg {...ICON_PROPS}><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z" /><path d="M14 5v14" /></svg>
);
const StableIcon = () => (
  <svg {...ICON_PROPS}><path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.8l-5.8 3 1.1-6.4L2.6 9.8l6.5-.9z" /></svg>
);
const SunIcon = () => (
  <svg {...ICON_PROPS}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
const MoonIcon = () => (
  <svg {...ICON_PROPS}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
);
const MenuIcon = () => (
  <svg {...ICON_PROPS} width={20} height={20}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);

const GROUPS = [
  {
    label: 'Stable',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
      { to: '/messages', label: 'Messages', icon: <MessagesIcon /> },
      { to: '/inventory', label: 'Inventory', icon: <InventoryIcon /> },
      { to: '/tracker', label: 'Horse Tracker', icon: <TrackerIcon /> }
    ]
  },
  {
    label: 'Racing data',
    items: [
      { to: '/entries', label: 'Entries', icon: <EntriesIcon /> },
      { to: '/results', label: 'Results & Charts', icon: <ResultsIcon /> },
      { to: '/workouts', label: 'Workouts', icon: <WorkoutsIcon /> },
      { to: '/speed-figures', label: 'Speed Figures', icon: <FiguresIcon /> },
      { to: '/statistics', label: 'Statistics', icon: <StatsIcon /> },
      { to: '/stakes', label: 'Stakes Schedule', icon: <StakesIcon /> },
      { to: '/virtual-stable', label: 'Virtual Stable', icon: <StableIcon /> }
    ]
  },
  {
    label: 'Wagering',
    items: [
      { to: '/betting', label: 'Betting', icon: <BettingIcon /> }
    ]
  }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="shell">
      <div className="topbar">
        <button className="menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}>
          <MenuIcon />
        </button>
        <img src={logo} alt="" />
        <span className="name">Stayblz</span>
      </div>

      {open && <button className="scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <img src={logo} alt="Stayblz logo" />
          <div>
            <div className="name">Stayblz</div>
            <div className="tag">Racing operations</div>
          </div>
        </div>

        <nav aria-label="Main">
          {GROUPS.map((g) => (
            <Fragment key={g.label}>
              <div className="nav-group">{g.label}</div>
              {g.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </Fragment>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="user-row">
            <div className="avatar">{(user?.displayName ?? '?').charAt(0)}</div>
            <div className="who">
              <div className="n">{user?.displayName}</div>
              <div className="r">{user?.role}</div>
            </div>
            <button
              className="theme-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
          <button className="btn-logout" onClick={handleLogout}>Log out</button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
