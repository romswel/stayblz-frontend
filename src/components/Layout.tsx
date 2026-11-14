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
import { useChatBadge } from "./messenger/useChatBadge";
import { CHAT_NAME, TEAM_CHAT_NAME } from "./messenger/brand";
import { TV_NAME } from "./tv/brand";
import { VERSION_LABEL, VERSION_TITLE } from "../version";
import "./updates/updates.css";
import BackButton from "./ui/BackButton";
import { useConfirm } from "./ui/Confirm";
import DialogHead from "./ui/DialogHead";
// Glass shell — loaded last so it wins over the legacy workspace styles.
import "./layout-glass.css";

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
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
const UserIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
const EntriesIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M5 3v18" />
    <path d="M5 4h13l-3 4 3 4H5" />
  </svg>
);
const StatsIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 3 3 6-6" />
  </svg>
);
const StableIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.8l-5.8 3 1.1-6.4L2.6 9.8l6.5-.9z" />
  </svg>
);
const MarketIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);
const TvIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="2.5" y="6" width="19" height="13" rx="2" />
    <path d="M8 2.5l4 3.5 4-3.5" />
  </svg>
);
const SunIcon = () => (
  <svg {...ICON_PROPS} width={14} height={14} strokeWidth={2.2}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const MoonIcon = () => (
  <svg {...ICON_PROPS} width={14} height={14} strokeWidth={2.2}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
const UpdatesIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z" />
    <path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);
const SubscriptionIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 10h19M6.5 15h4" />
  </svg>
);
const HelpIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01" />
  </svg>
);
const MenuIcon = () => (
  <svg {...ICON_PROPS} width={20} height={20}>
    <path d="M4 7h16M4 12h10M4 17h16" />
  </svg>
);
const SearchIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const ShareIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7" />
  </svg>
);
const CartIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M2 3h3l3 13h11l3-9H6" />
    <circle cx="9" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
  </svg>
);
const ChevronIcon = () => (
  <svg {...ICON_PROPS} width={14} height={14} strokeWidth={2.4}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
/** Panel icon: a sidebar pane plus an arrow that flips with the collapsed state (via CSS). */
const SidebarIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9 4v16" />
    <path className="gx-collapse-arrow" d="M15.5 10 13.5 12l2 2" />
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
/** Switching between chats is one page, not a new one (no remount, no reload of the chat list). */
const pageKey = (path: string) => path.replace(/^\/(messages|team-messages)\/[^/]+$/, "/$1");
const countLabel = (n: number) => (n > 9 ? "9+" : String(n));
/** Chat pages run as a full-window app: no page padding, page bar, notices or footer. */
const APP_PAGE = (path: string) => /^\/(messages|team-messages)(\/|$)/.test(path);
/** An open conversation owns the bottom of the screen (composer), so the mobile tab bar steps aside. */
const CHAT_THREAD = (path: string) => /^\/(messages|team-messages)\/[^/]+$/.test(path);
const PP_PAGE = (path: string) => path === "/pps" || path.startsWith("/pps/");
const initialsOf = (name?: string) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase() || "?";

/** The Past Performances menu is hidden from the sidebar for now; set to true to bring it back. */
const SHOW_PP_NAV = false;
// The Racing group (Overview, Entries, Results & Charts, Workouts, Speed Figures, Statistics,
// Stakes Schedule) was removed from the sidebar. The pages and their routes still exist; the
// logo still goes to the overview.
const GROUPS = [
  {
    label: "Explore",
    items: [
      { to: "/marketplace", label: "Marketplace", icon: <MarketIcon /> },
      { to: "/tv", label: TV_NAME, icon: <TvIcon /> },
    ],
  },
  {
    label: "My racing",
    items: [
      { to: "/my-racing", label: "Following & notebook", icon: <StableIcon /> },
      { to: "/messages", label: CHAT_NAME, icon: <MessagesIcon /> },
      { to: "/account", label: "My account", icon: <UserIcon /> },
    ],
  },
];
const WORKSPACE_ITEMS = [
  { to: "/workspace", label: "Workspace overview", icon: <DashboardIcon /> },
  { to: "/inventory", label: "Inventory", icon: <InventoryIcon /> },
  { to: "/tracker", label: "Horse Tracker", icon: <TrackerIcon /> },
  { to: "/team-messages", label: TEAM_CHAT_NAME, icon: <MessagesIcon /> },
  { to: "/stables", label: "My stables & team", icon: <StableIcon /> },
];
/** Thumb-reach destinations for the mobile tab bar (the fifth slot opens the full menu). */
const MOBILE_TABS = [
  { to: "/dashboard", label: "Overview", icon: <DashboardIcon /> },
  { to: "/marketplace", label: "Market", icon: <MarketIcon /> },
  { to: "/tv", label: TV_NAME, icon: <TvIcon /> },
  { to: "/messages", label: CHAT_NAME, icon: <MessagesIcon /> },
];

export default function Layout() {
  const { active: stable, stables, select } = useWorkspace();
  const { user, logout } = useAuth();
  const { unread: unreadUpdates } = useUpdates();
  const unreadCount = unreadUpdates.length;
  const chats = useChatBadge(!!user && !user.passwordSetupRequired);
  const navBadge: Record<string, number> = {
    "/messages": chats.personal + chats.requests,
    "/team-messages": chats.team,
  };
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("stayblz.sidebar") === "collapsed";
    } catch {
      return false;
    }
  });
  const [theme, toggleTheme] = useTheme();
  const isDark = theme === "dark";
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Press "/" anywhere (outside a text field) to jump to search.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      event.preventDefault();
      setSearchOpen(true);
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // Press "[" (outside a text field) to collapse or expand the sidebar.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "[" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      setCollapsed((v) => !v);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // On phones the search field is hidden until opened; focus it once it is on screen.
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);
  // The header gets a stronger glass once content scrolls underneath it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [notice, setNotice] = useState("");
  const [cart, setCart] = useState(false);
  const { items: cartItems } = useCart();
  const [logoutError, setLogoutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
    setNotice("");
    window.scrollTo(0, 0);
  }, [path]);
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

  const badge = (n: number | undefined) =>
    n && n > 0 ? (
      <span className="gx-badge" aria-hidden="true">
        {countLabel(n)}
      </span>
    ) : null;
  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `gx-nav-item${isActive ? " active" : ""}`;
  const closeMenu = () => setOpen(false);

  const navigation = (
    <nav className="gx-nav" aria-label="Main">
      {SHOW_PP_NAV && (
        <PPNavigation
          collapsed={collapsed}
          onNavigate={closeMenu}
          onExpand={() => setCollapsed(false)}
        />
      )}
      {GROUPS.map((g) => (
        <Fragment key={g.label}>
          <div className="gx-nav-group">
            <span className="gx-label">{g.label}</span>
          </div>
          {g.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to !== "/messages"}
              aria-label={
                navBadge[item.to]
                  ? `${item.label} (${navBadge[item.to]} unread)`
                  : item.label
              }
              title={collapsed ? item.label : undefined}
              className={itemClass}
              onClick={closeMenu}
            >
              <span className="gx-nav-icon">{item.icon}</span>
              <span className="gx-label">{item.label}</span>
              {badge(navBadge[item.to])}
            </NavLink>
          ))}
        </Fragment>
      ))}
      <details
        className="gx-workspace"
        open={WORKSPACE_ITEMS.some((item) => item.to === path) || undefined}
      >
        <summary title="Stable workspace (optional)">
          <span className="gx-nav-icon gx-workspace-icon">
            <StableIcon />
          </span>
          <span className="gx-label gx-workspace-label">
            Stable workspace<small>Optional for owners &amp; teams</small>
          </span>
          <span className="gx-label gx-workspace-chevron" aria-hidden="true">
            <ChevronIcon />
          </span>
        </summary>
        <div className="gx-workspace-body">
          {stables.length > 0 && (
            <label className="gx-label gx-stable-select">
              <span>Stable</span>
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
              className={itemClass}
              to={item.to}
              aria-label={navBadge[item.to] ? `${item.label} (${navBadge[item.to]} unread)` : item.label}
              title={item.label}
              onClick={closeMenu}
            >
              <span className="gx-nav-icon">{item.icon}</span>
              <span className="gx-label">{item.label}</span>
              {badge(navBadge[item.to])}
            </NavLink>
          ))}
        </div>
      </details>
      <div className="gx-nav-group">
        <span className="gx-label">Support</span>
      </div>
      <NavLink
        className={itemClass}
        to="/updates"
        aria-label={
          unreadCount
            ? `Updates (${unreadCount} new ${unreadCount === 1 ? "post" : "posts"})`
            : "Updates"
        }
        title="Updates: releases, news & notices"
        onClick={closeMenu}
      >
        <span className="gx-nav-icon"><UpdatesIcon /></span>
        <span className="gx-label">Updates</span>
        {badge(unreadCount)}
      </NavLink>
      <NavLink
        className={itemClass}
        to="/subscription"
        aria-label="Subscription"
        title="Subscription"
        onClick={closeMenu}
      >
        <span className="gx-nav-icon"><SubscriptionIcon /></span>
        <span className="gx-label">Subscription</span>
      </NavLink>
      {canUse(user, "admin") && (
        <>
          <NavLink
            className={itemClass}
            to="/admin/racing"
            aria-label="Publish racing"
            title="Publish racing"
            onClick={closeMenu}
          >
            <span className="gx-nav-icon"><EntriesIcon /></span>
            <span className="gx-label">Publish racing</span>
          </NavLink>
          <NavLink
            className={itemClass}
            to="/administration"
            aria-label="Administration"
            title="Administration"
            onClick={closeMenu}
          >
            <span className="gx-nav-icon"><StatsIcon /></span>
            <span className="gx-label">Administration</span>
          </NavLink>
        </>
      )}
      <NavLink
        className={itemClass}
        to="/faq"
        aria-label="Help & FAQ"
        title="Help & FAQ"
        onClick={closeMenu}
      >
        <span className="gx-nav-icon"><HelpIcon /></span>
        <span className="gx-label">Help &amp; FAQ</span>
      </NavLink>
    </nav>
  );

  const showTabbar = !CHAT_THREAD(path);
  const isApp = APP_PAGE(path);

  return (
    <div
      data-theme={isDark ? "dark" : "light"}
      className={[
        "gx-shell",
        collapsed && "is-collapsed",
        PP_PAGE(path) && "ws-pp-page",
        showTabbar && "has-tabbar",
        isApp && "is-app-page",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Ambient light: soft colour fields and a faint data grid behind the glass. */}
      <div className="gx-ambient" aria-hidden="true">
        <span className="gx-orb gx-orb-a" />
        <span className="gx-orb gx-orb-b" />
        <span className="gx-orb gx-orb-c" />
        <span className="gx-grid" />
      </div>

      <a className="gx-skip" href="#workspace-content">
        Skip to content
      </a>

      <div className="gx-progress" key={pageKey(path)} aria-hidden="true" />

      <header className={`gx-header gx-glass${scrolled ? " is-scrolled" : ""}${searchOpen ? " is-searching" : ""}`}>
        <button
          type="button"
          className="gx-icon-btn gx-mobile-only"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <MenuIcon />
        </button>
        {!OWN_BACK(path) && <BackButton iconOnly className="gx-mobile-back gx-mobile-only" />}
        <Link className="gx-brand" to="/dashboard" aria-label="Stayblz overview">
          <span className="gx-brand-mark">
            <Brand />
          </span>
          <span className="gx-brand-text">
            STAYBLZ<small>THE RACING LEDGER</small>
          </span>
          <em className="gx-version" title={VERSION_TITLE}>
            {VERSION_LABEL}
          </em>
        </Link>

        <form
          id="gx-search"
          className={`gx-search${searchOpen ? " is-open" : ""}`}
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setSearchOpen(false);
            searchRef.current?.blur();
            navigate(
              `/dashboard${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`,
            );
          }}
        >
          <span className="gx-search-icon">
            <SearchIcon />
          </span>
          <input
            ref={searchRef}
            aria-label="Search racing records"
            aria-keyshortcuts="/"
            placeholder="Search horses, races, people…"
            title="Search (shortcut: /)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchOpen(false);
                e.currentTarget.blur();
              }
            }}
            type="search"
            maxLength={120}
            enterKeyHint="search"
          />
          <kbd className="gx-kbd" aria-hidden="true">/</kbd>
          <button type="submit" className="gx-search-go">
            Search
          </button>
        </form>

        <div className="gx-actions">
          <button
            type="button"
            className="gx-icon-btn gx-mobile-only"
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            aria-controls="gx-search"
            onClick={() => setSearchOpen((v) => !v)}
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            className="gx-icon-btn gx-hide-sm"
            onClick={share}
            aria-label="Share overview"
            title="Share overview"
          >
            <ShareIcon />
          </button>
          <button
            type="button"
            className="gx-icon-btn"
            onClick={() => setCart(true)}
            aria-label={
              cartItems.length
                ? `Shopping cart (${cartItems.length} selections)`
                : "Shopping cart"
            }
            title="Shopping cart"
          >
            <CartIcon />
            {cartItems.length > 0 && (
              <span className="gx-dot-count" aria-hidden="true">
                {countLabel(cartItems.length)}
              </span>
            )}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            className="gx-theme"
            onClick={toggleTheme}
            aria-label="Dark mode"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <span className="gx-theme-track" aria-hidden="true">
              <SunIcon />
              <MoonIcon />
            </span>
            <span className="gx-theme-knob" aria-hidden="true">
              {isDark ? <MoonIcon /> : <SunIcon />}
            </span>
          </button>
          <Link to="/account" className="gx-account gx-hide-sm" aria-label="Your account">
            <span className="gx-avatar">{initialsOf(user?.displayName)}</span>
            <span className="gx-account-text">
              {user?.displayName}
              <small>My account</small>
            </span>
          </Link>
        </div>
      </header>

      <aside className="gx-sidebar gx-glass" aria-label="Workspace navigation">
        {/* Collapse control lives in the sidebar's own header row, aligned with the menu. */}
        <div className="gx-side-head">
          <span className="gx-label gx-side-title">
            <span className="gx-side-led" aria-hidden="true" />
            Navigation
          </span>
          <button
            type="button"
            className="gx-collapse"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-keyshortcuts="["
            title={`${collapsed ? "Expand" : "Collapse"} sidebar  [`}
          >
            <SidebarIcon />
          </button>
        </div>
        <div className="gx-side-scroll">{navigation}</div>
        <div className="gx-side-bottom">
          <button
            type="button"
            className="gx-nav-item gx-logout"
            onClick={handleLogout}
            disabled={signingOut}
            title="Log out"
          >
            <span className="gx-nav-icon"><LogoutIcon /></span>
            <span className="gx-label">
              {signingOut ? "Signing out…" : "Log out"}
            </span>
          </button>
        </div>
        {/* The sidebar's edge: click anywhere along it to collapse or expand. */}
        <button
          type="button"
          className="gx-edge"
          tabIndex={-1}
          aria-hidden="true"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
        />
      </aside>

      {open && (
        <Modal label="Navigation" className="modal-drawer gx-drawer-modal" onClose={closeMenu}>
          <div className="gx-drawer" data-theme={isDark ? "dark" : "light"}>
            <DialogHead title="Menu" kicker="Stayblz" onClose={closeMenu} closeLabel="Close menu" />
            <Link to="/account" className="gx-drawer-account" onClick={closeMenu}>
              <span className="gx-avatar">{initialsOf(user?.displayName)}</span>
              <span className="gx-account-text">
                {user?.displayName ?? "Your account"}
                <small>View account &amp; security</small>
              </span>
            </Link>
            {navigation}
            <div className="gx-drawer-actions">
              <button type="button" className="gx-pill" onClick={share}>
                <ShareIcon /> Share
              </button>
              <button
                type="button"
                className="gx-pill gx-pill-danger"
                onClick={handleLogout}
                disabled={signingOut}
              >
                <LogoutIcon /> {signingOut ? "Signing out…" : "Log out"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <main
        id="workspace-content"
        className={`gx-main${isApp ? " is-app" : ""}`}
        tabIndex={-1}
      >
        {!isApp && <DevNotice />}
        {notice && (
          <p className="gx-alert gx-alert-info" role="status">
            {notice}
          </p>
        )}
        {logoutError && (
          <p className="gx-alert gx-alert-error" role="alert">
            {logoutError}
          </p>
        )}
        {user?.actingRole && (
          <p className="gx-alert gx-alert-role" role="status">
            <span>
              You're viewing Stayblz as <strong>{roleLabel(user.actingRole)}</strong>. Your{" "}
              {roleLabel(user.platformRole)} tools are hidden.
            </span>
            <Link to="/account/security">Switch view</Link>
          </p>
        )}
        <div
          className="gx-content"
          key={
            ["/workspace", "/inventory", "/tracker", "/team-messages"].includes(
              pageKey(path),
            )
              ? (stable?.id ?? "no-stable")
              : "personal"
          }
        >
          {/* A crash in one page keeps the menu working; changing page resets it.
              The wrapper replays a short entrance animation on every navigation. */}
          <ErrorBoundary key={pageKey(path)}>
            {!OWN_BACK(path) && !isApp && (
              <div className="gx-pagebar">
                <BackButton />
              </div>
            )}
            <div className="ws-page gx-page">
              <Outlet />
            </div>
          </ErrorBoundary>
        </div>
        {!isApp && (
          <footer className="gx-footer gx-glass">
            <span className="gx-footer-brand">
              <b>STAYBLZ</b>
              <span>Know the horse. Read the race.</span>
              <em>Development preview</em>
            </span>
            <span className="gx-footer-links">
              <Link to="/updates">Updates</Link>
              <Link to="/faq">Help &amp; FAQ</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/privacy">Privacy</Link>
            </span>
          </footer>
        )}
      </main>

      {showTabbar && (
        <nav className="gx-tabbar gx-glass" aria-label="Quick navigation">
          {MOBILE_TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to !== "/messages"}
              className={({ isActive }) => `gx-tab${isActive ? " active" : ""}`}
              aria-label={
                navBadge[tab.to] ? `${tab.label} (${navBadge[tab.to]} unread)` : tab.label
              }
            >
              <span className="gx-tab-icon">
                {tab.icon}
                {badge(navBadge[tab.to])}
              </span>
              <span className="gx-tab-label">{tab.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            className={`gx-tab${open ? " active" : ""}`}
            onClick={() => setOpen(true)}
            aria-label={unreadCount ? `Menu (${unreadCount} new updates)` : "Menu"}
          >
            <span className="gx-tab-icon">
              <MenuIcon />
              {badge(unreadCount)}
            </span>
            <span className="gx-tab-label">Menu</span>
          </button>
        </nav>
      )}

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