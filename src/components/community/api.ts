import { api } from "../../api";

/* ==========================================================================
   Stayblz Community — types and calls for /api/community.
   JSON calls go through the app's `api` helper. Photo uploads send the raw image
   bytes (like chat attachments), so they use fetch directly.
   ========================================================================== */

/**
 * Where the API lives. Photos are loaded with <img src> and uploads use fetch, so they
 * need a full path. Matches a same-origin `/api` (Vercel proxy); set VITE_API_URL if
 * your api.ts calls a different host in development.
 */
const API_BASE: string = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? "").replace(/\/$/, "");
export const apiUrl = (path: string) => `${API_BASE}${path}`;
export const horseImageUrl = (id: string) => apiUrl(`/api/community/media/horse/${id}`);
export const postImageUrl = (id: string) => apiUrl(`/api/community/media/post/${id}`);

export type Visibility = "members" | "followers" | "private";
export type HorseVisibility = "inherit" | Visibility;
export type HorseStatus = "racing" | "training" | "resting" | "injured" | "retired" | "for_sale" | "breeding";
export type HorseSex = "" | "colt" | "filly" | "mare" | "stallion" | "gelding" | "ridgling";
export type Surface = "" | "dirt" | "turf" | "synthetic";

export type Person = {
  id: string;
  name: string;
  headline: string;
  me: boolean;
  horses: number;
  starts: number;
  wins: number;
  /** null when the member hides earnings. */
  earningsCents: number | null;
  followers: number;
  followingCount: number;
  posts: number;
  isFollowing: boolean;
  followsYou: boolean;
  inventoryOpen: boolean;
  lastActive: string | null;
  joinedAt: string | null;
};
export type PersonLite = { id: string; name: string; headline: string; isFollowing: boolean; me: boolean };

export type HorseStats = {
  starts: number;
  wins: number;
  places: number;
  shows: number;
  earningsCents: number | null;
  lastRace: string | null;
};
export type Horse = {
  id: string;
  ownerId: string;
  name: string;
  breed: string;
  sex: HorseSex;
  foaledYear: number | null;
  color: string;
  sire: string;
  dam: string;
  status: HorseStatus;
  trainer: string;
  location: string;
  description: string;
  visibility?: HorseVisibility;
  coverImageId: string | null;
  imageCount?: number;
  stats: HorseStats;
  mine: boolean;
  createdAt: string;
  updatedAt: string;
};
export type HorseImage = { id: string; width: number | null; height: number | null; caption: string; position: number };
export type RaceRecord = {
  id: string;
  raceDate: string;
  track: string;
  raceName: string;
  distance: string;
  surface: Surface;
  finish: number | null;
  fieldSize: number | null;
  earningsCents: number | null;
  notes: string;
};
export type HorseDetail = Horse & {
  images: HorseImage[];
  records: RaceRecord[];
  owner: { id: string; name: string; headline: string; isFollowing: boolean; me: boolean };
};

export type PostKind = "update" | "horse_update" | "new_horse" | "result" | "achievement" | "announcement";
export type Post = {
  id: string;
  kind: PostKind;
  body: string;
  result: {
    raceDate: string;
    track: string;
    raceName: string;
    distance: string;
    surface: Surface;
    finish: number | null;
    fieldSize: number | null;
    earningsCents?: number;
  } | null;
  visibility: "members" | "followers";
  createdAt: string;
  editedAt: string | null;
  mine: boolean;
  author: { id: string; name: string; headline: string };
  horse: { id: string; name: string; breed: string; status: HorseStatus; coverImageId: string | null } | null;
  images: { id: string; width: number | null; height: number | null }[];
  likes: number;
  liked: boolean;
  comments: number;
};
export type Comment = { id: string; body: string; createdAt: string; author: { id: string; name: string }; canRemove: boolean };
export type SearchResults = {
  people: { id: string; name: string; headline: string; horses: number; me: boolean }[];
  horses: {
    id: string;
    name: string;
    breed: string;
    status: HorseStatus;
    coverImageId: string | null;
    owner: { id: string; name: string };
    mine: boolean;
  }[];
};
export type Settings = { headline: string; inventoryVisibility: Visibility; showEarnings: boolean; listed: boolean };
export type FeedPage = { posts: Post[]; next: string | null };

