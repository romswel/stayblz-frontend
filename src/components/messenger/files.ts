import { MAX_FILE_BYTES } from "./types";

/** What chat accepts (must match ALLOWED_TYPES in the backend's lib/chatStorage.ts). */
export const ACCEPT_TYPES: Record<string, string> = {
  "image/jpeg": "Photo",
  "image/png": "Photo",
  "image/webp": "Photo",
  "image/gif": "GIF",
  "video/mp4": "Video",
  "video/quicktime": "Video",
  "video/webm": "Video",
  "audio/webm": "Voice clip",
  "audio/ogg": "Voice clip",
  "audio/mp4": "Voice clip",
  "audio/mpeg": "Audio",
  "application/pdf": "PDF",
  "text/plain": "Text file",
  "text/csv": "CSV file",
  "application/msword": "Word document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "application/vnd.ms-excel": "Excel sheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel sheet",
};
export const ACCEPT_ATTR =
  Object.keys(ACCEPT_TYPES).filter((t) => !t.startsWith("audio/")).join(",") + ",.csv,.txt,.doc,.docx,.xls,.xlsx,.pdf,.mov,.mp4";
export const MEDIA_ATTR = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,.mov";

const BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  txt: "text/plain",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
};
/** Browsers sometimes leave the type empty (CSV on Windows, MOV on some phones): fall back to the extension. */
export function fileType(file: File): string {
  const bare = (file.type || "").split(";")[0].trim().toLowerCase();
  if (bare && ACCEPT_TYPES[bare]) return bare;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? bare;
}

/** Where the server keeps files right now and how big they may be (GET /api/messages/people/profile). */
export interface ChatLimits {
  storage: "r2" | "supabase";
  fileBytes: number;
  quotaBytes: number;
}
export const DEFAULT_LIMITS: ChatLimits = { storage: "supabase", fileBytes: MAX_FILE_BYTES, quotaBytes: 50 * 1024 * 1024 };
let limits: ChatLimits = DEFAULT_LIMITS;
export const chatLimits = () => limits;
export function setChatLimits(next: Partial<ChatLimits> | null | undefined) {
  if (next && typeof next.fileBytes === "number" && typeof next.quotaBytes === "number")
    limits = { storage: next.storage === "r2" ? "r2" : "supabase", fileBytes: next.fileBytes, quotaBytes: next.quotaBytes };
}
const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

/**
 * Why this file can't be sent, said at once (before anything uploads), or null. Photos are shrunk on the way, so
 * only GIFs among them are size-checked here; prepareFile still checks everything again when it's sent.
 */
export function fileProblem(file: File): string | null {
  const type = fileType(file);
  const max = limits.fileBytes;
  if (!ACCEPT_TYPES[type]) return `“${file.name}” can't be sent. Send photos, videos, voice clips, or PDF, Word, Excel and text files.`;
  if (type.startsWith("image/") && type !== "image/gif") return null;
  if (file.size > max) return type.startsWith("video/") ? `“${file.name}” is over ${mb(max)}. Videos can be up to ${mb(max)}.` : `“${file.name}” is over ${mb(max)}.`;
  return null;
}

/** A file waiting in the message box (dragged in, pasted or picked) until you press Send. */
export interface StagedFile {
  id: string;
  file: File;
  type: string;
  /** Photos and videos: a preview of this device's copy (revoked when it's removed or sent). */
  url?: string;
}
let staged = 0;
export function stageFile(file: File): StagedFile {
  const type = fileType(file);
  const visual = type.startsWith("image/") || type.startsWith("video/");
  return { id: `staged-${++staged}`, file, type, url: visual ? URL.createObjectURL(file) : undefined };
}

export interface PreparedFile {
  blob: Blob;
  name: string;
  type: string;
  width?: number;
  height?: number;
  duration?: number;
}

const MAX_SIDE = 1600;

async function loadImage(file: Blob): Promise<{ draw: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { draw: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("bad_image"));
    img.src = url;
  });
  return { draw: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

/** A video's size and length, read by the browser (best effort; a phone format it can't read just has none). */
function videoInfo(file: Blob): Promise<{ width?: number; height?: number; duration?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (info: { width?: number; height?: number; duration?: number }) => {
      URL.revokeObjectURL(url);
      resolve(info);
    };
    const timer = window.setTimeout(() => done({}), 4000);
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined;
      done({ width: video.videoWidth || undefined, height: video.videoHeight || undefined, duration });
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      done({});
    };
    video.src = url;
  });
}

/**
 * Photos are shrunk to at most 1600 px and saved as JPEG (about 200–400 KB) before upload, to save storage.
 * GIFs and small images are sent as they are. Videos, voice clips and other files are checked, not changed.
 */
export async function prepareFile(file: File, extra: { duration?: number } = {}): Promise<PreparedFile> {
  const type = fileType(file);
  const max = limits.fileBytes;
  if (!ACCEPT_TYPES[type]) throw new Error("Send photos, videos, voice clips, or PDF, Word, Excel and text files.");
  if (type.startsWith("video/")) {
    if (file.size > max) throw new Error(`“${file.name}” is over ${mb(max)}. Videos can be up to ${mb(max)}.`);
    const info = await videoInfo(file);
    return { blob: file, name: file.name, type, ...info };
  }
  if (type.startsWith("audio/")) {
    if (file.size > max) throw new Error(`That clip is over ${mb(max)}.`);
    return { blob: file, name: file.name, type, duration: extra.duration };
  }
  if (!type.startsWith("image/")) {
    if (file.size > max) throw new Error(`“${file.name}” is over ${mb(max)}.`);
    return { blob: file, name: file.name, type };
  }
  const image = await loadImage(file).catch(() => null);
  if (!image) throw new Error(`“${file.name}” couldn't be opened as a photo.`);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    if (type === "image/gif" || (scale === 1 && file.size <= 400_000)) {
      if (file.size > max) throw new Error(`“${file.name}” is over ${mb(max)}.`);
      return { blob: file, name: file.name, type, width: image.width, height: image.height };
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("bad_canvas");
    ctx.fillStyle = "#ffffff"; // transparent PNGs get a white background, not black
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image.draw, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size > max) throw new Error(`“${file.name}” is too large even after shrinking.`);
    return { blob, name: file.name.replace(/\.[^.]+$/, "") + ".jpg", type: "image/jpeg", width, height };
  } finally {
    image.close();
  }
}

/** Small in-memory cache of downloaded chat files (as blob: URLs), so scrolling doesn't re-download. */
const cache = new Map<string, Promise<string>>();
export function cachedFileUrl(key: string, load: () => Promise<Blob>): Promise<string> {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const promise = load().then((blob) => URL.createObjectURL(blob));
  promise.catch(() => cache.delete(key));
  cache.set(key, promise);
  while (cache.size > 80) {
    const [oldKey, old] = cache.entries().next().value as [string, Promise<string>];
    cache.delete(oldKey);
    void old.then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
  }
  return promise;
}
