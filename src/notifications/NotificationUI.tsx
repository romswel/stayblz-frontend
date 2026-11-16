import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Modal from "../components/Modal";
import DialogHead from "../components/ui/DialogHead";
import { Avatar } from "../components/messenger/icons";
import { useNotifications, type AppAlert } from "./NotificationsContext";
import "./notifications.css";

const BellIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
const ago = (at: number) => {
  const m = Math.floor((Date.now() - at) / 60_000);
  return m < 1 ? "now" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
};

/** New-message cards in the corner while Stayblz is in front. Tap to open the chat; they leave on their own. */
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
    const t = window.setTimeout(() => closeRef.current(), 6500);
    return () => window.clearTimeout(t);
  }, [paused]);
  return (
    <div className="nt-toast" role="status" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <button type="button" className="nt-toast-main" onClick={onOpen}>
        <Avatar name={alert.title} id={alert.group ? null : alert.fromId} group={alert.group} size="md" />
        <span className="nt-toast-text">
          <strong>{alert.title}</strong>
          <span>{alert.body}</span>
        </span>
        <small className="nt-toast-kind">Stayblz Chat</small>
      </button>
      <button type="button" className="nt-toast-close" aria-label="Dismiss" onClick={onClose}>
        ×
      </button>
      <i className="nt-toast-timer" aria-hidden="true" />
    </div>
  );
}

/**
 * "Turn on notifications?" — asks once (again a week after "Not now"), a few seconds after you arrive, never
 * during a call. "Turn on" switches on the account setting and asks the browser for permission.
 */
export function NotificationPrompt() {
  const { shouldPrompt, enable, dismissPrompt, permission, pushState } = useNotifications();
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<"ask" | "busy" | "blocked" | "done">("ask");
  useEffect(() => {
    if (!shouldPrompt) return;
    const t = window.setTimeout(() => setReady(true), 3500);
    return () => window.clearTimeout(t);
  }, [shouldPrompt]);
  const inCall = /^\/paddock\/[a-z]{4}-[a-z]{4}$/.test(pathname);
  if (!ready || inCall || (!shouldPrompt && step === "ask")) return null;
  const close = () => {
    setReady(false);
    if (step === "ask") dismissPrompt();
  };
  const unsupported = permission === "unsupported";

  return (
    <Modal label="Turn on notifications" onClose={close} className="modal-sm nt-prompt gx-layer">
      <DialogHead kicker="Stayblz" title={step === "done" ? "Notifications are on" : step === "blocked" ? "Your browser said no" : "Turn on notifications?"} onClose={close} />
      <div className="dlg">
        <div className="nt-prompt-art" aria-hidden="true">
          <span className="nt-bell">
            <BellIcon size={30} />
          </span>
        </div>
        {step === "done" ? (
          <p className="dlg-text">
            You'll get a heads-up when someone messages you on Stayblz Chat
            {pushState === "on" ? ", even when Stayblz is closed on this device." : " while Stayblz is open in any tab."} Change it any time in{" "}
            <Link to="/account/notifications" onClick={() => setReady(false)}>
              Notification settings
            </Link>
            .
          </p>
        ) : step === "blocked" ? (
          <p className="dlg-text">
            Notifications are on for your account, but this browser blocked them for Stayblz, so you'll only see alerts
            while Stayblz is in front. To allow them, open the site settings (the lock or tune icon by the address)
            and set Notifications to Allow.
          </p>
        ) : (
          <div className="dlg-text">
            <p>Get a heads-up when someone messages you on Stayblz Chat — even when you're on another page or tab.</p>
            {unsupported && (
              <p>
                This browser can't show system notifications here. We'll show alerts inside Stayblz while it's open.
                On iPhone, add Stayblz to your Home Screen to get notifications.
              </p>
            )}
            <p className="nt-small">You choose what's included (message text, sounds, requests) in Notification settings. Mute any chat from its menu.</p>
          </div>
        )}
        <div className="dlg-actions">
          {step === "done" || step === "blocked" ? (
            <button type="button" className="btn btn-primary" onClick={() => setReady(false)}>
              Got it
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-quiet" onClick={close} disabled={step === "busy"}>
                Not now
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={step === "busy"}
                onClick={async () => {
                  setStep("busy");
                  try {
                    const answer = await enable();
                    setStep(answer === "denied" ? "blocked" : "done");
                  } catch {
                    setStep("ask");
                  }
                }}
              >
                {step === "busy" ? "Turning on…" : "Turn on"}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Header bell: recent alerts on this device, a quick "turn on", and the way to Notification settings. */
export function NotificationBell() {
  const { settings, recent, openAlert, enable, counts } = useNotifications();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const unread = counts.personal + counts.requests + counts.team;
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
  const off = settings && !settings.enabled;
  return (
    <div className="nt-bell-wrap">
      <button
        ref={button}
        type="button"
        className="gx-icon-btn"
        aria-label={`Notifications${unread ? ` (${unread} unread chats)` : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {off ? <span className="nt-off-dot" aria-hidden="true" /> : unread > 0 && <span className="gx-dot-count" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div ref={box} className="nt-panel" role="dialog" aria-label="Notifications">
          <div className="nt-panel-head">
            <strong>Notifications</strong>
            <Link to="/account/notifications">Settings</Link>
          </div>
          {off && (
            <div className="nt-panel-off">
              <p>Notifications are off. Turn them on to hear about new messages.</p>
              <button type="button" className="btn btn-primary" onClick={() => void enable().catch(() => undefined)}>
                Turn on
              </button>
            </div>
          )}
          {unread > 0 && (
            <Link className="nt-panel-row is-summary" to="/messages">
              <span className="nt-panel-icon" aria-hidden="true">💬</span>
              <span>
                <strong>
                  {unread} unread {unread === 1 ? "chat" : "chats"}
                </strong>
                <small>Open Stayblz Chat</small>
              </span>
            </Link>
          )}
          {recent.length ? (
            <ul className="nt-panel-list" aria-label="Recent alerts on this device">
              {recent.map((a) => (
                <li key={a.id}>
                  <button type="button" className="nt-panel-row" onClick={() => openAlert(a)}>
                    <Avatar name={a.title} id={a.group ? null : a.fromId} group={a.group} size="sm" />
                    <span>
                      <strong>{a.title}</strong>
                      <small>{a.body}</small>
                    </span>
                    <em>{ago(a.at)}</em>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !unread && <p className="nt-panel-empty">You're all caught up. New message alerts show here while Stayblz is open.</p>
          )}
        </div>
      )}
    </div>
  );
}