export type HorseInput = {
  name: string;
  breed: string;
  sex: HorseSex;
  foaledYear: number | null;
  color: string;
  sire: string;
  dam: string;
  status: HorseStatus;
  trainer: string;
  location: string;
  description: string;
  visibility: HorseVisibility;
};
export type RecordInput = {
  raceDate: string;
  track: string;
  raceName: string;
  distance: string;
  surface: Surface;
  finish: number | null;
  fieldSize: number | null;
  /** Dollars, as typed. */
  earnings: string;
  notes: string;
};

const BASE = "/api/community";
const q = (params: Record<string, string | number | null | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : "";
};

export const community = {
  me: () => api.get<{ settings: Settings; person: Person | null }>(`${BASE}/me`),
  search: (text: string, signal?: AbortSignal) => api.get<SearchResults>(`${BASE}/search${q({ q: text })}`, { signal }),
  saveSettings: (changes: Partial<Settings>) => api.patch<{ settings: Settings }>(`${BASE}/me/settings`, changes),

  people: (opts: { q?: string; sort?: string; offset?: number }, signal?: AbortSignal) =>
    api.get<{ people: Person[]; nextOffset: number | null }>(`${BASE}/people${q(opts)}`, { signal }),
  person: (id: string) => api.get<{ person: Person }>(`${BASE}/people/${id}`),
  personHorses: (id: string) => api.get<{ horses: Horse[]; restricted: boolean }>(`${BASE}/people/${id}/horses`),
  personPosts: (id: string, before?: string | null) => api.get<FeedPage>(`${BASE}/people/${id}/posts${q({ before })}`),
  followers: (id: string, offset = 0) => api.get<{ people: PersonLite[]; nextOffset: number | null }>(`${BASE}/people/${id}/followers${q({ offset })}`),
  following: (id: string, offset = 0) => api.get<{ people: PersonLite[]; nextOffset: number | null }>(`${BASE}/people/${id}/following${q({ offset })}`),
  follow: (id: string, on: boolean) =>
    api.post<{ isFollowing: boolean; followers: number }>(`${BASE}/people/${id}/${on ? "follow" : "unfollow"}`, {}),

  horse: (id: string) => api.get<{ horse: HorseDetail }>(`${BASE}/horses/${id}`),
  horsePosts: (id: string, before?: string | null) => api.get<FeedPage>(`${BASE}/horses/${id}/posts${q({ before })}`),
  createHorse: (input: HorseInput & { share?: boolean; shareText?: string }) =>
    api.post<{ horse: Horse; shared: boolean }>(`${BASE}/horses`, input),
  updateHorse: (id: string, input: HorseInput) => api.patch<{ horse: Horse }>(`${BASE}/horses/${id}`, input),
  removeHorse: (id: string) => api.post<{ ok: true }>(`${BASE}/horses/${id}/remove`, {}),
  removeHorseImage: (horseId: string, imageId: string) =>
    api.post<{ ok: true; coverImageId: string | null }>(`${BASE}/horses/${horseId}/images/${imageId}/remove`, {}),
  orderHorseImages: (horseId: string, ids: string[]) => api.post<{ ok: true }>(`${BASE}/horses/${horseId}/images/order`, { ids }),
  setCover: (horseId: string, imageId: string) => api.post<{ coverImageId: string }>(`${BASE}/horses/${horseId}/cover`, { imageId }),

  addRecord: (horseId: string, input: RecordInput & { share?: boolean; shareText?: string }) =>
    api.post<{ record: RaceRecord; stats: HorseStats; shared: boolean }>(`${BASE}/horses/${horseId}/records`, input),
  updateRecord: (id: string, input: RecordInput) => api.patch<{ record: RaceRecord; stats: HorseStats | null }>(`${BASE}/records/${id}`, input),
  removeRecord: (id: string) => api.post<{ ok: true; stats: HorseStats | null }>(`${BASE}/records/${id}/remove`, {}),

  feed: (scope: "all" | "following", before?: string | null, signal?: AbortSignal) =>
    api.get<FeedPage>(`${BASE}/feed${q({ scope, before })}`, { signal }),
  newCount: (scope: "all" | "following", since: string) => api.get<{ count: number }>(`${BASE}/feed/new${q({ scope, since })}`),
  createPost: (input: { body: string; kind?: "update" | "announcement"; horseId?: string | null; visibility?: "members" | "followers"; imageIds?: string[] }) =>
    api.post<{ post: Post }>(`${BASE}/posts`, input),
  editPost: (id: string, body: string) => api.patch<{ post: Post }>(`${BASE}/posts/${id}`, { body }),
  removePost: (id: string) => api.post<{ ok: true }>(`${BASE}/posts/${id}/remove`, {}),
  like: (id: string, on: boolean) => api.post<{ liked: boolean; likes: number }>(`${BASE}/posts/${id}/like`, { on }),
  comments: (id: string) => api.get<{ comments: Comment[] }>(`${BASE}/posts/${id}/comments`),
  addComment: (id: string, body: string) => api.post<{ comment: Comment }>(`${BASE}/posts/${id}/comments`, { body }),
  removeComment: (id: string) => api.post<{ ok: true }>(`${BASE}/comments/${id}/remove`, {}),
  removeUpload: (id: string) => api.post<{ ok: true }>(`${BASE}/uploads/${id}/remove`, {}),
};

