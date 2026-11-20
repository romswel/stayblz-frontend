import { api } from "../../api";

/** Stayblz Data: the Equibase race day served by /api/stayblz-data (signed in). */

export interface RaceSummary {
  race_id: string;
  race_date: string;
  track_code: string;
  track_name: string;
  race_number: number;
  race_name: string | null;
  race_type: string | null;
  distance: string | null;
  surface: string | null;
  purse_usd: number | null;
  post_time: string | null;
  track_condition: string | null;
  entries_count: number;
  race_cancelled: boolean;
  results_available: boolean;
  winner_horse: string | null;
  winner_jockey: string | null;
  winning_time: string | null;
}

export interface HorseSummary {
  horse_refno: string;
  horse_name: string;
  starts: number;
  wins: number;
  best_speed_figure: number | null;
  last_start: { race_date: string; track_code: string; track_name: string; finish_position: number | null; speed_figure: number | null } | null;
  workouts: number;
  entered_race_ids: string[];
}

export interface Entry {
  program_number: string | null;
  post_position: string | null;
  horse_name: string;
  horse_refno: string | null;
  age_sex: string | null;
  medication: string | null;
  claim_price_usd: number | null;
  jockey: string | null;
  trainer: string | null;
  weight_lbs: number | null;
  ml_odds: string | null;
  live_odds: string | null;
  is_scratched: boolean;
  finish_position: number | null;
}
export interface ExoticPayout {
  payoff: number;
  raw_label: string;
  winning_numbers: string;
}
export interface RaceDetail extends Omit<RaceSummary, "entries_count"> {
  entries_count: number;
  age_sex_restriction: string | null;
  winner_trainer: string | null;
  entries_detail: Entry[];
  payouts_by_horse: { finish_position: number; program_number: string; horse_name: string; win_payout: number | null; place_payout: number | null; show_payout: number | null }[] | null;
  exotic_payouts_by_type: Record<string, ExoticPayout> | null;
  entry_url: string | null;
  result_url: string | null;
}

export interface PastStart {
  race_id: string;
  track_code: string;
  track_name: string;
  race_date: string;
  race_number: number;
  race_type: string | null;
  breed: string | null;
  finish_position: number | null;
  speed_figure: number | null;
}
export interface Workout {
  track_code: string;
  track_name: string;
  workout_date: string;
  surface: string | null;
  distance: string | null;
  time: string | null;
  note: string | null;
  rank: string | null;
}
export interface HorseDetail {
  horse_refno: string;
  horse_name: string;
  entered_race_ids: string[];
  past_starts: PastStart[];
  workouts: Workout[];
  profile_url: string | null;
}

export interface Page<T> {
  records: T[];
  nextOffset: number | null;
  total: number;
}
export interface Meta {
  race_date: string;
  source: string;
  races: number;
  horses: number;
  tracks: { code: string; name: string; races: number }[];
}

export interface ListParams {
  offset: number;
  limit?: number;
  track?: string;
  q?: string;
}
function qs({ offset, limit, track, q }: ListParams) {
  const p = new URLSearchParams({ offset: String(offset) });
  if (limit) p.set("limit", String(limit));
  if (track) p.set("track", track);
  if (q) p.set("q", q);
  return p.toString();
}

const base = "/api/stayblz-data";
export const stayblzData = {
  meta: () => api.get<Meta>(`${base}/meta`),
  races: (params: ListParams, signal?: AbortSignal) => api.get<Page<RaceSummary>>(`${base}/races?${qs(params)}`, { signal }),
  horses: (params: ListParams, signal?: AbortSignal) => api.get<Page<HorseSummary>>(`${base}/horses?${qs(params)}`, { signal }),
  race: (id: string) => api.get<RaceDetail>(`${base}/races/${encodeURIComponent(id)}`),
  horse: (refno: string) => api.get<HorseDetail>(`${base}/horses/${encodeURIComponent(refno)}`),
};
