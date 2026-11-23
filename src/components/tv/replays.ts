import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../api";

/* ==========================================================================
   STAYBLZ TV — race replays with full results: data shape and loader.
   The page reads GET /api/tv/replays → { replays: Replay[] }. Until that
   endpoint exists (404) there are simply no race replays: the page opens on
   the track channels' YouTube broadcasts instead. No sample data is shown.
   ========================================================================== */

export type Runner = {
  /** Finishing position; null for a scratch or did-not-finish. */
  pos: number | null;
  horse: string;
  post?: number;
  jockey?: string;
  trainer?: string;
  odds?: string;
  /** Lengths behind the winner, e.g. "1¼". Empty for the winner. */
  margin?: string;
  note?: string;
};

export type Replay = {
  id: string;
  title: string;
  track: string;
  raceNumber: number;
  /** ISO date-time of the race. */
  date: string;
  distance: string;
  surface: "Dirt" | "Turf" | "Synthetic";
  grade?: string;
  purse?: string;
  /** Final time, e.g. "1:42.18". */
  winningTime?: string;
  /** Length of the video in seconds. */
  duration?: number;
  /** Playable video (MP4/HLS). Without one the replay shows results only. */
  videoUrl?: string | null;
  runners: Runner[];
};

export function useReplays() {
  const [state, setState] = useState<{ loading: boolean; error: string; replays: Replay[] }>({
    loading: true,
    error: "",
    replays: [],
  });
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const d = await api.get<{ replays: Replay[] }>("/api/tv/replays");
      if (mine !== generation.current) return;
      if (!Array.isArray(d?.replays)) throw new Error("Replays could not be loaded.");
      setState({ loading: false, error: "", replays: d.replays });
    } catch (e) {
      if (mine !== generation.current) return;
      // Not built yet on the server: no race replays, which isn't an error.
      if (e instanceof ApiError && e.status === 404) return setState({ loading: false, error: "", replays: [] });
      setState({ loading: false, error: e instanceof Error ? e.message : "Replays could not be loaded.", replays: [] });
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      generation.current++;
    };
  }, [load]);

  return { ...state, reload: load };
}

/* ---------- Helpers ---------- */

export const normalize = (s: string) =>
  s.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export const formatDuration = (sec?: number) =>
  sec === undefined ? "" : `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export const winnerOf = (r: Replay) => r.runners.find((x) => x.pos === 1);
