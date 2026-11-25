import { useMemo } from "react";
import { api } from "../../api";
import { useStableApi } from "../../workspace";
import type { HorseDetail } from "../community/api";
import type { HistoryStart, Horse as RacingHorse, Start, Stats, Workout } from "../racing/types";
import type { Country, HorseDetail as RaceHorse, HorseRow, IndexCode, ListMeta, ListPage } from "../stayblz-data/formfavApi";

/* ==========================================================================
   Virtual Stayblz — horses tracked without owning them, plus logged entries.
   Personal list: /api/my-racing/virtual (only you). Stable list: /api/workspace/virtual
   (the active stable, sent with the X-Stayblz-Stable header by useStableApi).
   ========================================================================== */

export type VirtualMode = "personal" | "stable";
/** formfav: added from the Racing horses tab (race data); it lives in that tab, not in the list. */
export type VirtualSource = "community" | "racing" | "manual" | "formfav";
/** A link to a race-data horse (FormFav US/Canada race cards), on horses added from Racing horses or linked by hand. */
export type RaceLink = { name: string; code: IndexCode; runnerId: number | null; linkedAt: string; syncedAt: string | null };
export type EntryKind = "workout" | "race" | "sale" | "note";
export type SaleResult = "entered" | "sold" | "rna" | "withdrawn" | "private";

export type VirtualHorse = {
  id: string;
  source: VirtualSource;
  communityHorseId: string | null;
  racingHorseId: string | null;
  name: string;
  breed: string;
  sex: string;
  foaledYear: number | null;
  color: string;
  sire: string;
  dam: string;
  trainer: string;
  ownerName: string;
  location: string;
  notes: string;
  addedBy: string | null;
  addedByName?: string | null;
  canRemove: boolean;
  formfav?: RaceLink | null;
  createdAt: string;
  updatedAt: string;
};

export type VirtualListHorse = VirtualHorse & {
  counts: { workouts: number; races: number; sales: number; notes: number };
  lastEntry: string | null;
  live: {
    coverImageId: string | null;
    status: string;
    starts: number;
    wins: number;
    places: number;
    shows: number;
    earningsCents: number | null;
  } | null;
  /** Linked to race data: its numbers in the US/Canada window (null when it has no runs there now). */
  race?: Pick<HorseRow, "starts" | "wins" | "places" | "lastStart" | "nextEntry" | "trainer"> | null;
};

