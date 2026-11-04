import { NavLink } from "react-router-dom";
import "./section-nav.css";

export interface SectionLink {
  to: string;
  label: string;
}

export default function SectionNav({
  label,
  links,
  linkState,
}: {
  label: string;
  links: SectionLink[];
  linkState?: Record<string, string>;
}) {
  return (
    <nav className="section-nav" aria-label={label}>
      {links.map((link) => (
        <NavLink key={link.to} to={link.to} end state={linkState}>
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
