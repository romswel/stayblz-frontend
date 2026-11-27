import { useEffect, useState } from "react";
import { api } from "../../api";
import { errorText } from "../stayblz-data/detail";
import { formFav, type HorseRow, type IndexCode, type Overview } from "../stayblz-data/formfavApi";
import { virtualHorsePath } from "../virtual/api";

/* ==========================================================================
   Dashboard data: FormFav US/Canada overview (/api/stayblz-data/formfav/overview) and "Your horses"
   (/api/my-racing/race-watch: linked Virtual Stayblz horses from your list and your stables, plus your own horses).
   ========================================================================== */

export type WatchList =
  | { kind: "personal"; id: string; source: string }
  | { kind: "stable"; id: string; source: string; stableId: string; stableName: string }
  | { kind: "owned"; id: string; role: "lead" | "coowner" };

export type WatchHorse = {
  key: string;
  name: string;
  /** Linked to race data (owned horses can be listed without a link). */
  linked: boolean;
  raceData: { name: string; code: IndexCode } | null;
  coverImageId: string | null;
  lists: WatchList[];
  /** What race data has on it now; null when linked but with no runs in the window. */
  race: {
    starts: number;
    wins: number;
    places: number;
    lastStart: HorseRow["lastStart"];
    nextEntry: HorseRow["nextEntry"];
    trainer: string | null;
    jockey: string | null;
    recent: { date: string; position: number | null; track: string | null; fieldSize: number | null }[];
    /** Newer servers: no run in the last 30 days, so the last run(s) come from the Stayblz race history. */
    fromHistory?: boolean;
  } | null;
};
export type RaceWatch = { horses: WatchHorse[]; building: boolean; updatedAt: string | null };

export const raceWatch = (signal?: AbortSignal) => api.get<RaceWatch>("/api/my-racing/race-watch", { signal });

/** Where a row opens: your own horse's profile, else your list's copy, else the stable's. */
export function watchHref(h: WatchHorse) {
  const first = h.lists[0];
  if (!first) return "/my-racing?tab=virtual";
  if (first.kind === "owned") return `/community/horses/${first.id}`;
  const racing = first.source === "formfav";
  if (first.kind === "personal") return virtualHorsePath("personal", first.id, racing);
  return `/workspace/virtual?stable=${encodeURIComponent(first.stableId)}&horse=${first.id}${racing ? "&vtab=racing" : ""}`;
}

export type Finish = "win" | "place" | "out";
/** Green = won, gold = 2nd/3rd, grey = unplaced. */
export const finishOf = (position: number | null | undefined): Finish | null =>
  position === null || position === undefined ? null : position === 1 ? "win" : position <= 3 ? "place" : "out";

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

/** YYYY-MM-DD `n` days from `iso`. */
export const shiftIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * The dashboard's race data. Keeps the last answer when a refresh fails; while the server's first index build runs
 * (`building`), checks again every 20 s.
 */
export function useFormFavOverview(track: string, version: number) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [again, setAgain] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    let timer = 0;
    setRefreshing(true);
    setError("");
    (async () => {
      try {
        const s = await formFav.status();
        if (c.signal.aborted) return;
        setEnabled(s.enabled);
        if (!s.enabled) return;
        const o = await formFav.overview({ track: track || undefined }, c.signal);
        if (c.signal.aborted) return;
        if (!o || !Array.isArray(o.upcoming) || !Array.isArray(o.results) || !o.leaders || !o.stakes)
          throw new Error("Race data couldn't be loaded.");
        setData(o);
        if (o.building) timer = window.setTimeout(() => setAgain((n) => n + 1), 20_000);
      } catch (e) {
        if (!c.signal.aborted) setError(errorText(e, "Race data couldn't be loaded."));
      } finally {
        if (!c.signal.aborted) setRefreshing(false);
      }
    })();
    return () => {
      c.abort();
      window.clearTimeout(timer);
    };
  }, [track, version, again]);
  return { enabled, data, error, refreshing };
}

/** "Your horses" for the dashboard; `version` reloads it. */
export function useRaceWatch(version: number) {
  const [data, setData] = useState<RaceWatch | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    raceWatch(c.signal)
      .then((d) => {
        if (c.signal.aborted) return;
        if (!d || !Array.isArray(d.horses)) throw new Error("Your horses couldn't be loaded.");
        setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorText(e, "Your horses couldn't be loaded."));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [version, retry]);
  return { data, error, loading, retry: () => setRetry((n) => n + 1) };
}
