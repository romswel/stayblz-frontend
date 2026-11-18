import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Stayblz links in a message (a race, horse, profile, Update, Paddock meeting…) get a small card that
 * opens the page inside Stayblz. Only Stayblz's own addresses are recognised; nothing is fetched, so the
 * card never shows anything that isn't already in the message.
 */
type Kind = { label: string; action: string; icon: ReactNode };

const svg = (children: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const ICONS = {
  race: svg(<><path d="M4 5h16v14H4z" /><path d="M4 10h16M9 5v14" /></>),
  horse: svg(<path d="M6 20c1-6 4-7 6-11l-5 2-1.5-2.5L11 3.5l1-3 4 4c5 3 6.5 9 6 15.5z" />),
  person: svg(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1-4 3.8-6 7-6s6 2 7 6" /></>),
  update: svg(<><path d="M4 10v4h3l7 4.5v-13L7 10z" /><path d="M17.5 8.5a5 5 0 0 1 0 7" /></>),
  paddock: svg(<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>),
  post: svg(<><path d="M5 4h14v12H9l-4 4z" /><path d="M9 9h6M9 12h4" /></>),
  page: svg(<><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /></>),
};

const ROUTES: { pattern: RegExp; kind: Kind }[] = [
  { pattern: /^\/racing\/races\/[0-9a-f-]{36}$/, kind: { label: "Race", action: "Open race", icon: ICONS.race } },
  { pattern: /^\/racing\/days\/[0-9a-f-]{36}$/, kind: { label: "Race day", action: "Open racecard", icon: ICONS.race } },
  { pattern: /^\/racing\/horses\/[0-9a-f-]{36}$/, kind: { label: "Horse", action: "Open horse", icon: ICONS.horse } },
  { pattern: /^\/racing\/people\/[0-9a-f-]{36}$/, kind: { label: "Rider or trainer", action: "Open profile", icon: ICONS.person } },
  { pattern: /^\/community\/horses\/[^/]+$/, kind: { label: "Horse profile", action: "Open horse", icon: ICONS.horse } },
  { pattern: /^\/community\/people\/[^/]+$/, kind: { label: "Member profile", action: "Open profile", icon: ICONS.person } },
  { pattern: /^\/community\/posts\/[^/]+$/, kind: { label: "Community post", action: "Open post", icon: ICONS.post } },
  { pattern: /^\/updates\/[a-z0-9-]+$/, kind: { label: "Stayblz Update", action: "Read post", icon: ICONS.update } },
  { pattern: /^\/paddock\/[a-z]{4}-[a-z]{4}$/, kind: { label: "Paddock meeting", action: "Join", icon: ICONS.paddock } },
  { pattern: /^\/(entries|results|workouts|stakes|statistics|marketplace|tv)$/, kind: { label: "Stayblz page", action: "Open", icon: ICONS.page } },
];

/** Hosts whose links are Stayblz's own: this site, and the production address. */
const OWN_HOSTS = () => new Set([window.location.host, "stayblz-app.com", "www.stayblz-app.com"]);
const URLS = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

export function stayblzLinks(text: string): { path: string; kind: Kind }[] {
  const hosts = OWN_HOSTS();
  const found = new Map<string, Kind>();
  for (const match of text.matchAll(URLS)) {
    let url: URL;
    try {
      url = new URL(match[0]);
    } catch {
      continue;
    }
    if (!hosts.has(url.host)) continue;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const route = ROUTES.find((r) => r.pattern.test(path));
    const key = path + url.search;
    if (route && !found.has(key)) found.set(key, route.kind);
    if (found.size >= 3) break;
  }
  return [...found].map(([path, kind]) => ({ path, kind }));
}

export default function LinkCards({ text }: { text: string }) {
  const links = stayblzLinks(text);
  if (!links.length) return null;
  return (
    <span className="mx-linkcards">
      {links.map(({ path, kind }) => (
        <Link key={path} to={path} className="mx-linkcard">
          <span className="mx-linkcard-icon">{kind.icon}</span>
          <span className="mx-linkcard-text">
            <small>{kind.label}</small>
            <span>{path}</span>
          </span>
          <span className="mx-linkcard-go">{kind.action}</span>
        </Link>
      ))}
    </span>
  );
}
