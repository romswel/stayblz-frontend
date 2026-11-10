import { Fragment, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import Brand from "./Brand";
import Modal from "./Modal";
import CartReview from "./pps/CartReview";
import { useCart } from "./pps/CartContext";
import PPNavigation from "./pps/PPNavigation";
import { useWorkspace } from "../workspace";
import "./team.css";
import "./workspace.css";
import "./my-racing/my-racing.css";
import "./account/account.css";
import { canUse, roleLabel } from "./account/roles";
import DevNotice from "./status/DevNotice";
import ErrorBoundary from "./status/ErrorBoundary";
import UpdatesPopup from "./updates/UpdatesPopup";
import { useUpdates } from "./updates/UpdatesContext";
import "./updates/updates.css";
import BackButton from "./ui/BackButton";
import { useConfirm } from "./ui/Confirm";
import DialogHead from "./ui/DialogHead";

const ICON_PROPS = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const DashboardIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="3" y="3" width="8" height="10" rx="1.5" />
    <rect x="13" y="3" width="8" height="6" rx="1.5" />
    <rect x="13" y="11" width="8" height="10" rx="1.5" />
    <rect x="3" y="15" width="8" height="6" rx="1.5" />
  </svg>
);
const MessagesIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
const InventoryIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
    <path d="M3 7l9 4 9-4" />
    <path d="M12 11v10" />
  </svg>
);
const TrackerIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const EntriesIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M5 3v18" />
    <path d="M5 4h13l-3 4 3 4H5" />
  </svg>
);
const ResultsIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M8 21h8" />
    <path d="M12 17v4" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M7 6H4a3 3 0 0 0 3 4" />
    <path d="M17 6h3a3 3 0 0 1-3 4" />
  </svg>
);
const WorkoutsIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2" />
    <path d="M10 2h4" />
  </svg>
);
const FiguresIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M4 19V9" />
    <path d="M10 19V5" />
    <path d="M16 19v-8" />
    <path d="M22 19H2" />
  </svg>
);
const StatsIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 3 3 6-6" />
  </svg>
);
const StakesIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M8 2v4M16 2v4M3 9h18" />
  </svg>
);
const StableIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.8l-5.8 3 1.1-6.4L2.6 9.8l6.5-.9z" />
  </svg>
);
const SunIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MoonIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
const UpdatesIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z" />
    <path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);
