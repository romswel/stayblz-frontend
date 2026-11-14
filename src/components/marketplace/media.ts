import { api } from "../../api";
import { MAX_VIDEO_SECONDS, type Listing, type ListingMedia } from "./options";

/**
 * Marketplace photos, videos and documents. Files are uploaded while the form is open and
 * attached when the listing is saved. They're served by the API after a sign-in check (never a
 * direct storage link).
 *
 * Same-origin paths only ("/api/..."), like the app's api helper: the site proxies /api to the
 * backend, and the Content-Security-Policy (connect-src/img-src 'self') blocks any other host.
 */
const BASE = "/api/marketplace";

export const mediaUrl = (fileId: string) => `${BASE}/media/${fileId}`;
export const posterUrl = (fileId: string) => `${BASE}/media/${fileId}/poster`;
/** The picture for a photo or video (a video without a poster has none). */
export const pictureUrl = (m: Pick<ListingMedia, "id" | "kind" | "poster">) =>
  m.kind === "photo" ? mediaUrl(m.id) : m.poster ? posterUrl(m.id) : null;

export type UploadedFile = {
  id: string;
  kind: "photo" | "video" | "document";
  width: number | null;
  height: number | null;
  duration?: number | null;
  poster?: boolean;
  name: string;
  size: number;
};

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

/** Progress callback: 0 to 1. */
type Progress = (fraction: number) => void;

/** Sends one file with upload progress (fetch can't report it). */
function send(query: Record<string, string>, body: Blob, type: string, onProgress?: Progress, path = `${BASE}/uploads`) {
  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams(query).toString();
    xhr.open("POST", params ? `${path}?${params}` : path);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", type);
    xhr.responseType = "json";
    if (onProgress) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const data = xhr.response ?? {};
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error ?? (xhr.status === 413 ? "That file is too big." : "The file couldn't be uploaded. Try again.")));
    };
    xhr.onerror = () => reject(new Error("The upload stopped. Check your connection and try again."));
    xhr.send(body);
  });
}

function fileOf(data: any): UploadedFile {
  if (!data?.file?.id) throw new Error("The file couldn't be uploaded. Try again.");
  return data.file;
}

/* ---------- Photos ---------- */

/**
 * Phone photos are resized in the browser (longest side 2048 px) so they upload quickly.
 * Anything that isn't JPG, PNG or WebP (GIF, for example) is converted to JPG.
 */
export async function preparePhoto(file: File): Promise<{ blob: Blob; type: string; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't a photo.`);
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error(`${file.name} couldn't be read. Try a JPG or PNG.`);
  const { width, height } = bitmap;
  const MAX = 2048;
  const keepType = /^image\/(jpeg|png|webp)$/.test(file.type);
  if (keepType && Math.max(width, height) <= MAX && file.size <= 3 * 1024 * 1024) {
    bitmap.close?.();
    return { blob: file, type: file.type, width, height };
  }
  const scale = Math.min(1, MAX / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
  if (!blob) throw new Error(`${file.name} couldn't be prepared.`);
  if (blob.size > MAX_PHOTO_BYTES) throw new Error(`${file.name} is too big (photos up to 8 MB).`);
  return { blob, type, width: w, height: h };
}

export async function uploadPhoto(file: File, onProgress?: Progress) {
  const photo = await preparePhoto(file);
  return fileOf(await send({ kind: "photo", width: String(photo.width), height: String(photo.height) }, photo.blob, photo.type, onProgress));
}

/* ---------- Videos ---------- */

/** The browser's type for a video file (some phones leave it empty for .mov). */
export function videoType(file: File) {
  if (VIDEO_TYPES.includes(file.type)) return file.type;
  if (/\.mov$/i.test(file.name)) return "video/quicktime";
  if (/\.mp4$|\.m4v$/i.test(file.name)) return "video/mp4";
  if (/\.webm$/i.test(file.name)) return "video/webm";
  return "";
}

/**
 * Reads a video's length and size, and captures a frame (about 1 second in) as its poster.
 * The poster is optional: some formats (HEVC .mov in Chrome, for example) can't be drawn here.
 */
export function inspectVideo(file: File): Promise<{ duration: number; width: number; height: number; poster: Blob | null }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    let settled = false;
    const finish = (result: { duration: number; width: number; height: number; poster: Blob | null } | Error) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      result instanceof Error ? reject(result) : resolve(result);
    };
    const timer = window.setTimeout(() => finish(new Error(`${file.name} couldn't be read.`)), 15_000);
    video.onerror = () => {
      window.clearTimeout(timer);
      // Can't decode it here, but the file may still play elsewhere (e.g. HEVC on iPhone). Length unknown.
      finish({ duration: 0, width: 0, height: 0, poster: null });
    };
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = Math.min(1, duration / 2 || 0);
    };
    video.onseeked = () => {
      window.clearTimeout(timer);
      const width = video.videoWidth;
      const height = video.videoHeight;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      if (!width || !height) return finish({ duration, width: 0, height: 0, poster: null });
      const scale = Math.min(1, 1280 / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      try {
        canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish({ duration, width, height, poster: blob }), "image/jpeg", 0.82);
      } catch {
        finish({ duration, width, height, poster: null });
      }
    };
    video.src = url;
  });
}

export async function uploadVideo(file: File, onProgress?: Progress) {
  const type = videoType(file);
  if (!type) throw new Error(`${file.name}: videos must be MP4, MOV or WebM.`);
  if (file.size > MAX_VIDEO_BYTES) throw new Error(`${file.name} is too big (videos up to 100 MB).`);
  const info = await inspectVideo(file);
  if (info.duration > MAX_VIDEO_SECONDS + 0.5) throw new Error(`${file.name} is longer than 3 minutes.`);
  const query: Record<string, string> = { kind: "video" };
  if (info.duration) query.duration = String(Math.round(info.duration));
  if (info.width) query.width = String(info.width);
  if (info.height) query.height = String(info.height);
  const uploaded = fileOf(await send(query, file, type, onProgress));
  if (info.poster) {
    // The video is already saved; a missing poster only means cards show a play icon instead.
    await send({}, info.poster, "image/jpeg", undefined, `${BASE}/uploads/${uploaded.id}/poster`)
      .then(() => (uploaded.poster = true))
      .catch(() => undefined);
  }
  return uploaded;
}

/* ---------- Documents ---------- */

export async function uploadDocument(file: File, onProgress?: Progress) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) throw new Error(`${file.name} isn't a PDF.`);
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error(`${file.name} is too big (documents up to 10 MB).`);
  return fileOf(await send({ kind: "document", name: file.name.slice(0, 160) }, file, "application/pdf", onProgress));
}

/** Drop an upload that hasn't been saved with the listing (Cancel, or removed before saving). */
export const removeUpload = (id: string) => api.post(`${BASE}/uploads/${id}/remove`, {}).catch(() => undefined);

export const getListing = (id: string, signal?: AbortSignal) =>
  api.get<{ listing: Listing }>(`${BASE}/listings/${id}`, { signal }).then((d) => {
    if (!d?.listing?.id) throw new Error("This listing couldn't be loaded.");
    return d.listing;
  });
