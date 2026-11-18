import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { API_BASE } from "../api";
import { Avatar } from "../components/messenger/icons";
import { useNotifications, type AppAlert } from "./NotificationsContext";
import NotificationSetup from "./NotificationSetup";
import "./notifications.css";

const BellIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
const ago = (at: number) => {
  const m = Math.floor((Date.now() - at) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
};
const KIND_LABEL: Record<AppAlert["kind"], string> = { chat: "Stayblz Chat", call: "Stayblz Paddock", meeting: "Stayblz Paddock" };

/** The face of who it's from, with a small badge for what happened (🎉, @, ↩…). */
function AlertFace({ alert, size }: { alert: AppAlert; size: "sm" | "md" }) {
  return (
    <span className="nt-face">
      <Avatar name={alert.fromName ?? alert.title} id={alert.group ? null : alert.fromId} group={alert.group} size={size} />
      {alert.badge && (
        <span className={`nt-face-badge${alert.alertKind === "reaction" ? " is-emoji" : ""}`} aria-hidden="true">
          {alert.badge}
        </span>
      )}
    </span>
  );
}

/** A photo message's picture; hidden quietly if it can't load. */
function AlertPicture({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img className="nt-pic" src={src.startsWith("/api/") ? API_BASE + src : src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

/** Cards in the corner while Stayblz is in front. Tap to open; they leave on their own (hover pauses). */
export function NotificationToasts() {
  const { toasts, dismiss, openAlert } = useNotifications();
  return (
    <div className="nt-stack gx-layer" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <ToastCard key={t.id} alert={t} onOpen={() => openAlert(t)} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastCard({ alert, onOpen, onClose }: { alert: AppAlert; onOpen: () => void; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => closeRef.current(), 7000);
    return () => window.clearTimeout(t);
  }, [paused]);
  return (
    <div
      className={`nt-toast is-${alert.kind}${alert.alertKind ? ` is-${alert.alertKind}` : ""}`}
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <button type="button" className="nt-toast-main" onClick={onOpen}>
        <AlertFace alert={alert} size="md" />
        <span className="nt-toast-text">
          <small className="nt-toast-kind">
            {KIND_LABEL[alert.kind]} · now
          </small>
          <strong>{alert.title}</strong>
          <span>{alert.body}</span>
        </span>
        {alert.image && <AlertPicture src={alert.image} />}
      </button>
      <button type="button" className="nt-toast-close" aria-label="Dismiss" onClick={onClose}>
        ×
      </button>
      <i className="nt-toast-timer" aria-hidden="true" />
    </div>
  );
}

/**
 * The set-up guide: opens by itself a few seconds after you arrive when this device isn't set up yet (first time,
 * a new phone, an iPhone in the browser), never during a call; "Not now" waits a week. Also opens from the bell,
 * Notification settings and "Finish your profile".
 */
export function NotificationPrompt() {
  const { shouldPrompt, dismissPrompt, setupOpen, openSetup, closeSetup } = useNotifications();
  const { pathname } = useLocation();
  const [auto, setAuto] = useState(false);
  const inCall = /^\/paddock\/[a-z]{4}-[a-z]{4}$/.test(pathname);
  const quiet = inCall || pathname === "/welcome";
  useEffect(() => {
    if (!shouldPrompt || quiet || setupOpen) return;
    const t = window.setTimeout(() => {
      setAuto(true);
      openSetup();
    }, 3500);
    return () => window.clearTimeout(t);
  }, [shouldPrompt, quiet, setupOpen, openSetup]);
  if (!setupOpen) return null;
  return (
    <NotificationSetup
      auto={auto}
      onClose={(later) => {
        if (later) dismissPrompt();
        setAuto(false);
        closeSetup();
      }}
    />
  );
}

/** Header bell: your Stayblz alerts (saved, on every device), a way to set up this device, and settings. */
export function NotificationBell() {
  const { settings, bell, bellUnread, openAlert, openSetup, markAllRead, counts, deviceReady, pushState } = useNotifications();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const chats = counts.personal + counts.requests + counts.team;
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
  const off = !!settings && !settings.enabled;
  const deviceOff = !!settings?.enabled && !deviceReady && pushState !== "unsupported";
  const shown = bellUnread || 0;
  return (
    <div className="nt-bell-wrap">
      <button
        ref={button}
        type="button"
        className="gx-icon-btn"
        aria-label={`Notifications${shown ? ` (${shown} new)` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {shown > 0 ? (
          <span className="gx-dot-count" aria-hidden="true">
            {shown > 9 ? "9+" : shown}
          </span>
        ) : (
          (off || deviceOff) && <span className="nt-off-dot" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div ref={box} className="nt-panel" role="dialog" aria-label="Notifications">
          <div className="nt-panel-head">
            <strong>Notifications</strong>
            <span className="nt-panel-tools">
              {shown > 0 && (
                <button type="button" className="nt-text-btn" onClick={markAllRead}>
                  Mark all as read
                </button>
              )}
              <Link to="/account/notifications">Settings</Link>
            </span>
          </div>
          {(off || deviceOff) && (
            <div className="nt-panel-off">
              <p>
                {off
                  ? "Notifications are off, so you won't hear about new messages, mentions or calls."
                  : pushState === "needs-install"
                    ? "On iPhone, notifications need the Stayblz app on your Home Screen."
                    : "This device isn't set up for notifications yet."}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setOpen(false);
                  openSetup();
                }}
              >
                {off ? "Turn on" : "Set up this device"}
              </button>
            </div>
          )}
          {chats > 0 && (
            <Link className="nt-panel-row is-summary" to="/messages">
              <span className="nt-panel-icon" aria-hidden="true">
                💬
              </span>
              <span>
                <strong>
                  {chats} unread {chats === 1 ? "chat" : "chats"}
                </strong>
                <small>Open Stayblz Chat</small>
              </span>
            </Link>
          )}
          {bell.length ? (
            <ul className="nt-panel-list" aria-label="Recent notifications">
              {bell.map((a) => (
                <li key={a.id}>
                  <button type="button" className={`nt-panel-row${a.read ? "" : " is-unread"}`} onClick={() => openAlert(a)}>
                    <AlertFace alert={a} size="sm" />
                    <span>
                      <strong>{a.title}</strong>
                      <small>{a.body}</small>
                    </span>
                    {a.image ? <AlertPicture src={a.image} /> : <em>{ago(a.at)}</em>}
                    {!a.read && <i className="nt-unread-dot" aria-label="New" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !chats && <p className="nt-panel-empty">You're all caught up. Messages, mentions, reactions, requests, calls and meetings show here.</p>
          )}
        </div>
      )}
    </div>
  );
}
