import { api } from "./api";
import type { User } from "./types";
// Capture once before React mounts, then remove one-time credentials from the URL.
const url = new URL(window.location.href);
const hash = new URLSearchParams(url.hash.slice(1));
const providerErrorCode =
  hash.get("error_code") || url.searchParams.get("error_code");
const hasProviderError =
  hash.has("error") ||
  hash.has("error_code") ||
  url.searchParams.has("error") ||
  url.searchParams.has("error_code");
const isCallback =
  url.pathname === "/auth/confirm" ||
  (hash.has("access_token") && hash.has("refresh_token")) ||
  (url.pathname === "/" && hasProviderError);
const callbackError = hasProviderError
  ? providerErrorCode === "otp_expired"
    ? "This email link has expired or was already used. Request a new confirmation or reset email."
    : "The email link could not be verified. Request a new email and try again."
  : null;
export const isPasswordRecovery =
  isCallback &&
  (url.searchParams.get("recovery") === "1" ||
    hash.get("type") === "recovery" ||
    hash.get("type") === "invite" ||
    url.searchParams.get("type") === "invite" ||
    url.searchParams.get("type") === "recovery");
let payload: Record<string, string> | null = null;
if (isCallback) {
  if (url.searchParams.get("token_hash"))
    payload = {
      tokenHash: url.searchParams.get("token_hash")!,
      type: url.searchParams.get("type") || "email",
    };
  else if (hash.get("access_token") && hash.get("refresh_token"))
    payload = {
      accessToken: hash.get("access_token")!,
      refreshToken: hash.get("refresh_token")!,
    };
  window.history.replaceState({}, "", "/auth/confirm");
}
let pending: Promise<{ user: User }> | null = null;
export function confirmAccount() {
  if (pending) return pending;
  if (callbackError) return Promise.reject(new Error(callbackError));
  if (!payload)
    return Promise.reject(
      new Error("Open the latest confirmation email and use its link."),
    );
  pending = api.post<{ user: User }>("/api/auth/confirm", payload);
  payload = null;
  return pending;
}
