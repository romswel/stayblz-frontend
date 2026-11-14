/**
 * The call this tab is in, if any. Tiny on purpose: the site layout imports it to show the mini
 * call window on other pages, without loading any of the calling code.
 */
import { useSyncExternalStore } from "react";

export interface ActiveCall {
  code: string;
  subscribe: (listener: () => void) => () => void;
  /** True while the call is going (not after leaving or being ended). */
  isLive: () => boolean;
  /** Leave the call (used when logging out). */
  leave: () => Promise<void>;
}

/** Leave any call this tab is in and forget it (log out, account switch). */
export async function endActiveCall() {
  const call = callStore.get();
  if (call?.isLive()) await call.leave().catch(() => undefined);
  callStore.set(null);
}

let current: ActiveCall | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const callStore = {
  get: () => current,
  set(call: ActiveCall | null) {
    if (current === call) return;
    current = call;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  /** The call announces changes (e.g. it ended) so the layout can hide the mini window. */
  changed: emit,
};

export function useActiveCall(): ActiveCall | null {
  return useSyncExternalStore(callStore.subscribe, callStore.get, () => null);
}
