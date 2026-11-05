import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ppNavigationGroups, ppProducts } from "./catalog";
import "./pps.css";

export default function PPNavigation({
  onNavigate,
  onExpand,
  collapsed,
}: {
  onNavigate: () => void;
  onExpand: () => void;
  collapsed: boolean;
}) {
  const { pathname } = useLocation();
  const active = pathname === "/pps" || pathname.startsWith("/pps/");
  const [open, setOpen] = useState(active);
  const id = useId();
  const children = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = children.current;
    const selected = container?.querySelector<HTMLElement>("a.active");
    if (!open || !container?.clientHeight || !selected) return;
    const bounds = container.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    if (item.bottom > bounds.bottom)
      container.scrollTop += item.bottom - bounds.bottom + 8;
    else if (item.top < bounds.top)
      container.scrollTop -= bounds.top - item.top + 8;
  }, [pathname, open]);
  useEffect(() => {
    if (active) setOpen(true);
  }, [pathname, active]);
  const link = (to: string, label: string) => (
    <NavLink
      key={to}
      end={!ppProducts.some((product) => to === `/pps/${product.id}`)}
      to={to}
      className="pp-nav-link"
      onClick={onNavigate}
    >
      {label}
    </NavLink>
  );
  return (
    <div className="pp-nav">
      <div className={`pp-nav-row${active ? " active" : ""}`}>
        <NavLink
          className="ws-nav-item pp-nav-home"
          to="/pps"
          end
          aria-label="Past performances (PPs)"
          title="Past performances (PPs)"
          onClick={onNavigate}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M5 3h10l4 4v14H5Z" />
            <path d="M14 3v5h5M8 12h8M8 16h8" />
          </svg>
          <span>Past performances</span>
        </NavLink>
        <button
          className="pp-nav-toggle"
          aria-label="Toggle PP menu"
          title="Expand or collapse PP menu"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            onExpand();
            setOpen((value) => collapsed || !value);
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      <div id={id} className="pp-nav-children" hidden={!open} ref={children}>
        {link("/pps", "PPs overview")}
        {ppNavigationGroups.map((group) => (
          <div key={group.label}>
            <p className="pp-nav-heading">{group.label}</p>
            {group.links.map((item) => link(item.to, item.label))}
          </div>
        ))}
      </div>
    </div>
  );
}
