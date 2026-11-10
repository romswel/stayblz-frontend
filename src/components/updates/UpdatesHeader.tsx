import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../../auth";
import { canUse } from "../account/roles";
import { useUpdates } from "./UpdatesContext";

const GearIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

/** Small "Updates settings" menu: the pop-up preference for everyone, and the admin tools for admins. */
function UpdatesSettings({ admin }: { admin: boolean }) {
  const { popupOn, setPopup } = useUpdates();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="up-settings" ref={root}>
      <button
        ref={button}
        type="button"
        className="btn btn-quiet up-settings-button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <GearIcon />
        Settings
      </button>
      {open && (
        <div className="up-settings-panel" id={panelId} role="group" aria-label="Updates settings">
          <span className="up-settings-label">Your settings</span>
          <label className="acct-toggle">
            <input type="checkbox" checked={popupOn} onChange={(e) => void setPopup(e.target.checked)} />
            <span>
              Pop-up for new posts
              <small>Show the newest post once when you sign in.</small>
            </span>
          </label>
          {admin && (
            <>
              <span className="up-settings-label">Admin</span>
              <Link className="up-settings-link" to="/updates/manage" onClick={() => setOpen(false)}>
                Manage posts <span aria-hidden="true">→</span>
              </Link>
              <Link className="up-settings-link" to="/updates/manage/new" onClick={() => setOpen(false)}>
                Write a new post <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Header shared by the Updates feed and the admin "Manage posts" view, so both live in one
 * place (one menu entry). Admins get a Feed / Manage posts switch under the title.
 */
export default function UpdatesHeader({ manage = false }: { manage?: boolean }) {
  const { user } = useAuth();
  const admin = canUse(user, "admin");
  return (
    <>
      <header className="up-hero">
        <div>
          <div className="eyebrow">{manage ? "Updates · Admin" : "Releases, news & notices"}</div>
          <h1>{manage ? "Manage posts" : "Updates"}</h1>
          <p className="sub">
            {manage
              ? "Write release notes, announcements, news, maintenance notices and events. Published posts appear on the feed and can pop up once for each member."
              : "What's new on Stayblz, what we fixed, and anything you should know, newest first."}
          </p>
        </div>
        <div className="up-hero-actions">
          <UpdatesSettings admin={admin} />
          {admin && (
            <Link className="btn btn-primary" to="/updates/manage/new">
              Write a post
            </Link>
          )}
        </div>
      </header>
      {admin && (
        <nav className="up-tabs" aria-label="Updates sections">
          <NavLink to="/updates" end className="up-tab">
            Feed
          </NavLink>
          <NavLink to="/updates/manage" className="up-tab">
            Manage posts
          </NavLink>
        </nav>
      )}
    </>
  );
}
