import { useLocation, useNavigate } from "react-router-dom";

/** Where "Back" goes when there is no earlier page in this tab (opened from a link, a new tab, the home screen app). */
export function parentOf(pathname: string, signedIn = true): { to: string; label: string } {
  const home = signedIn ? { to: "/dashboard", label: "Overview" } : { to: "/", label: "Home" };
  if (/^\/updates\/manage\/.+/.test(pathname)) return { to: "/updates/manage", label: "Manage posts" };
  if (pathname.startsWith("/updates/")) return { to: "/updates", label: "Updates" };
  if (pathname.startsWith("/admin/racing/")) return { to: "/admin/racing", label: "Publish racing" };
  if (pathname.startsWith("/racing/")) return { to: "/entries", label: "Entries" };
  if (pathname.startsWith("/account/")) return { to: "/account", label: "My account" };
  if (pathname.startsWith("/pps/")) return { to: "/pps", label: "Past performances" };
  return home;
}

export const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

/**
 * A Back button for every page, so nobody gets stuck (phones and the installed app have no
 * browser back button). Goes to the previous page in this tab when there is one, otherwise to
 * the page above this one.
 */
export default function BackButton({
  className = "",
  signedIn = true,
  iconOnly = false,
  fallback,
}: {
  className?: string;
  signedIn?: boolean;
  iconOnly?: boolean;
  fallback?: { to: string; label: string };
}) {
  const navigate = useNavigate();
  const location = useLocation();
  // The router numbers its history entries (idx). 0 = the first Stayblz page in this tab, so
  // history.back() would leave the site. Redirects replace the entry and keep idx at 0.
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  const hasHistory = typeof idx === "number" ? idx > 0 : location.key !== "default";
  const parent = fallback ?? parentOf(location.pathname, signedIn);
  const label = hasHistory ? "Back" : `Back to ${parent.label}`;
  return (
    <button
      type="button"
      className={`sb-back${iconOnly ? " is-icon" : ""}${className ? ` ${className}` : ""}`}
      onClick={() => (hasHistory ? navigate(-1) : navigate(parent.to))}
      aria-label={label}
      title={label}
    >
      <BackIcon />
      {!iconOnly && <span>{hasHistory ? "Back" : parent.label}</span>}
    </button>
  );
}
