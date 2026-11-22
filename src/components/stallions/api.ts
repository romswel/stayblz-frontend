import { API_BASE, api } from "../../api";
import type { MediaApi } from "../marketplace/media";
import type {
  BreedingRequest,
  MareDraft,
  Match,
  MatingReport,
  MyStallion,
  Pedigree,
  RacingHorse,
  SavedMare,
  SearchResult,
  StallionProfile,
} from "./types";

/** Same-origin paths (the site proxies /api). Public reads need no sign-in; the rest do. */
const PUBLIC = "/api/public/stallions";
const MINE = "/api/stallions";

/**
 * Uploads go to the signed-in API; files on pages are read from the public one (published = public). File links
 * (img/video src) carry API_BASE: empty in production (same-origin /api), the API host in local development.
 */
const FILES = `${API_BASE}${PUBLIC}`;
export const STALLION_MEDIA: MediaApi = { uploads: MINE, media: FILES };
export const stallionMediaUrl = (id: string) => `${FILES}/media/${id}`;
export const stallionPicture = (m: { id: string; kind: "photo" | "video"; poster?: boolean } | null | undefined) =>
  !m ? null : m.kind === "photo" ? `${FILES}/media/${m.id}` : m.poster ? `${FILES}/media/${m.id}/poster` : null;

/** The form as the API reads it. */
export interface StallionInput {
  name: string;
  breed: string;
  registry: string;
  registration: string;
  foaled: number | null;
  country: string;
  color: string;
  heightIn: number | null;
  farm: string;
  location: string;
  region: string;
  seasonYear: number;
  fee: number | null;
  feeCurrency: string;
  feeTerms: string;
  feeNote: string;
  bookingFee: number | null;
  availability: string;
  methods: string[];
  shippingNote: string;
  firstSeason: number | null;
  programs: string;
  pedigree: Pedigree;
  raceRecord: { starts?: number | null; wins?: number | null; places?: number | null; shows?: number | null; earnings?: number | null; currency?: string };
  highlights: string[];
  genetics: Record<string, number>;
  fertilityRate: number | null;
  fertilityNote: string;
  description: string;
  racingHorseId: string | null;
  inquiriesOpen: boolean;
  confirm: boolean;
  mediaIds: string[];
  documentIds: string[];
  publish?: boolean;
}

export const stallionsApi = {
  search: (query: string, signal?: AbortSignal) => api.get<SearchResult>(`${PUBLIC}${query ? `?${query}` : ""}`, { signal }),
  profile: (id: string, opts: { view?: boolean; signal?: AbortSignal } = {}) =>
    api.get<{ stallion: StallionProfile }>(`${PUBLIC}/${id}${opts.view ? "?view=1" : ""}`, { signal: opts.signal }).then((d) => d.stallion),
  compare: (ids: string[], signal?: AbortSignal) =>
    api.get<{ stallions: StallionProfile[] }>(`${PUBLIC}/compare?ids=${ids.map(encodeURIComponent).join(",")}`, { signal }).then((d) => d.stallions ?? []),
  lookup: (q: string, sex: "female" | "male" | "" = "", signal?: AbortSignal) =>
    api.get<{ horses: RacingHorse[] }>(`${PUBLIC}/lookup?q=${encodeURIComponent(q)}${sex ? `&sex=${sex}` : ""}`, { signal }).then((d) => d.horses ?? []),
  fillPedigree: (body: { name?: string; pedigree: Pedigree; depth: 3 | 4 }) =>
    api.post<{ pedigree: Pedigree; filled: string[]; sources: string[] }>(`${PUBLIC}/pedigree-fill`, body),
  mating: (id: string, mare: { mareId: string } | { mare: MareDraft }) =>
    api.post<{ report: MatingReport }>(`${PUBLIC}/${id}/mating`, mare).then((d) => d.report),
  matches: (body: ({ mareId: string } | { mare: MareDraft }) & { sort?: string; sameBreed?: boolean }) =>
    api.post<{ mare: { name: string; breed: string; sire: string; dam: string }; matches: Match[]; total: number }>(`${PUBLIC}/matches`, body),

  mine: () => api.get<{ stallions: MyStallion[]; access: { allowed: boolean; plan?: string }; writer: boolean }>(`${MINE}/mine`),
  create: (body: StallionInput) => api.post<{ stallion: StallionProfile }>(MINE, body).then((d) => d.stallion),
  update: (id: string, body: StallionInput) => api.patch<{ stallion: StallionProfile }>(`${MINE}/${id}`, body).then((d) => d.stallion),
  publish: (id: string, publish: boolean) => api.post<{ stallion: StallionProfile }>(`${MINE}/${id}/publish`, { publish }).then((d) => d.stallion),
  remove: (id: string) => api.post(`${MINE}/${id}/remove`, {}),
  moderate: (id: string, hidden: boolean, reason: string) =>
    api.post<{ stallion: StallionProfile }>(`${MINE}/${id}/moderate`, { hidden, reason }).then((d) => d.stallion),
  save: (id: string, on: boolean) => api.post<{ saved: boolean; saves: number }>(`${MINE}/${id}/save`, { on }),
  request: (id: string, body: { message: string; clientId: string; seasonYear: number | null; method: string; mare: Record<string, unknown> }) =>
    api.post<{ conversationId: string; requestId: string }>(`${MINE}/${id}/request`, body),
  requests: (side: "received" | "sent") => api.get<{ requests: BreedingRequest[] }>(`${MINE}/requests?side=${side}`).then((d) => d.requests ?? []),
  updateRequest: (id: string, change: { status?: string; ownerNote?: string }) =>
    api.patch<{ request: { id: string; status: BreedingRequest["status"]; ownerNote: string } }>(`${MINE}/requests/${id}`, change).then((d) => d.request),
  mares: () => api.get<{ mares: SavedMare[] }>(`${MINE}/mares`).then((d) => d.mares ?? []),
  addMare: (m: MareDraft & { color?: string; notes?: string }) => api.post<{ mare: SavedMare }>(`${MINE}/mares`, m).then((d) => d.mare),
  updateMare: (id: string, m: MareDraft & { color?: string; notes?: string }) =>
    api.patch<{ mare: SavedMare }>(`${MINE}/mares/${id}`, m).then((d) => d.mare),
  removeMare: (id: string) => api.post(`${MINE}/mares/${id}/remove`, {}),
  writeDescription: (form: Partial<StallionInput>) => api.post<{ description: string }>(`${MINE}/write-description`, form).then((d) => d.description),
};

/* ---------- Compare tray (kept in this browser) ---------- */
const COMPARE_KEY = "stayblz.stallions.compare";
export const COMPARE_MAX = 3;
export function readCompare(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(COMPARE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}
export function writeCompare(ids: string[]) {
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.slice(0, COMPARE_MAX)));
  } catch {
    /* storage blocked: the tray still works for this page */
  }
  window.dispatchEvent(new Event("stallions-compare"));
}
