import { MAX_FILE_BYTES } from "./types";

/** What chat accepts (must match ALLOWED_TYPES in the backend's lib/chatStorage.ts). */
export const ACCEPT_TYPES: Record<string, string> = {
  "image/jpeg": "Photo",
  "image/png": "Photo",
  "image/webp": "Photo",
  "image/gif": "GIF",
  "application/pdf": "PDF",
  "text/plain": "Text file",
  "text/csv": "CSV file",
  "application/msword": "Word document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
  "application/vnd.ms-excel": "Excel sheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel sheet",
};
export const ACCEPT_ATTR = Object.keys(ACCEPT_TYPES).join(",") + ",.csv,.txt,.doc,.docx,.xls,.xlsx,.pdf";

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
};
/** Browsers sometimes leave the type empty (CSV on Windows): fall back to the extension. */
export function fileType(file: File): string {
  if (file.type && ACCEPT_TYPES[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? file.type;
}

export interface PreparedFile {
  blob: Blob;
  name: string;
  type: string;
  width?: number;
  height?: number;
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

/**
 * Photos are shrunk to at most 1600 px and saved as JPEG (about 200–400 KB) before upload, to save
 * free-plan storage. GIFs and small images are sent as they are. Other files are checked, not changed.
 */
export async function prepareFile(file: File): Promise<PreparedFile> {
  const type = fileType(file);
  if (!ACCEPT_TYPES[type]) throw new Error("Send photos (JPG, PNG, WebP, GIF) or PDF, Word, Excel and text files.");
  if (!type.startsWith("image/")) {
    if (file.size > MAX_FILE_BYTES) throw new Error(`“${file.name}” is over 4 MB.`);
    return { blob: file, name: file.name, type };
  }
  const image = await loadImage(file).catch(() => null);
  if (!image) throw new Error(`“${file.name}” couldn't be opened as a photo.`);
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    if (type === "image/gif" || (scale === 1 && file.size <= 400_000)) {
      if (file.size > MAX_FILE_BYTES) throw new Error(`“${file.name}” is over 4 MB.`);
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
    if (!blob || blob.size > MAX_FILE_BYTES) throw new Error(`“${file.name}” is too large even after shrinking.`);
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
