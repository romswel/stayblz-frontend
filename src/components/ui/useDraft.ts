import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Saved drafts: what people type survives a reload, a closed tab, or a trip to another page.
 * Stored in this browser only (localStorage), expire after a few days, and are cleared when the
 * form is sent. Never store passwords, codes or payment details in a draft.
 *
 * Signed-in drafts use `accountDraftKey(user.id, "...")` so they are removed on log out.
 */
const PREFIX = "stayblz.draft.";
const DAY = 24 * 60 * 60 * 1000;

type Stored<T> = { v: T; at: number };

function read<T>(key: string, fallback: T, maxAgeDays: number): { value: T; restored: boolean } {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return { value: fallback, restored: false };
    const stored = JSON.parse(raw) as Stored<T>;
    if (!stored || typeof stored.at !== "number" || Date.now() - stored.at > maxAgeDays * DAY) {
      localStorage.removeItem(PREFIX + key);
      return { value: fallback, restored: false };
    }
    // Merge objects so new fields added later still get their defaults.
    const value =
      fallback && typeof fallback === "object" && !Array.isArray(fallback) && stored.v && typeof stored.v === "object"
        ? ({ ...fallback, ...stored.v } as T)
        : stored.v;
    return { value, restored: true };
  } catch {
    return { value: fallback, restored: false };
  }
}

export function accountDraftKey(accountId: string | undefined, name: string) {
  return accountId ? `u.${accountId}.${name}` : null;
}

export function clearDraft(key: string | null) {
  if (!key) return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* Storage blocked: nothing saved anyway. */
  }
}

/** Remove every saved draft for one account (on log out), or all drafts when no id is given. */
export function clearAccountDrafts(accountId?: string) {
  try {
    const start = accountId ? `${PREFIX}u.${accountId}.` : PREFIX;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(start)) localStorage.removeItem(key);
    }
  } catch {
    /* Storage blocked. */
  }
}

/**
 * `useState` that is saved as a draft. Pass `null` as the key to turn saving off.
 * Returns [value, setValue, clear, restored] — `restored` is true when an old draft was loaded,
 * so the form can say "We kept what you typed".
 */
export function useDraft<T>(
  key: string | null,
  initial: T,
  { maxAgeDays = 7, isEmpty }: { maxAgeDays?: number; isEmpty?: (value: T) => boolean } = {},
): [T, Dispatch<SetStateAction<T>>, () => void, boolean] {
  const initialRef = useRef(initial);
  const [state, setState] = useState(() => (key ? read(key, initial, maxAgeDays) : { value: initial, restored: false }));
  const loadedKey = useRef(key);
  // A different key (another post, another account) loads its own draft.
  useEffect(() => {
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setState(key ? read(key, initialRef.current, maxAgeDays) : { value: initialRef.current, restored: false });
  }, [key, maxAgeDays]);
  const skipWrite = useRef(true);
  useEffect(() => {
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }
    if (!key) return;
    const timer = window.setTimeout(() => {
      try {
        const empty = isEmpty ? isEmpty(state.value) : JSON.stringify(state.value) === JSON.stringify(initialRef.current);
        if (empty) localStorage.removeItem(PREFIX + key);
        else localStorage.setItem(PREFIX + key, JSON.stringify({ v: state.value, at: Date.now() } satisfies Stored<T>));
      } catch {
        /* Full or blocked storage: the form still works, it just isn't saved. */
      }
    }, 250);
    return () => window.clearTimeout(timer);
    // isEmpty is expected to be stable in behaviour.
  }, [key, state.value]);
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (next) =>
      setState((current) => ({
        restored: current.restored,
        value: typeof next === "function" ? (next as (previous: T) => T)(current.value) : next,
      })),
    [],
  );
  const clear = useCallback(() => {
    clearDraft(loadedKey.current);
    // Back to the starting value; the save effect then sees an empty form and stores nothing.
    setState({ value: initialRef.current, restored: false });
  }, []);
  return [state.value, setValue, clear, state.restored];
}
