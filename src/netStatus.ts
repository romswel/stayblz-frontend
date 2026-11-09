// Shared, app-wide view of the connection: offline, slow requests, server unreachable.
// api.ts reports into it; ConnectionNotice shows it. No React state lives here.

export interface NetState {
  offline: boolean;
  /** Requests still waiting after SLOW_AFTER_MS. */
  slow: number;
  /** The last request could not reach Stayblz or the server was down/starting. */
  unreachable: boolean;
}

export const SLOW_AFTER_MS = 8000;
let state: NetState = {
  offline: typeof navigator !== "undefined" && navigator.onLine === false,
  slow: 0,
  unreachable: false,
};
const listeners = new Set<() => void>();
function set(next: Partial<NetState>) {
  state = { ...state, ...next };
  listeners.forEach((notify) => notify());
}

export const netStatus = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Call when a request starts; call the returned function when it settles. */
  track(): () => void {
    let slow = false;
    const timer = window.setTimeout(() => {
      slow = true;
      set({ slow: state.slow + 1 });
    }, SLOW_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
      if (slow) set({ slow: Math.max(0, state.slow - 1) });
    };
  },
  reachable: () => state.unreachable && set({ unreachable: false }),
  unreachable: () => !state.unreachable && set({ unreachable: true }),
};

if (typeof window !== "undefined") {
  window.addEventListener("online", () => set({ offline: false }));
  window.addEventListener("offline", () => set({ offline: true }));
}
