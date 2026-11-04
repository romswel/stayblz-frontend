import { useEffect, useLayoutEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ppNavigationGroups } from "./catalog";

export default function PPPageNav() {
  const { pathname, search } = useLocation();
  const nav = useRef<HTMLElement>(null);
  const closeMenus = () => {
    nav.current
      ?.querySelectorAll("details[open]")
      .forEach((menu) => menu.removeAttribute("open"));
  };
  useLayoutEffect(closeMenus, [pathname, search]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !nav.current?.contains(event.target))
        closeMenus();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const origin = { ppFrom: pathname + search };
  return (
    <nav
      className="pp-page-nav"
      aria-label="PP pages"
      ref={nav}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          const menu = (event.target as HTMLElement).closest("details");
          closeMenus();
          menu?.querySelector("summary")?.focus();
        }
      }}
    >
      <NavLink className="pp-overview-link" to="/pps" end state={origin}>
        PP overview
      </NavLink>
      {ppNavigationGroups.map((group) => {
        const current = group.links.find(
          (link) => pathname === link.to || pathname.startsWith(link.to + "/"),
        );
        return (
          <details
            className="pp-page-menu"
            key={group.label}
            onToggle={(event) => {
              if (event.currentTarget.open) {
                nav.current
                  ?.querySelectorAll("details[open]")
                  .forEach((menu) => {
                    if (menu !== event.currentTarget)
                      menu.removeAttribute("open");
                  });
              }
            }}
          >
            <summary className={current ? "is-current" : ""}>
              {group.label}
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
              {current && (
                <span
                  className="pp-current-marker"
                  aria-label="Contains current page"
                />
              )}
            </summary>
            <div className="pp-page-menu-panel">
              <span className="pp-page-menu-heading">
                {group.label === "More" ? "PP tools" : `${group.label} reports`}
              </span>
              {group.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end
                  state={origin}
                  onClick={closeMenus}
                >
                  <span>{link.shortLabel}</span>
                  <span aria-hidden="true">
                    {pathname === link.to ? <>&#10003;</> : <>&#8594;</>}
                  </span>
                </NavLink>
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
