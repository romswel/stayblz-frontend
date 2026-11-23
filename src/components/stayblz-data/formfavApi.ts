import { api } from "../../api";

/** Stayblz Data → FormFav: form, results, predictions and stats served by /api/stayblz-data/formfav (signed in). */

export type RaceCode = "gallops" | "harness" | "greyhounds";

export interface MeetingRace {
  number: number | null;
  name: string | null;
  distance: string | null;
  raceClass: string | null;
  abandoned: boolean;
  startTime: string | null;
  timezone: string | null;
  runners: number | null;
}
export interface Meeting {
  /** The day, code and time zone FormFav lists this meeting under (needed to open its races). */
  date: string;
  raceCode: RaceCode;
  timezone: string;
  track: string | null;
  slug: string | null;
  country: string | null;
  abandoned: boolean;
  races: MeetingRace[];
}
export interface Meetings {
  from: string;
  to: string;
  /** Some of FormFav's lookups failed: the list may be missing meetings. */
  partial: boolean;
  meetings: Meeting[];
}

/** starts/wins/places + win and place rates as fractions (0.19 = 19%). */
export interface StatLine {
  starts?: number | null;
  wins?: number | null;
  places?: number | null;
  winPercent?: number | null;
  placePercent?: number | null;
}
export interface Runner {
  number: number | null;
  name: string | null;
  jockey: string | null;
  trainer: string | null;
  weight: number | null;
  claim: number | null;
  barrier: number | null;
  age: number | null;
  sex: string | null;
  sire: string | null;
  dam: string | null;
  careerPrizeMoney: string | null;
  form: string | null;
  last20Starts: string | null;
  scratched: boolean;
  stats: { overall?: StatLine | null; track?: StatLine | null; firstUp?: StatLine | null; secondUp?: StatLine | null } | null;
  speedMap: { runningStyle?: string | null; earlySpeedIndex?: number | null; settlingPosition?: number | null } | null;
  classProfile: { currentRating?: number | null; peakRating?: number | null; trend?: string | null } | null;
  badges: { label: string | null; sentiment: string | null; detail: string | null }[];
}
export interface RaceForm {
  date: string | null;
  track: string | null;
  raceNumber: number | null;
  raceName: string | null;
  distance: string | null;
  condition: string | null;
  weather: string | null;
  raceClass: string | null;
  abandoned: boolean;
  startTime: string | null;
  timezone: string | null;
  prizeMoney: string | null;
  numberOfRunners: number | null;
  runners: Runner[];
}
export interface Predictions {
  confidence: string | null;
  modelVersion: string | null;
  predictedAt: string | null;
  runners: { number: number | null; name: string | null; winProb: number | null; placeProb: number | null; rank: number | null }[];
}
export interface Results {
  status: string | null;
  updatedAt: string | null;
  revised: boolean;
  placings: {
    number: number | null;
    name: string | null;
    jockey: string | null;
    trainer: string | null;
    barrier: number | null;
    position: number | null;
    margin: string | null;
    scratched: boolean;
    startingPrice: number | null;
  }[];
}
export interface RaceDetail {
  form: RaceForm;
  predictions: Predictions | null;
  results: Results | null;
}

export type SearchKind = "jockey" | "trainer" | "runner";
export interface PersonHit {
  name: string | null;
  totalStarts: number | null;
  ambiguous: boolean;
}
export interface RunnerHit {
  id: number | null;
  name: string | null;
  country: string | null;
  totalStarts: number | null;
  lastRaceDate: string | null;
  sire: string | null;
  dam: string | null;
}
export interface SearchResults<T> {
  query: string | null;
  results: T[];
}

/** Rows FormFav sends in stats tables; every field may be missing. */
export type StatRow = Record<string, string | number | boolean | null | undefined>;

export interface PersonStats {
  kind: "jockey" | "trainer";
  name: string | null;
  raceCode: string | null;
  totalStarts: number | null;
  totalWins: number | null;
  winRate: number | null;
  placeRate: number | null;
  ambiguous: boolean;
  bestCondition: string | null;
  worstCondition: string | null;
  tracks: StatRow[] | null;
  conditions: StatRow[] | null;
}
export interface RunnerStats {
  runner: StatRow | null;
  career: StatRow | null;
  distances: StatRow[] | null;
  conditions: StatRow[] | null;
  venues: StatRow[] | null;
  spells: StatRow[] | null;
  jockeys: StatRow[] | null;
  classProfile: StatRow | null;
  runningStyle: StatRow | null;
  formTrend: StatRow | null;
  trialForm: StatRow | null;
  sire: StatRow | null;
}
export interface TrackBias {
  venue: string | null;
  raceCode: string | null;
  totalRaces: number | null;
  expectedWinRate: number | null;
  strongestBarrier: number | null;
  weakestBarrier: number | null;
  biasStrength: string | null;
  barriers: StatRow[] | null;
  distances: {
    category: string | null;
    minDistance: number | null;
    maxDistance: number | null;
    totalRaces: number | null;
    strongestBarrier: number | null;
    weakestBarrier: number | null;
    biasStrength: string | null;
  }[];
}

export type Country = "us" | "ca";
export type Zone = "America/New_York" | "America/Los_Angeles";
export interface MeetingsQuery {
  from: string;
  to: string;
  codes: RaceCode[];
  zones: Zone[];
  countries: Country[];
}
export interface RaceWhere {
  date: string;
  code: RaceCode;
  tz: string;
  track: string;
  race: number;
  country: string;
}

const base = "/api/stayblz-data/formfav";
const qs = (o: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") p.set(k, String(v));
  return p.toString();
};

export const formFav = {
  status: () => api.get<{ enabled: boolean }>(`${base}/status`),
  meetings: (q: MeetingsQuery, signal?: AbortSignal) =>
    api.get<Meetings>(
      `${base}/meetings?${qs({ from: q.from, to: q.to, race_codes: q.codes.join(","), timezones: q.zones.join(","), countries: q.countries.join(",") })}`,
      { signal },
    ),
  race: (w: RaceWhere) =>
    api.get<RaceDetail>(
      `${base}/race?${qs({ date: w.date, track: w.track, race: w.race, race_code: w.code, country: w.country, timezone: w.tz })}`,
    ),
  searchPeople: (kind: "jockey" | "trainer", q: string, code: RaceCode, signal?: AbortSignal) =>
    api.get<SearchResults<PersonHit>>(`${base}/search?${qs({ kind, q, race_code: code })}`, { signal }),
  searchRunners: (q: string, code: RaceCode, signal?: AbortSignal) =>
    api.get<SearchResults<RunnerHit>>(`${base}/search?${qs({ kind: "runner", q, race_code: code })}`, { signal }),
  person: (kind: "jockey" | "trainer", name: string, code?: RaceCode) =>
    api.get<PersonStats>(`${base}/${kind}/${encodeURIComponent(name)}?${qs({ race_code: code })}`),
  runner: (id: number) => api.get<RunnerStats>(`${base}/runner/${id}`),
  trackBias: (slug: string, code?: RaceCode, country?: string) =>
    api.get<TrackBias>(`${base}/track-bias/${encodeURIComponent(slug)}?${qs({ race_code: code, country })}`),
};