const MenuIcon = () => (
  <svg {...ICON_PROPS} width={20} height={20}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const LogoutIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

/** Pages with their own top bar (no shared Back bar). */
const OWN_BACK = (path: string) => path === "/dashboard" || path === "/pps" || path.startsWith("/pps/");

const GROUPS = [
  {
    label: "Racing",
    items: [
      { to: "/dashboard", label: "Overview", icon: <DashboardIcon /> },
      { to: "/entries", label: "Entries", icon: <EntriesIcon /> },
      { to: "/results", label: "Results & Charts", icon: <ResultsIcon /> },
      { to: "/workouts", label: "Workouts", icon: <WorkoutsIcon /> },
      { to: "/speed-figures", label: "Speed Figures", icon: <FiguresIcon /> },
      { to: "/statistics", label: "Statistics", icon: <StatsIcon /> },
      { to: "/stakes", label: "Stakes Schedule", icon: <StakesIcon /> },
    ],
  },
  {
    label: "My racing",
    items: [
      { to: "/my-racing", label: "Following & notebook", icon: <StableIcon /> },
      { to: "/messages", label: "Messages", icon: <MessagesIcon /> },
      { to: "/account", label: "My account", icon: <TrackerIcon /> },
    ],
  },
];
const WORKSPACE_ITEMS = [
  { to: "/workspace", label: "Workspace overview", icon: <DashboardIcon /> },
  { to: "/inventory", label: "Inventory", icon: <InventoryIcon /> },
  { to: "/tracker", label: "Horse Tracker", icon: <TrackerIcon /> },
  { to: "/team-messages", label: "Team messages", icon: <MessagesIcon /> },
  { to: "/stables", label: "My stables & team", icon: <StableIcon /> },
];

export default function Layout() {
  const { active: stable, stables, select } = useWorkspace();
  const { user, logout } = useAuth();
  const { unread: unreadUpdates } = useUpdates();
  const unreadCount = unreadUpdates.length;
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("stayblz.sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const [theme, toggleTheme] = useTheme();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Press "/" anywhere (outside a text field) to jump to search.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  const [notice, setNotice] = useState("");
  const [cart, setCart] = useState(false);
  const { items: cartItems } = useCart();
  const [logoutError, setLogoutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    setOpen(false);
    setNotice("");
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "stayblz.sidebar",
        collapsed ? "collapsed" : "expanded",
      );
    } catch {
      /* Layout still works. */
    }
  }, [collapsed]);
  const confirm = useConfirm();
  async function handleLogout() {
    if (signingOut) return;
    const sure = await confirm({
      title: "Log out of Stayblz?",
      message: "You'll need your email and password to sign in again on this device. Unsent drafts for this account are removed.",
      confirmLabel: "Log out",
      cancelLabel: "Stay signed in",
    });
    if (!sure) return;
    setOpen(false);
    setSigningOut(true);
    setLogoutError("");
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (reason) {
      setLogoutError(
        reason instanceof Error
          ? reason.message
          : "Sign-out could not be confirmed. Please try again.",
      );
    } finally {
      setSigningOut(false);
    }
  }
  async function share() {
    setNotice("");
    // Share the overview, never account details or private conversation URLs.
    const url = `${window.location.origin}/dashboard`;
    try {
      if (navigator.share)
        await navigator.share({ title: "Stayblz racing overview", url });
      else {
        await navigator.clipboard.writeText(url);
        setNotice("Overview link copied.");
      }
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError"))
        setNotice(
          "Sharing is unavailable. Copy the overview address from your browser.",
        );
    }
  }
  const navigation = (
    <nav aria-label="Main">
      {GROUPS.map((g) => (
        <Fragment key={g.label}>
          <div className="ws-nav-group">{g.label}</div>
          {g.items.map((item) => (
            <Fragment key={item.to}>
              <NavLink
                to={item.to}
                end
                aria-label={item.to === "/dashboard" ? "Overview" : item.label}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `ws-nav-item${isActive ? " active" : ""}`
                }
                onClick={() => setOpen(false)}
              >
                {item.icon}
                <span>
                  {item.to === "/dashboard" ? "Overview" : item.label}
                </span>
              </NavLink>
              {item.to === "/dashboard" && (
                <PPNavigation
                  collapsed={collapsed}
                  onNavigate={() => setOpen(false)}
                  onExpand={() => setCollapsed(false)}
                />
              )}
            </Fragment>
          ))}
        </Fragment>
      ))}
      <details
        className="ws-workspace-disclosure"
        open={
          WORKSPACE_ITEMS.some((item) => item.to === location.pathname) ||
          undefined
        }
      >
        <summary title="Stable workspace (optional)">
          <StableIcon />
          <span className="ws-workspace-label">
            Stable workspace<small>Optional for owners & teams</small>
          </span>
        </summary>
        {stables.length > 0 && (
          <label className="ws-stable-select">
            Stable
            <select
              aria-label="Current stable"
              value={stable?.id ?? ""}
              onChange={(e) => select(e.target.value)}
            >
              {stables.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {WORKSPACE_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            className="ws-nav-item"
            to={item.to}
            aria-label={item.label}
            title={item.label}
            onClick={() => setOpen(false)}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </details>
      <div className="ws-nav-group">Support</div>
      <NavLink
        className="ws-nav-item"
        to="/updates"
        aria-label={
          unreadCount
            ? `Updates (${unreadCount} new ${unreadCount === 1 ? "post" : "posts"})`
            : "Updates"
        }
        title="Updates: releases, news & notices"
        onClick={() => setOpen(false)}
      >
        <UpdatesIcon />
        <span>Updates</span>
        {unreadCount > 0 && (
          <span className="up-count" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </NavLink>
      {canUse(user, "admin") && (
        <>
          <NavLink
            className="ws-nav-item"
            to="/admin/racing"
            aria-label="Publish racing"
            title="Publish racing"
            onClick={() => setOpen(false)}
          >
            <EntriesIcon />
            <span>Publish racing</span>
          </NavLink>
          <NavLink
            className="ws-nav-item"
            to="/administration"
            aria-label="Administration"
            title="Administration"
            onClick={() => setOpen(false)}
          >
            <StatsIcon />
            <span>Administration</span>
          </NavLink>
        </>
      )}
      <Link
        className="ws-nav-item"
        to="/faq"
        aria-label="Help & FAQ"
        title="Help & FAQ"
        onClick={() => setOpen(false)}
      >
        <span aria-hidden="true">?</span>
        <span>Help & FAQ</span>
      </Link>
    </nav>
  );
  return (
    <div
      className={`workspace${collapsed ? " ws-collapsed" : ""}${location.pathname === "/pps" || location.pathname.startsWith("/pps/") ? " ws-pp-page" : ""}`}
    >
      <a className="ws-skip" href="#workspace-content">
        Skip to content
      </a>
      <header className="ws-header">
        <button
          className="ws-mobile-menu ws-icon-button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <MenuIcon />
        </button>
        {!OWN_BACK(location.pathname) && <BackButton iconOnly className="ws-mobile-back" />}
        <Link
          className="ws-brand"
          to="/dashboard"
          aria-label="Stayblz overview"
        >
          <Brand />
          <span>
            STAYBLZ<small>THE RACING LEDGER</small>
          </span>
        </Link>
        <form
          className="ws-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(
              `/dashboard${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
            );
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <circle cx="10" cy="10" r="7" />
            <path d="m16 16 5 5" />
          </svg>
          <input
            ref={searchRef}
            aria-label="Search racing records"
            aria-keyshortcuts="/"
            placeholder="Search horses, races, people..."
            title="Search (shortcut: /)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            maxLength={120}
          />
          <button type="submit">Search</button>
        </form>
        <div className="ws-header-actions">
          <button
            className="ws-icon-button"
            onClick={share}
            aria-label="Share overview"
            title="Share overview"
          >
            <svg {...ICON_PROPS}>
              <path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" />
            </svg>
          </button>
          <button
            className="ws-icon-button"
            onClick={() => setCart(true)}
            aria-label="Shopping cart"
            title="Shopping cart"
          >
            <svg {...ICON_PROPS}>
              <path d="M2 3h3l3 13h11l3-9H6" />
              <circle cx="9" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
            </svg>
            {cartItems.length > 0 && (
              <span
                className="pp-cart-count"
                aria-label={`${cartItems.length} selections`}
              >
                {cartItems.length}
              </span>
            )}
          </button>
          <button
            className="ws-icon-button"
            onClick={toggleTheme}
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link to="/account" className="ws-account" aria-label="Your account">
            <span>{(user?.displayName ?? "?").charAt(0)}</span>
            <div>
              {user?.displayName}
              <small>My account</small>
            </div>
          </Link>
        </div>
      </header>
      <aside className="ws-sidebar" aria-label="Workspace navigation">
        {navigation}
        <div className="ws-sidebar-bottom">
          <button className="ws-logout" onClick={handleLogout} disabled={signingOut} title="Log out">
            <LogoutIcon />
            <span className="ws-collapse-label">
              {signingOut ? "Signing out..." : "Log out"}
            </span>
          </button>
        </div>
      </aside>
      {/* The sidebar's edge: click anywhere along it, or the small round button, to collapse or expand. */}
      <div className="ws-edge">
        <button
          type="button"
          className="ws-edge-line"
          tabIndex={-1}
          aria-hidden="true"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        />
        <button
          type="button"
          className="ws-collapse"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronIcon />
        </button>
      </div>
      {open && (
        <Modal label="Navigation" className="modal-drawer" onClose={() => setOpen(false)}>
          <div className="ws-drawer">
            <DialogHead title="Menu" kicker="Stayblz" onClose={() => setOpen(false)} closeLabel="Close menu" />
            {navigation}
            <button
              className="ws-button ws-drawer-logout"
              onClick={handleLogout}
              disabled={signingOut}
            >
              <LogoutIcon /> Log out
            </button>
          </div>
        </Modal>
      )}
      <div className="sb-progress" key={location.pathname} aria-hidden="true" />
      <main id="workspace-content" className="ws-main" tabIndex={-1}>
        <DevNotice />
        {notice && (
          <p className="ws-notice" role="status">
            {notice}
          </p>
        )}
        {logoutError && (
          <p className="form-error" role="alert">
            {logoutError}
          </p>
        )}
        {user?.actingRole && (
          <p className="acct-view-banner" role="status">
            <span>
              You're viewing Stayblz as <strong>{roleLabel(user.actingRole)}</strong>. Your{" "}
              {roleLabel(user.platformRole)} tools are hidden.
            </span>
            <Link to="/account/security">Switch view</Link>
          </p>
        )}
        <div
          key={
            ["/workspace", "/inventory", "/tracker", "/team-messages"].includes(
              location.pathname,
            )
              ? (stable?.id ?? "no-stable")
              : "personal"
          }
        >
          {/* A crash in one page keeps the menu working; changing page resets it.
              The wrapper replays a short entrance animation on every navigation. */}
          <ErrorBoundary key={location.pathname}>
            {!OWN_BACK(location.pathname) && (
              <div className="ws-pagebar">
                <BackButton />
              </div>
            )}
            <div className="ws-page">
              <Outlet />
            </div>
          </ErrorBoundary>
        </div>
        <footer className="ws-footer">
          <span>STAYBLZ · Know the horse. Read the race. · Development preview</span>
          <span className="ws-footer-links">
            <Link to="/updates">Updates</Link> <Link to="/faq">Help & FAQ</Link>{" "}
            <Link to="/terms">Terms</Link> <Link to="/privacy">Privacy</Link>
          </span>
        </footer>
      </main>
      <UpdatesPopup />
      {cart && (
        <Modal label="Shopping cart" onClose={() => setCart(false)}>
          <DialogHead title="Your cart" kicker="Cart preview" onClose={() => setCart(false)} />
          <div className="dlg">
            <CartReview inDialog onNavigate={() => setCart(false)} />
          </div>
        </Modal>
      )}
    </div>
  );
}
