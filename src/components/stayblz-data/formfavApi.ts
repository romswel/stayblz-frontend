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

// ── A–Z lists built from FormFav's US/Canada cards (about the last 30 days and the next 1–2) ─────────────────────────
export type IndexCode = "gallops" | "harness";
export interface ListMeta {
  /** The first build since the server started is still running: the list may be short. */
  building: boolean;
  updatedAt: string | null;
  coverage: { from: string; to: string };
}
export interface ListPage<T> extends ListMeta {
  records: T[];
  nextOffset: number | null;
  total: number;
}
export interface ListParams {
  offset: number;
  limit?: number;
  q?: string;
  codes: IndexCode[];
  countries: Country[];
}
export interface HorseRow {
  name: string;
  code: IndexCode;
  countries: string[];
  /** Runs in races that have been run (scratchings left out). */
  starts: number;
  wins: number;
  places: number;
  lastStart: {
    date: string;
    track: string | null;
    slug: string;
    position: number | null;
    /** Newer servers: enough to open the race and say "1st of 9". */
    raceNumber?: number | null;
    code?: IndexCode;
    country?: string;
    timezone?: string;
    fieldSize?: number | null;
  } | null;
  nextEntry: {
    date: string;
    track: string | null;
    slug: string;
    country: string;
    code: IndexCode;
    timezone: string;
    raceNumber: number | null;
    startTime: string | null;
  } | null;
  jockey: string | null;
  trainer: string | null;
}
export interface HorseStart {
  date: string;
  code: IndexCode;
  timezone: string;
  track: string | null;
  slug: string;
  country: string;
  raceNumber: number | null;
  raceName: string | null;
  /** As FormFav writes it, e.g. "1308m" (newer servers). */
  distance?: string | null;
  startTime: string | null;
  status: string | null;
  position: number | null;
  /** Runners not scratched (newer servers). */
  fieldSize?: number | null;
  scratched: boolean;
  jockey: string | null;
  trainer: string | null;
}
export interface HorseDetail extends HorseRow {
  history: HorseStart[];
}
export interface PersonRow {
  kind: "jockey" | "trainer";
  name: string;
  rides: number;
  wins: number;
  places: number;
  winRate: number | null;
  upcoming: number;
  tracks: number;
  lastRide: string | null;
}

// ── Dashboard overview (from the same index; no FormFav calls) ─────────────────────────────────────────────────────
export interface OverviewRace {
  date: string;
  code: IndexCode;
  timezone: string;
  track: string | null;
  slug: string;
  country: string;
  raceNumber: number | null;
  raceName: string | null;
  raceClass: string | null;
  distance: string | null;
  startTime: string | null;
  /** Runners not scratched. */
  runners: number;
  stakes: boolean;
}
export interface OverviewResult extends OverviewRace {
  placings: { position: number; name: string; jockey: string | null; trainer: string | null }[];
}
export interface OverviewHorse extends HorseRow {
  winRate: number;
  /** Last five finishes, newest first, e.g. "1-3-1-5-2" (0 = 10th or worse). */
  form: string;
}
export interface Overview extends ListMeta {
  today: string;
  tracks: { slug: string; name: string | null; country: string; codes: IndexCode[] }[];
  counts: { meetingsToday: number; racesToday: number; resultsToday: number; stakesAhead: number };
  upcoming: OverviewRace[];
  results: OverviewResult[];
  stakes: { upcoming: OverviewRace[]; results: OverviewResult[] };
  leaders: { horses: OverviewHorse[]; jockeys: PersonRow[]; trainers: PersonRow[] };
  inForm: OverviewHorse[];
}

const base = "/api/stayblz-data/formfav";
const listQs = (p: ListParams) =>
  qs({ offset: p.offset, limit: p.limit, q: p.q, codes: p.codes.join(","), countries: p.countries.join(",") });
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
  searchRunners: (q: string, code: RaceCode, signal?: AbortSignal) =>
    api.get<SearchResults<RunnerHit>>(`${base}/search?${qs({ kind: "runner", q, race_code: code })}`, { signal }),
  person: (kind: "jockey" | "trainer", name: string, code?: RaceCode) =>
    api.get<PersonStats>(`${base}/${kind}/${encodeURIComponent(name)}?${qs({ race_code: code })}`),
  horses: (p: ListParams, signal?: AbortSignal) => api.get<ListPage<HorseRow>>(`${base}/horses?${listQs(p)}`, { signal }),
  horse: (name: string, code: IndexCode) => api.get<HorseDetail>(`${base}/horse?${qs({ name, code })}`),
  people: (kind: "jockey" | "trainer", p: ListParams, signal?: AbortSignal) =>
    api.get<ListPage<PersonRow>>(`${base}/people?${qs({ kind })}&${listQs(p)}`, { signal }),
  overview: (q: { track?: string }, signal?: AbortSignal) => api.get<Overview>(`${base}/overview?${qs({ track: q.track })}`, { signal }),
  runner: (id: number) => api.get<RunnerStats>(`${base}/runner/${id}`),
  trackBias: (slug: string, code?: RaceCode, country?: string) =>
    api.get<TrackBias>(`${base}/track-bias/${encodeURIComponent(slug)}?${qs({ race_code: code, country })}`),
};
