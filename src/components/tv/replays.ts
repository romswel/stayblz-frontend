import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";

/* ==========================================================================
   STAYBLZ TV — race replays: data shape, loader and sample data.
   The page reads GET /api/tv/replays → { replays: Replay[] }.
   Until that endpoint exists, the sample replays below are shown and the
   page labels them "Sample data". Set USE_SAMPLE_REPLAYS to false to hide them.
   ========================================================================== */

export const USE_SAMPLE_REPLAYS = true;

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

export type ReplaySource = "server" | "sample";

export function useReplays() {
  const [state, setState] = useState<{
    loading: boolean;
    error: string;
    replays: Replay[];
    source: ReplaySource;
  }>({ loading: true, error: "", replays: [], source: "server" });
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const d = await api.get<{ replays: Replay[] }>("/api/tv/replays");
      if (mine !== generation.current) return;
      if (!Array.isArray(d?.replays)) throw new Error("Replays could not be loaded.");
      setState({ loading: false, error: "", replays: d.replays, source: "server" });
    } catch (e) {
      if (mine !== generation.current) return;
      if (USE_SAMPLE_REPLAYS) {
        setState({ loading: false, error: "", replays: SAMPLE_REPLAYS, source: "sample" });
      } else {
        setState({
          loading: false,
          error: e instanceof Error ? e.message : "Replays could not be loaded.",
          replays: [],
          source: "server",
        });
      }
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

/* ---------- Sample replays (fictional horses and people) ---------- */

const R = (
  pos: number | null,
  horse: string,
  post: number,
  jockey: string,
  trainer: string,
  odds: string,
  margin = "",
): Runner => ({ pos, horse, post, jockey, trainer, odds, margin });

export const SAMPLE_REPLAYS: Replay[] = [
  {
    id: "sa-20261114-7",
    title: "Golden Hour Stakes",
    track: "Santa Anita",
    raceNumber: 7,
    date: "2026-11-14T15:42:00-08:00",
    distance: "1 1/16 mi",
    surface: "Dirt",
    grade: "G3",
    purse: "$150,000",
    winningTime: "1:42.18",
    duration: 142,
    runners: [
      R(1, "Midnight Ledger", 4, "A. Delgado", "M. Hartwell", "5-2"),
      R(2, "Copper Crown", 2, "J. Okafor", "R. Bellamy", "3-1", "1¼"),
      R(3, "Silver Gate", 6, "T. Moreau", "C. Quinlan", "7-2", "2"),
      R(4, "Harbor Light", 1, "L. Vance", "D. Ashby", "8-1", "3½"),
      R(5, "Quiet Thunder", 5, "S. Navarro", "M. Hartwell", "12-1", "5"),
      R(6, "Paper Tiger", 3, "K. Brandt", "E. Solis", "20-1", "8¾"),
    ],
  },
  {
    id: "dmr-20261113-5",
    title: "Allowance Optional Claiming",
    track: "Del Mar",
    raceNumber: 5,
    date: "2026-11-13T14:10:00-08:00",
    distance: "1 mi",
    surface: "Turf",
    purse: "$72,000",
    winningTime: "1:34.62",
    duration: 128,
    runners: [
      R(1, "Sea Glass", 3, "T. Moreau", "C. Quinlan", "9-5"),
      R(2, "Harbor Light", 7, "L. Vance", "D. Ashby", "4-1", "nk"),
      R(3, "Velvet Arrow", 1, "J. Okafor", "P. Lindqvist", "6-1", "1½"),
      R(4, "North Ridge", 5, "A. Delgado", "R. Bellamy", "5-1", "2¼"),
      R(5, "Lantern Bay", 2, "S. Navarro", "E. Solis", "15-1", "4"),
      R(null, "Brass Compass", 6, "K. Brandt", "M. Hartwell", "—"),
    ],
  },
  {
    id: "kee-20261108-9",
    title: "Bluegrass Twilight Handicap",
    track: "Keeneland",
    raceNumber: 9,
    date: "2026-11-08T16:55:00-05:00",
    distance: "1 1/8 mi",
    surface: "Dirt",
    grade: "G2",
    purse: "$300,000",
    winningTime: "1:49.71",
    duration: 151,
    runners: [
      R(1, "Iron Psalm", 8, "R. Castellano", "W. Pruitt", "6-1"),
      R(2, "Midnight Ledger", 2, "A. Delgado", "M. Hartwell", "2-1", "½"),
      R(3, "Kingsbridge", 5, "J. Okafor", "G. Farrow", "4-1", "1¾"),
      R(4, "Morning Ledger", 1, "T. Moreau", "C. Quinlan", "10-1", "2½"),
      R(5, "Quiet Thunder", 4, "S. Navarro", "M. Hartwell", "9-1", "4¼"),
      R(6, "Salt Road", 6, "L. Vance", "D. Ashby", "15-1", "6"),
      R(7, "Echo Canyon", 3, "K. Brandt", "E. Solis", "30-1", "11"),
    ],
  },
  {
    id: "cd-20261107-4",
    title: "Maiden Special Weight",
    track: "Churchill Downs",
    raceNumber: 4,
    date: "2026-11-07T13:20:00-05:00",
    distance: "6 1/2 f",
    surface: "Dirt",
    purse: "$95,000",
    winningTime: "1:16.40",
    duration: 96,
    runners: [
      R(1, "Bright Harbor", 6, "R. Castellano", "W. Pruitt", "7-5"),
      R(2, "Little Comet", 3, "J. Okafor", "G. Farrow", "5-2", "2"),
      R(3, "Rosewood Lane", 1, "A. Delgado", "P. Lindqvist", "8-1", "3¼"),
      R(4, "Flint & Feather", 4, "L. Vance", "D. Ashby", "12-1", "4"),
      R(5, "Tin Soldier", 2, "K. Brandt", "E. Solis", "25-1", "7½"),
    ],
  },
  {
    id: "gp-20261101-10",
    title: "Sunshine Turf Mile",
    track: "Gulfstream Park",
    raceNumber: 10,
    date: "2026-11-01T17:30:00-04:00",
    distance: "1 mi",
    surface: "Turf",
    grade: "G3",
    purse: "$175,000",
    winningTime: "1:33.88",
    duration: 126,
    runners: [
      R(1, "Velvet Arrow", 5, "J. Okafor", "P. Lindqvist", "4-1"),
      R(2, "Sea Glass", 2, "T. Moreau", "C. Quinlan", "8-5", "hd"),
      R(3, "Silver Gate", 7, "S. Navarro", "C. Quinlan", "5-1", "1"),
      R(4, "Coral Key", 1, "R. Castellano", "W. Pruitt", "6-1", "2¼"),
      R(5, "Palm Shadow", 3, "A. Delgado", "G. Farrow", "15-1", "3½"),
      R(6, "Lantern Bay", 4, "L. Vance", "E. Solis", "20-1", "5¾"),
      R(7, "Night Sonata", 6, "K. Brandt", "D. Ashby", "40-1", "9"),
    ],
  },
  {
    id: "sa-20261031-3",
    title: "Claiming $40,000",
    track: "Santa Anita",
    raceNumber: 3,
    date: "2026-10-31T13:05:00-07:00",
    distance: "6 f",
    surface: "Dirt",
    purse: "$38,000",
    winningTime: "1:09.85",
    duration: 88,
    runners: [
      R(1, "Copper Crown", 1, "J. Okafor", "R. Bellamy", "2-1"),
      R(2, "Desert Psalm", 4, "S. Navarro", "E. Solis", "7-2", "¾"),
      R(3, "Paper Tiger", 2, "K. Brandt", "E. Solis", "6-1", "2½"),
      R(4, "Brass Compass", 5, "A. Delgado", "M. Hartwell", "4-1", "3"),
      R(5, "Gold Thread", 3, "L. Vance", "D. Ashby", "10-1", "6"),
    ],
  },
  {
    id: "dmr-20261025-8",
    title: "Oceanside Breeze Stakes",
    track: "Del Mar",
    raceNumber: 8,
    date: "2026-10-25T16:15:00-07:00",
    distance: "5 1/2 f",
    surface: "Turf",
    purse: "$100,000",
    winningTime: "1:02.31",
    duration: 81,
    runners: [
      R(1, "Little Comet", 2, "T. Moreau", "G. Farrow", "3-1"),
      R(2, "Coral Key", 6, "R. Castellano", "W. Pruitt", "5-2", "1"),
      R(3, "Harbor Light", 4, "L. Vance", "D. Ashby", "9-2", "1¾"),
      R(4, "North Ridge", 1, "A. Delgado", "R. Bellamy", "6-1", "2¾"),
      R(5, "Tin Soldier", 3, "K. Brandt", "E. Solis", "30-1", "6"),
      R(6, "Rosewood Lane", 5, "J. Okafor", "P. Lindqvist", "12-1", "7¼"),
    ],
  },
  {
    id: "kee-20261018-6",
    title: "Allowance",
    track: "Keeneland",
    raceNumber: 6,
    date: "2026-10-18T15:00:00-04:00",
    distance: "1 1/16 mi",
    surface: "Synthetic",
    purse: "$85,000",
    winningTime: "1:43.90",
    duration: 139,
    runners: [
      R(1, "Kingsbridge", 3, "J. Okafor", "G. Farrow", "9-5"),
      R(2, "Iron Psalm", 5, "R. Castellano", "W. Pruitt", "3-1", "1½"),
      R(3, "Midnight Ledger", 1, "A. Delgado", "M. Hartwell", "5-2", "2"),
      R(4, "Salt Road", 2, "L. Vance", "D. Ashby", "12-1", "4½"),
      R(5, "Echo Canyon", 4, "K. Brandt", "E. Solis", "25-1", "8"),
    ],
  },
];