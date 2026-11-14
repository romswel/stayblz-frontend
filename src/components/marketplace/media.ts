import { api } from "../../api";
import type { Listing } from "./options";

/**
 * Marketplace photos and documents. Files are uploaded while the form is open and attached
 * when the listing is saved. They're served by the API after a sign-in check (never a direct
 * storage link).
 *
 * Same-origin paths only ("/api/..."), like the app's api helper: the site proxies /api to the
 * backend, and the Content-Security-Policy (connect-src/img-src 'self') blocks any other host.
 */
const BASE = "/api/marketplace";
const url = (path: string) => path;

export const mediaUrl = (fileId: string) => url(`${BASE}/media/${fileId}`);

export type UploadedFile = {
  id: string;
  kind: "photo" | "document";
  width: number | null;
  height: number | null;
  name: string;
  size: number;
};

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

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

async function send(query: Record<string, string>, body: Blob, type: string, signal?: AbortSignal): Promise<UploadedFile> {
  const params = new URLSearchParams(query).toString();
  const response = await fetch(url(`${BASE}/uploads?${params}`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": type },
    body,
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error ?? "The file couldn't be uploaded. Try again.");
  const file = (data as { file?: UploadedFile }).file;
  if (!file?.id) throw new Error("The file couldn't be uploaded. Try again.");
  return file;
}

export async function uploadPhoto(file: File, signal?: AbortSignal) {
  const photo = await preparePhoto(file);
  return send({ kind: "photo", width: String(photo.width), height: String(photo.height) }, photo.blob, photo.type, signal);
}

export async function uploadDocument(file: File, signal?: AbortSignal) {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) throw new Error(`${file.name} isn't a PDF.`);
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error(`${file.name} is too big (documents up to 10 MB).`);
  return send({ kind: "document", name: file.name.slice(0, 160) }, file, "application/pdf", signal);
}

/** Drop an upload that hasn't been saved with the listing (Cancel, or removed before saving). */
export const removeUpload = (id: string) => api.post(`${BASE}/uploads/${id}/remove`, {}).catch(() => undefined);

export const getListing = (id: string, signal?: AbortSignal) =>
  api.get<{ listing: Listing }>(`${BASE}/listings/${id}`, { signal }).then((d) => {
    if (!d?.listing?.id) throw new Error("This listing couldn't be loaded.");
    return d.listing;
  });