/* ---------- Photo uploads ---------- */

/**
 * Large photos are resized in the browser (longest side 2048px) before upload, so phone
 * pictures upload quickly and stay under the 6 MB limit. GIFs are sent as they are.
 */
export async function preparePhoto(file: File): Promise<{ blob: Blob; type: string; width: number; height: number }> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("Choose a JPG, PNG, WebP or GIF photo.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That photo couldn't be read.");
  const { width, height } = bitmap;
  const MAX = 2048;
  if (file.type === "image/gif" || (Math.max(width, height) <= MAX && file.size <= 2.5 * 1024 * 1024)) {
    bitmap.close?.();
    if (file.size > 6 * 1024 * 1024) throw new Error("Photos can be up to 6 MB.");
    return { blob: file, type: file.type, width, height };
  }
  const scale = Math.min(1, MAX / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  if (!blob) throw new Error("That photo couldn't be prepared.");
  if (blob.size > 6 * 1024 * 1024) throw new Error("Photos can be up to 6 MB.");
  return { blob, type, width: w, height: h };
}

async function uploadRaw<T>(path: string, file: File, extra: Record<string, string> = {}): Promise<T> {
  const photo = await preparePhoto(file);
  const response = await fetch(apiUrl(`${path}${q({ width: photo.width, height: photo.height, ...extra })}`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": photo.type },
    body: photo.blob,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error ?? "The photo couldn't be uploaded. Try again.");
  return data as T;
}

export const uploadHorseImage = (horseId: string, file: File) =>
  uploadRaw<{ image: HorseImage; coverImageId: string }>(`${BASE}/horses/${horseId}/images`, file);
export const uploadPostImage = (file: File) =>
  uploadRaw<{ image: { id: string; width: number | null; height: number | null } }>(`${BASE}/uploads`, file);

/* ---------- Formatting ---------- */

export const STATUS_LABELS: Record<HorseStatus, string> = {
  racing: "Racing",
  training: "In training",
  resting: "Resting",
  injured: "Injured",
  retired: "Retired",
  for_sale: "For sale",
  breeding: "Breeding",
};
export const SEX_LABELS: Record<HorseSex, string> = {
  "": "—",
  colt: "Colt",
  filly: "Filly",
  mare: "Mare",
  stallion: "Stallion",
  gelding: "Gelding",
  ridgling: "Ridgling",
};
export const SURFACE_LABELS: Record<Surface, string> = { "": "—", dirt: "Dirt", turf: "Turf", synthetic: "Synthetic" };
export const VISIBILITY_LABELS: Record<HorseVisibility, string> = {
  inherit: "Same as my inventory",
  members: "Everyone on Stayblz",
  followers: "Only my followers",
  private: "Only me",
};

export const money = (cents: number | null | undefined, compact = false) =>
  cents === null || cents === undefined
    ? "Hidden"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: compact && cents >= 100_000_00 ? 1 : 0,
        notation: compact && cents >= 100_000_00 ? "compact" : "standard",
      }).format(cents / 100);

export const ageOf = (year: number | null) => (year ? `${Math.max(0, new Date().getFullYear() - year)} yrs` : "—");

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  if (diff < 7 * 86400) return `${Math.round(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: diff > 300 * 86400 ? "numeric" : undefined });
}

export const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);