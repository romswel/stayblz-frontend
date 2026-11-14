import { useEffect, useSyncExternalStore } from "react";
import { API_BASE, api, apiRaw } from "../../api";

/* ==========================================================================
   Profile pictures (/api/avatars). Pages ask "does this person have a picture?" through
   useAvatar(id); the questions are batched into one lookup (up to 100 people) and the
   answers are kept for the visit. No picture, or any failure, simply shows initials.
   A picture's address includes its version, so a new picture shows up straight away.
   ========================================================================== */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const known = new Map<string, string | null>(); // account id → version, or null = no picture
const waiting = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let snapshot = 0;

function notify() {
  snapshot++;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function flush() {
  timer = null;
  const ids = [...waiting].slice(0, 100);
  ids.forEach((id) => waiting.delete(id));
  if (waiting.size) timer = setTimeout(flush, 0);
  // apiRaw, not api.get: a failed lookup must stay quiet (initials), never raise the app-wide
  // "can't reach Stayblz" notice that api.get shows for 502–504 answers.
  apiRaw(`/api/avatars/lookup?ids=${ids.join(",")}`)
    .then((response) => response.json() as Promise<{ avatars?: Record<string, string> }>)
    .then((result) => ids.forEach((id) => known.set(id, result?.avatars?.[id] ?? null)))
    .catch(() => ids.forEach((id) => known.set(id, null)))
    .finally(notify);
}

function request(id: string) {
  if (known.has(id) || waiting.has(id) || !UUID.test(id)) return;
  waiting.add(id);
  if (!timer) timer = setTimeout(flush, 25);
}

export const avatarUrl = (id: string, version: string) => `${API_BASE}/api/avatars/${id}/${version}`;

/** The picture's address for this account, or null (show initials). */
export function useAvatar(id: string | null | undefined): string | null {
  useSyncExternalStore(subscribe, () => snapshot);
  const key = id?.toLowerCase();
  useEffect(() => {
    if (key) request(key);
  }, [key]);
  const version = key ? known.get(key) : null;
  return key && version ? avatarUrl(key, version) : null;
}

/** After uploading or removing your own picture. */
export function setAvatarVersion(id: string, version: string | null) {
  known.set(id.toLowerCase(), version);
  notify();
}

/**
 * Square, 512px JPEG made in the browser: phone photos upload quickly and look the same
 * everywhere. Centre-cropped; transparent PNGs get a white background.
 */
export async function prepareAvatar(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP photo.");
  if (file.size > 20 * 1024 * 1024) throw new Error("That photo is too large. Choose one under 20 MB.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That photo couldn't be read.");
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(512, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("That photo couldn't be prepared.");
  if (blob.size > 2 * 1024 * 1024) throw new Error("Profile pictures can be up to 2 MB.");
  return blob;
}

/** Upload (or replace) your picture; returns its new version. */
export async function uploadAvatar(myId: string, file: File): Promise<string> {
  const blob = await prepareAvatar(file);
  const response = await apiRaw("/api/avatars/me", {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: blob,
  });
  const { avatar } = (await response.json()) as { avatar: string };
  setAvatarVersion(myId, avatar);
  return avatar;
}

export async function removeAvatar(myId: string): Promise<void> {
  await api.post("/api/avatars/me/remove", {});
  setAvatarVersion(myId, null);
}
