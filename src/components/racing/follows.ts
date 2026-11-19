import { api } from "../../api";
import type { Start } from "./types";

/**
 * Following on the linked racing data (backend /api/my-racing/follows, table racing_follows).
 * A follow is a horse, a person (jockey/driver, trainer, owner) or a horse's family: its sire and dam, brothers and
 * sisters out of the same dam, and its foals. Followers get alerts for entries, scratches, results and workouts.
 */
export type FollowKind = "horse" | "family" | "person";

export interface FollowState {
  horse: boolean;
  family: boolean;
  person: boolean;
  /** Relatives already on public Stayblz racing pages. */
  relatives: number;
  total: number;
}

export interface Follow {
  id: string;
  kind: FollowKind;
  since: string;
  horse: { id: string; name: string; country: string; foaled: number | null; sex: string; sire: string; dam: string; breed: string } | null;
  person: { id: string; name: string; kind: string } | null;
  relatives: number | null;
  next: Start | null;
  last: Start | null;
}

export const followsApi = {
  list: (signal?: AbortSignal) => api.get<{ follows: Follow[] }>("/api/my-racing/follows", { signal }),
  state: (id: string, signal?: AbortSignal) =>
    api.get<{ state: FollowState }>(`/api/my-racing/follows/state?id=${encodeURIComponent(id)}`, { signal }),
  set: (kind: FollowKind, id: string, on: boolean) => api.post<{ state: FollowState }>("/api/my-racing/follows", { kind, id, on }),
};
