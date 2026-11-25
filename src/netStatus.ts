// Shared, app-wide view of the connection: offline, slow requests, server unreachable.
// api.ts reports into it; ConnectionNotice shows it. No React state lives here.

export interface NetState {
  offline: boolean;
  /** Requests still waiting after SLOW_AFTER_MS. */
  slow: number;
  /** The last request could not reach Stayblz or the server was down/starting. */
  unreachable: boolean;
  /** When the server stopped answering (ms), or 0. */
  downSince: number;
  /** When it answered again after being down (ms), or 0: "Back online" shows for a moment. */
  backAt: number;
}

export const SLOW_AFTER_MS = 8000;
/** "Back online" only after an outage people could notice, not after a one-request blip. */
const BACK_AFTER_DOWN_MS = 4000;
let state: NetState = {
  offline: typeof navigator !== "undefined" && navigator.onLine === false,
  slow: 0,
  unreachable: false,
  downSince: 0,
  backAt: 0,
};
const listeners = new Set<() => void>();
function set(next: Partial<NetState>) {
  state = { ...state, ...next };
  listeners.forEach((notify) => notify());
}

// While the server isn't answering, ask /api/health now and then (15 s, growing to 60 s; paused while the tab is
// hidden), so the notice can say "Back online" by itself instead of leaving people to guess.
let recheck: number | undefined;
let delay = 15_000;
function healthUrl() {
  const base = import.meta.env.PROD ? "" : (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
  return `${base}/api/health`;
}
async function checkNow(): Promise<boolean> {
  try {
    const stop = new AbortController();
    const timer = window.setTimeout(() => stop.abort(), 10_000);
    const res = await fetch(healthUrl(), { cache: "no-store", credentials: "omit", signal: stop.signal }).finally(() =>
      window.clearTimeout(timer),
    );
    const data = res.ok ? await res.json().catch(() => null) : null;
    if (data?.ok === true) {
      netStatus.reachable();
      return true;
    }
  } catch {
    /* still down */
  }
  return false;
}
function schedule() {
  window.clearTimeout(recheck);
  if (!state.unreachable) return;
  recheck = window.setTimeout(async () => {
    if (document.visibilityState === "hidden" || state.offline) return schedule();
    if (!(await checkNow())) {
      delay = Math.min(60_000, Math.round(delay * 1.5));
      schedule();
    }
  }, delay);
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
  reachable: () => {
    if (!state.unreachable) return;
    window.clearTimeout(recheck);
    delay = 15_000;
    const noticed = Date.now() - state.downSince >= BACK_AFTER_DOWN_MS;
    set({ unreachable: false, downSince: 0, backAt: noticed ? Date.now() : 0 });
  },
  unreachable: () => {
    if (state.unreachable) return;
    set({ unreachable: true, downSince: Date.now(), backAt: 0 });
    schedule();
  },
  /** "Try now" on the notice and the status page. Resolves true when the server answered. */
  checkNow,
  /** The "Back online" moment is over. */
  clearBack: () => state.backAt && set({ backAt: 0 }),
};

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    set({ offline: false });
    if (state.unreachable) void checkNow();
  });
  window.addEventListener("offline", () => set({ offline: true }));
}
