import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { COMPARE_MAX, readCompare, writeCompare } from "./api";

/** The compare tray (up to three stallions), shared by every Stallions page in this browser. */
export function useCompare() {
  const [ids, setIds] = useState<string[]>(readCompare);
  useEffect(() => {
    const sync = () => setIds(readCompare());
    window.addEventListener("stallions-compare", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("stallions-compare", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const toggle = (id: string) => {
    const now = readCompare();
    const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id].slice(-COMPARE_MAX);
    writeCompare(next);
    setIds(next);
  };
  const clear = () => {
    writeCompare([]);
    setIds([]);
  };
  return { ids, toggle, clear, full: ids.length >= COMPARE_MAX };
}

const TABS = [
  { to: "/stallions", label: "Directory", end: true, signedIn: false },
  { to: "/stallions/mating", label: "Mating check", end: false, signedIn: false },
  { to: "/stallions/compare", label: "Compare", end: false, signedIn: false },
  { to: "/stallions/manage", label: "My stallions", end: false, signedIn: true },
  { to: "/stallions/requests", label: "Requests", end: false, signedIn: true },
  { to: "/stallions/mares", label: "My mares", end: false, signedIn: true },
];

/**
 * Header for every Stayblz Stallions page: title, a short line, page actions and one compact section switch
 * (the feature's tools live here, not in the sidebar).
 */
export default function StallionsNav({
  title,
  kicker = "Stayblz Stallions",
  lead,
  actions,
  signedIn,
}: {
  title: ReactNode;
  kicker?: string;
  lead?: ReactNode;
  actions?: ReactNode;
  signedIn: boolean;
}) {
  const { ids } = useCompare();
  const tabs = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // On phones the switch scrolls sideways: keep the current section in view.
  useEffect(() => {
    const on = tabs.current?.querySelector<HTMLElement>(".st-tab.is-on");
    const box = tabs.current;
    if (on && box && box.scrollWidth > box.clientWidth) box.scrollLeft = on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2;
  }, [pathname]);
  return (
    <header className="st-head">
      <div className="st-head-row">
        <div className="st-head-text">
          <span className="st-kicker">{kicker}</span>
          <h1>{title}</h1>
          {lead && <p>{lead}</p>}
        </div>
        {actions && <div className="st-head-actions">{actions}</div>}
      </div>
      <nav ref={tabs} className="st-tabs" aria-label="Stayblz Stallions">
        {TABS.filter((t) => signedIn || !t.signedIn).map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `st-tab${isActive ? " is-on" : ""}`}>
            {t.label}
            {t.to === "/stallions/compare" && ids.length > 0 && <span className="st-tab-count">{ids.length}</span>}
          </NavLink>
        ))}
        {!signedIn && (
          <Link to="/signup" className="st-tab st-tab-cta">
            List your stallion
          </Link>
        )}
      </nav>
    </header>
  );
}

/** The plain-words notice under every directory and stallion page (boss: "a disclaimer for the market place"). */
export function StallionsDisclaimer() {
  return (
    <p className="st-disclaimer">
      Stayblz connects stallion owners and breeders and isn't part of any booking. Owners write their own pages: Stayblz
      doesn't check fees, race records, fertility, genetic results or registration. Confirm them with the owner, the
      breed registry and your vet before you book. Figures marked "Stayblz racing data" come from race results we
      publish and only cover the tracks we carry. <Link to="/legal">Terms of Use</Link>
    </p>
  );
}
