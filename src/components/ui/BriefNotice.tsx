import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
// The glass tokens (--gx-*) for `.gx-layer`, also on public pages that don't load the app shell.
import "../layout-glass.css";
import "./brief-notice.css";

const readAt = (key: string) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};
const markShown = (key: string) => {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* Storage blocked: it may show again next visit, which is harmless. */
  }
};

/**
 * A small heads-up that slides in at the bottom corner for a few seconds and goes away by itself — for things
 * people should know once in a while (the development preview, chat on the free plan), not a banner that sits on
 * every page. Shown at most once every `everyDays` days on this device; hovering or focusing it keeps it open;
 * the × closes it now. Rendered on <body> with the glass tokens (`gx-layer`).
 */
export default function BriefNotice({
  storageKey,
  everyDays,
  seconds = 9,
  icon,
  title,
  children,
}: {
  storageKey: string;
  everyDays: number;
  seconds?: number;
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => Date.now() - readAt(storageKey) > everyDays * 86_400_000);
  const [leaving, setLeaving] = useState(false);
  const held = useRef(false);
  const timer = useRef(0);

  const close = () => {
    setLeaving(true);
    window.setTimeout(() => setOpen(false), 220);
  };
  const start = (ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => !held.current && close(), ms);
  };
  useEffect(() => {
    if (!open) return;
    markShown(storageKey);
    start(seconds * 1000);
    return () => window.clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const hold = () => {
    held.current = true;
    window.clearTimeout(timer.current);
  };
  const release = () => {
    held.current = false;
    start(3500);
  };
  return createPortal(
    <div
      className={`brief-notice gx-layer${leaving ? " is-leaving" : ""}`}
      // A note, not a live "status": it must never compete with a page's own status messages ("Profile saved.").
      role="note"
      aria-label={title.replace(/\.$/, "")}
      onPointerEnter={hold}
      onPointerLeave={release}
      onFocus={hold}
      onBlur={release}
    >
      {icon && <span className="brief-notice-icon" aria-hidden="true">{icon}</span>}
      <p>
        <strong>{title}</strong> {children}
      </p>
      <button type="button" className="brief-notice-close" aria-label="Dismiss" onClick={close}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <span className="brief-notice-timer" style={{ animationDuration: `${seconds}s` }} aria-hidden="true" />
    </div>,
    document.body,
  );
}
