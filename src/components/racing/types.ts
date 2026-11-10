// Shapes returned by /api/public/racing/* and /api/admin/racing/* (see migration 202611100005).
export type Breed = "thoroughbred" | "harness" | "quarter_horse";
export type Surface = "dirt" | "turf" | "synthetic" | "all_weather";
export type RaceStatus = "scheduled" | "official" | "cancelled";

export interface Track {
  id: string;
  code: string;
  name: string;
  country: string;
  region: string;
  breed: Breed;
}
export interface PersonRef {
  id: string;
  name: string;
  kind: "jockey" | "driver" | "trainer" | "owner";
}
export interface Horse {
  id: string;
  name: string;
  country: string;
  foaled: number | null;
  sex: string;
  color: string;
  sire: string;
  dam: string;
  damSire: string;
  breeder: string;
  breed: Breed;
}
export interface Runner {
  id: string;
  program: string;
  post: number | null;
  horse: Horse;
  jockey: PersonRef | null;
  trainer: PersonRef | null;
  owner: PersonRef | null;
  weight: number | null;
  medication: string;
  equipment: string;
  morningLine: string;
  scratched: boolean;
  scratchReason: string;
  finish?: number | null;
  lengths?: number | null;
  odds?: number | null;
  earnings?: number | null;
  comment?: string;
}
export interface Payout {
  pool: string;
  combination: string;
  amount: number;
}
export interface Race {
  id: string;
  number: number;
  postTime: string;
  name: string;
  type: string;
  grade: number | null;
  breed: Breed;
  distance: string;
  distanceValue: number | null;
  distanceUnit: string;
  surface: Surface;
  condition: string;
  purse: number | null;
  currency: string;
  conditions: string;
  status: RaceStatus;
  winningTime: string;
  payouts: Payout[];
  footnotes: string;
  runnerCount: number;
  runners?: Runner[];
  winner?: { horse: string; horseId: string; odds?: number | null } | null;
}
export interface RaceDay {
  id: string;
  date: string;
  status?: "draft" | "published";
  publishedAt?: string | null;
  notes: string;
  track: Track;
  races: Race[];
}
export interface DaySummary {
  id: string;
  date: string;
  notes: string;
  track: Track;
  races: number;
  official: number;
  stakes: number;
  firstPost: string | null;
  raceList: Race[];
}
export interface Start {
  runnerId: string;
  raceId: string;
  dayId: string;
  date: string;
  track: string;
  trackCode: string;
  race: number;
  raceName: string;
  type: string;
  grade: number | null;
  status: RaceStatus;
  distance: string;
  surface: Surface;
  horse: { id: string; name: string };
  jockey: PersonRef | null;
  trainer: PersonRef | null;
  owner: PersonRef | null;
  program: string;
  scratched: boolean;
  finish: number | null;
  lengths: number | null;
  odds: number | null;
  earnings: number | null;
  field: number;
}
export interface Stats {
  starts: number;
  wins: number;
  places: number;
  shows: number;
  earnings: number;
}
export interface Workout {
  id: string;
  date: string;
  status?: "draft" | "published";
  horse: { id: string; name: string };
  track: Track;
  distance: string;
  distanceValue: number;
  distanceUnit: string;
  surface: Surface;
  time: string;
  timeSeconds: number;
  rank: number | null;
  rankOf: number | null;
  note: string;
}