export type VirtualEntry = {
  id: string;
  kind: EntryKind;
  entryDate: string;
  title: string;
  track: string;
  distance: string;
  surface: string;
  timeText: string;
  finish: number | null;
  fieldSize: number | null;
  result: string;
  hipNumber: string;
  amountCents: number | null;
  notes: string;
  author: { id: string; name: string } | null;
  /** Added from race data: only the notes change, and it can't be removed while the horse is linked. */
  fromRaceData?: boolean;
  canEdit: boolean;
  canRemove?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RacingLive = { horse: RacingHorse; stats: Stats; starts: Start[]; workouts: Workout[]; history?: HistoryStart[] };
export type VirtualDetail = {
  horse: VirtualHorse;
  entries: VirtualEntry[];
  live: { community: HorseDetail } | { racing: RacingLive } | null;
  liveUnavailable: boolean;
  /** Linked horses: what race data has on it now (no runs in the window = horse null). */
  raceData?:
    | (RaceLink &
        ListMeta & {
          available: boolean;
          horse: RaceHorse | null;
          followers: number;
          alertsOn: boolean;
        })
    | null;
};

/** One row of the Racing horses tab. */
export type RacingHorseRow = HorseRow & { followers: number; trackingId: string | null; noRecentRuns?: boolean };
export type RacingHorsesParams = { offset: number; limit?: number; q?: string; codes: IndexCode[]; countries: Country[]; tracking?: boolean };

export type ManualInput = {
  name: string;
  breed?: string;
  sex?: string;
  foaledYear?: number | null;
  color?: string;
  sire?: string;
  dam?: string;
  trainer?: string;
  ownerName?: string;
  location?: string;
  notes?: string;
};
export type AddInput =
  | { source: "community"; communityHorseId: string; notes?: string }
  | { source: "racing"; racingHorseId: string; notes?: string }
  | ({ source: "manual" } & ManualInput)
  | { source: "formfav"; formfavName: string; formfavCode: IndexCode; notes?: string };
export type StateTarget = { communityHorseId?: string; racingHorseId?: string; formfav?: { name: string; code: IndexCode } };

export type EntryInput = {
  kind: EntryKind;
  entryDate: string;
  title?: string;
  track?: string;
  distance?: string;
  surface?: string;
  timeText?: string;
  finish?: number | null;
  fieldSize?: number | null;
  result?: string;
  hipNumber?: string;
  amountCents?: number | null;
  notes?: string;
};

type Client = {
  get: <T>(path: string, options?: { signal?: AbortSignal }) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  patch: <T>(path: string, body: unknown) => Promise<T>;
};

export const VIRTUAL_BASE: Record<VirtualMode, string> = {
  personal: "/api/my-racing/virtual",
  stable: "/api/workspace/virtual",
};

export function virtualApi(client: Client, base: string) {
  return {
    list: (signal?: AbortSignal) => client.get<{ horses: VirtualListHorse[]; limit: number }>(base, { signal }),
    get: (id: string, signal?: AbortSignal) => client.get<VirtualDetail>(`${base}/${id}`, { signal }),
    state: (target: StateTarget, signal?: AbortSignal) => {
      const query = target.communityHorseId
        ? `communityHorseId=${encodeURIComponent(target.communityHorseId)}`
        : target.formfav
          ? `formfavName=${encodeURIComponent(target.formfav.name)}&formfavCode=${encodeURIComponent(target.formfav.code)}`
          : `racingHorseId=${encodeURIComponent(target.racingHorseId ?? "")}`;
      return client.get<{ added: boolean; id: string | null }>(`${base}/state?${query}`, { signal });
    },
    add: (input: AddInput) => client.post<{ horse: VirtualHorse }>(base, input),
    update: (id: string, input: Partial<ManualInput>) => client.patch<{ horse: VirtualHorse }>(`${base}/${id}`, input),
    remove: (id: string) => client.post<{ ok: true }>(`${base}/${id}/remove`, {}),
    addEntry: (id: string, input: EntryInput) => client.post<{ entry: VirtualEntry }>(`${base}/${id}/entries`, input),
    updateEntry: (id: string, input: EntryInput) => client.patch<{ entry: VirtualEntry }>(`${base}/entries/${id}`, input),
    removeEntry: (id: string) => client.post<{ ok: true }>(`${base}/entries/${id}/remove`, {}),
    racingHorses: (p: RacingHorsesParams, signal?: AbortSignal) => {
      const q = new URLSearchParams();
      q.set("offset", String(p.offset));
      if (p.limit) q.set("limit", String(p.limit));
      if (p.q) q.set("q", p.q);
      q.set("codes", p.codes.join(","));
      q.set("countries", p.countries.join(","));
      if (p.tracking) q.set("tracking", "1");
      return client.get<ListPage<RacingHorseRow>>(`${base}/racing-horses?${q}`, { signal });
    },
    link: (id: string, target: { name: string; code: IndexCode }) => client.post<{ horse: VirtualHorse }>(`${base}/${id}/formfav`, target),
    unlink: (id: string) => client.post<{ horse: VirtualHorse }>(`${base}/${id}/formfav/remove`, {}),
    setAlerts: (id: string, on: boolean) => client.post<{ alertsOn: boolean }>(`${base}/${id}/alerts`, { on }),
  };
}
export type VirtualApi = ReturnType<typeof virtualApi>;

/** The personal list's calls, and the active stable's (scoped by header). */
export function useVirtualApis() {
  const stableApi = useStableApi();
  return useMemo(
    () => ({
      personal: virtualApi(api, VIRTUAL_BASE.personal),
      stable: virtualApi(stableApi, VIRTUAL_BASE.stable),
    }),
    [stableApi],
  );
}

/** Where a tracked horse opens. */
export const virtualHorsePath = (mode: VirtualMode, id: string, racing = false) =>
  (mode === "personal" ? `/my-racing?tab=virtual&horse=${id}` : `/workspace/virtual?horse=${id}`) + (racing ? "&vtab=racing" : "");

export const SOURCE_LABELS: Record<VirtualSource, string> = {
  community: "Stayblz member's horse",
  racing: "Racing data",
  manual: "Added by hand",
  formfav: "Race data",
};
/** Stayblz tracks and shows race data for the United States and Canada only ("US"/"USA", "CA"/"CAN", any case). */
export const isNorthAmerica = (country: string | null | undefined) => !!country && ["us", "ca", "usa", "can"].includes(country.trim().toLowerCase());

/** Details race data keeps up to date (and locks) while a horse is linked. */
export const LOCKED_BY_RACE_DATA = "Trainer, sire, dam, sex, foaling year and breed come from race data while the horse is linked.";
export const KIND_LABELS: Record<EntryKind, string> = { workout: "Workout", race: "Race", sale: "Sales entry", note: "Note" };
export const SALE_LABELS: Record<SaleResult, string> = {
  entered: "Entered",
  sold: "Sold",
  rna: "RNA (not sold)",
  withdrawn: "Withdrawn",
  private: "Private sale",
};

export const dollars = (cents: number | null | undefined) =>
  cents === null || cents === undefined
    ? "—"
    : (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const dayLabel = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
