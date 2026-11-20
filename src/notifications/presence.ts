/**
 * Is this person using Stayblz right now? "active" while the page is in front and they've tapped, typed or used the
 * mouse wheel in the last few minutes; "idle" when the tab is hidden or nothing has happened for a while.
 * The chat polls send it as `presence=` so friends see Online / Away / Offline (backend lib/presence.ts).
 */
const IDLE_MS = 4 * 60_000;
let lastInput = Date.now();
let started = false;
let last: "active" | "idle" = "active";
const listeners = new Set<() => void>();

export type PresenceState = "active" | "idle";
export const presenceState = (): PresenceState => (document.hidden || Date.now() - lastInput > IDLE_MS ? "idle" : "active");

function check() {
  const now = presenceState();
  if (now === last) return;
  last = now;
  for (const fn of listeners) fn();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const input = () => {
    lastInput = Date.now();
    if (last === "idle") check();
  };
  // Real input only. Not "scroll": the chat scrolls itself to new messages, which would keep an idle person Online.
  for (const type of ["pointerdown", "keydown", "wheel", "touchstart"] as const)
    window.addEventListener(type, input, { passive: true, capture: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) lastInput = Date.now();
    check();
  });
  window.setInterval(check, 30_000);
}

/** Calls `fn` when you go idle or come back; returns the unsubscribe. */
export function onPresenceChange(fn: () => void) {
  start();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
