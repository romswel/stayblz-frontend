import { useEffect, useState, useRef, useCallback } from "react";
import { api, ApiError } from "../../api";

export const sectionKeys = [
  "racecards",
  "results",
  "workouts",
  "horses",
  "jockeys",
  "trainers",
  "stakes",
  "notes",
] as const;
export type SectionKey = (typeof sectionKeys)[number];
export interface RacingRecord {
  id: string;
  name: string;
  detail?: string;
  track?: string;
  date?: string;
  time?: string;
  race?: string;
  surface?: string;
  distance?: string;
  margin?: string;
  category?: string;
  summary?: string;
  body?: string;
  runners?: number;
  starts?: number;
  wins?: number;
  figure?: number;
}
export interface RacingOverview {
  sections: Record<SectionKey, RacingRecord[]>;
  fetchedAt: string;
}

function validOverview(value: unknown): value is RacingOverview {
  if (!value || typeof value !== "object") return false;
  const candidate = value as RacingOverview;
  return (
    typeof candidate.fetchedAt === "string" &&
    Number.isFinite(Date.parse(candidate.fetchedAt)) &&
    !!candidate.sections &&
    sectionKeys.every(
      (key) =>
        Array.isArray(candidate.sections[key]) &&
        candidate.sections[key].every(
          (row) =>
            row &&
            typeof row.id === "string" &&
            typeof row.name === "string" &&
            [
              "detail",
              "track",
              "date",
              "time",
              "race",
              "surface",
              "distance",
              "margin",
              "category",
              "summary",
              "body",
            ].every((field) => {
              const v = (row as unknown as Record<string, unknown>)[field];
              return v === undefined || typeof v === "string";
            }) &&
            ["runners", "starts", "wins", "figure"].every((field) => {
              const v = (row as unknown as Record<string, unknown>)[field];
              return (
                v === undefined ||
                (typeof v === "number" && Number.isFinite(v) && v >= 0)
              );
            }),
        ),
    )
  );
}

export default function useRacingOverview() {
  const [data, setData] = useState<RacingOverview | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    let disposed = false;
    let running = false;
    let failures = 0;
    let blockedUntil = 0;
    let lastStarted = 0;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    const active = () =>
      document.visibilityState !== "hidden" && navigator.onLine;
    function schedule(delay: number) {
      window.clearTimeout(timer);
      if (!disposed && active())
        timer = window.setTimeout(() => void load(), delay);
    }
    async function load(manual = false) {
      if (disposed || running) return;
      if (!navigator.onLine) {
        setError("You’re offline. Records will load when you reconnect.");
        setRefreshing(false);
        return;
      }
      if (!active()) return;
      const wait = Math.max(
        blockedUntil - Date.now(),
        manual ? 0 : lastStarted + 2000 - Date.now(),
      );
      if (wait > 0) {
        schedule(wait);
        return;
      }
      window.clearTimeout(timer);
      running = true;
      lastStarted = Date.now();
      controller = new AbortController();
      const requestController = controller;
      // A stalled connection must not leave the page loading indefinitely.
      const timeout = window.setTimeout(() => requestController.abort(), 20000);
      setRefreshing(true);
      let delay = 60000;
      try {
        const response = await api.get<unknown>("/api/public/racing-overview", {
          signal: requestController.signal,
        });
        if (!validOverview(response))
          throw new Error("Racing data could not be loaded.");
        if (disposed) return;
        setData(response);
        setError("");
        failures = 0;
        blockedUntil = 0;
      } catch (reason) {
        if (disposed) return;
        failures++;
        delay = Math.min(60000, 5000 * 2 ** Math.min(failures - 1, 4));
        if (reason instanceof ApiError && reason.status === 429) {
          delay = Math.max(delay, reason.retryAfterSeconds * 1000);
          blockedUntil = Date.now() + delay;
        }
        setError(
          requestController.signal.aborted
            ? "The request took too long. Trying again automatically."
            : reason instanceof Error
              ? reason.message
              : "Racing data could not be loaded.",
        );
      } finally {
        window.clearTimeout(timeout);
        running = false;
        if (!disposed) {
          setRefreshing(false);
          schedule(delay);
        }
      }
    }
    const resume = () => {
      if (active()) void load();
      else window.clearTimeout(timer);
    };
    refreshRef.current = () => void load(true);
    // StrictMode's setup/cleanup probe must not send an extra initial request.
    queueMicrotask(() => void load());
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      refreshRef.current = () => {};
      window.clearTimeout(timer);
      controller?.abort();
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  const refresh = useCallback(() => refreshRef.current(), []);
  return { data, error, refreshing, refresh };
}
