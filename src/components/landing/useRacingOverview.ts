import { useEffect, useState } from "react";
import { api } from "../../api";

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
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRefreshing(true);
    api
      .get<unknown>("/api/public/racing-overview", {
        signal: controller.signal,
      })
      .then((response) => {
        if (!validOverview(response))
          throw new Error("Racing data could not be loaded.");
        if (!controller.signal.aborted) {
          setData(response);
          setError("");
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Racing data could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") setAttempt((n) => n + 1);
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return { data, error, refreshing, refresh: () => setAttempt((n) => n + 1) };
}
