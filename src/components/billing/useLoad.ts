import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads something for a page: loading ≠ empty ≠ error, the last good data stays on screen when a refresh
 * fails, and an answer that arrives after the inputs changed is ignored.
 */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    const mine = ++generation.current;
    setLoading(true);
    try {
      const next = await fnRef.current();
      if (mine !== generation.current) return;
      setData(next);
      setError("");
    } catch (e) {
      if (mine === generation.current) setError(e instanceof Error ? e.message : "This couldn't be loaded.");
    } finally {
      if (mine === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    setData(null);
    void reload();
    return () => {
      generation.current++;
    };
    // The caller lists what the loader depends on.
  }, deps);
  return { data, error, loading, reload, setData };
}
