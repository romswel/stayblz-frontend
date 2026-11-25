import { netStatus } from "./netStatus";

const TOKEN_KEY = "stayblz.token";
let memoryToken: string | null = null;

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    return import.meta.env.DEV ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token && import.meta.env.DEV) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Production sessions use HttpOnly cookies. */
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  retryAfterSeconds: number;
  constructor(
    status: number,
    message: string,
    code?: string,
    retryAfterSeconds = 0,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Production uses the same-origin /api proxy for HttpOnly session cookies.
// VITE_API_URL only overrides the API host during local development.
export const API_BASE = import.meta.env.PROD
  ? ""
  : (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

/** Friendly words for failures. Raw server or browser errors are never shown. What each one means: /status. */
export const friendly = {
  network:
    "We can't reach Stayblz right now. Check your internet connection and try again.",
  starting:
    "Stayblz's server isn't answering right now. It may be restarting. Please try again in a minute.",
  timeout: "Stayblz is taking too long to answer. Please try again in a moment.",
  server: "Something went wrong on our side. Please try again.",
  notFound: "We couldn't find what you were looking for.",
  unavailable: "This feature isn't available yet.",
  signedOut: "Your session has ended. Please log in again.",
  forbidden: "You don't have access to this.",
  conflict: "This changed while you were working. Reload and try again.",
  tooLarge: "That's too large to send. Try a smaller file or a shorter text.",
  busy: (seconds: number) =>
    `Too many requests in a short time. Please wait ${
      seconds >= 90 ? `${Math.ceil(seconds / 60)} minutes` : `${Math.max(1, seconds)} seconds`
    } and try again.`,
};

/** Normal requests give up after this long (a server that hangs must not leave a page spinning for ever). */
export const REQUEST_TIMEOUT_MS = 45_000;

/** Words for an answer without a usable message from the server. */
function wordsFor(status: number, retryAfter = 0): string {
  if (status === 401) return friendly.signedOut;
  if (status === 402) return friendly.unavailable;
  if (status === 403) return friendly.forbidden;
  if (status === 404) return friendly.notFound;
  if (status === 409) return friendly.conflict;
  if (status === 413) return friendly.tooLarge;
  if (status === 429) return friendly.busy(retryAfter || 60);
  if ([502, 503, 504].includes(status)) return friendly.starting;
  if (status >= 500) return friendly.server;
  return "Something went wrong. Please try again.";
}

/** A signal that aborts after `ms`, or when the caller's own signal does. `timedOut()` tells which. */
function timeoutSignal(ms: number, outer?: AbortSignal | null) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const onAbort = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", onAbort);
    },
  };
}

let refreshPending: Promise<boolean> | null = null;
async function request<T>(
  path: string,
  options: RequestInit & { longPoll?: boolean; timeoutMs?: number } = {},
  renewed = false,
): Promise<T> {
  const token = getToken();
  // A long-poll waits on the server on purpose: it must never count as "slow" (the "Still working…" notice).
  const { longPoll, timeoutMs, ...init } = options;
  options = init;
  const settle = longPoll ? () => undefined : netStatus.track();
  // Long-polls are held up to 15 s by the server; everything else should answer well inside the limit.
  const limit = timeoutSignal(timeoutMs ?? REQUEST_TIMEOUT_MS, options.signal);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: limit.signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (limit.timedOut()) {
      netStatus.unreachable();
      throw new ApiError(0, friendly.timeout, "timeout");
    }
    // Cancelled on purpose: let callers see the abort as before.
    if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError"))
      throw error;
    netStatus.unreachable();
    throw new ApiError(0, friendly.network, "network");
  } finally {
    limit.done();
    settle();
  }
  if ([502, 503, 504].includes(res.status)) netStatus.unreachable();
  else netStatus.reachable();
  if (
    res.status === 401 &&
    !path.startsWith("/api/auth/") &&
    !renewed &&
    !options.signal?.aborted
  ) {
    if (!refreshPending)
      refreshPending = fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
        .then((response) => response.ok)
        .catch(() => false)
        .finally(() => {
          refreshPending = null;
        });
    if (await refreshPending) return request<T>(path, { ...options, longPoll, timeoutMs }, true);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    // Not our JSON: a proxy page, a sleeping server, or a missing route.
    throw new ApiError(
      res.status,
      res.ok ? friendly.server : wordsFor(res.status, 60),
      [502, 503, 504].includes(res.status) ? "server_unavailable" : res.status === 429 ? "rate_limited" : undefined,
      res.status === 503 ? 15 : res.status === 429 ? 60 : 0,
    );
  }
  if (!res.ok) {
    const details =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const rawRetryHeader = res.headers.get("Retry-After");
    const retryHeader =
      rawRetryHeader && !/^\d+$/.test(rawRetryHeader.trim())
        ? (Date.parse(rawRetryHeader) - Date.now()) / 1000
        : Number(rawRetryHeader);
    const retryBody =
      typeof details.retryAfterSeconds === "number"
        ? details.retryAfterSeconds
        : 0;
    const told = Math.max(0, Number.isFinite(retryHeader) ? retryHeader : 0, Number.isFinite(retryBody) ? retryBody : 0);
    // "Too many" without a wait from the server: a minute.
    const retry = Math.min(86400, told || (res.status === 429 ? 60 : 0));
    const serverWords = typeof details.error === "string" ? details.error.trim() : "";
    // The API's own words, except its general "too many" line: then say how long to wait.
    const message =
      res.status === 429 && (!serverWords || serverWords === "Too many attempts. Please try again later.")
        ? friendly.busy(Math.ceil(retry))
        : serverWords || wordsFor(res.status, Math.ceil(retry));
    throw new ApiError(
      res.status,
      message,
      typeof details.code === "string"
        ? details.code
        : res.status === 402
          ? "feature_unavailable"
          : res.status === 429
            ? "rate_limited"
            : undefined,
      Math.ceil(retry),
    );
  }
  return data as T;
}

/**
 * Raw request with the same session handling as `api` (cookie or dev token, one silent session
 * renewal on 401). For bodies and answers that aren't JSON: chat file uploads and downloads.
 * Errors still come back as friendly `ApiError`s.
 */
export async function apiRaw(path: string, init: RequestInit = {}, renewed = false): Promise<Response> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  } catch (error) {
    if (init.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
    netStatus.unreachable();
    throw new ApiError(0, friendly.network, "network");
  }
  if (res.status === 401 && !renewed && !init.signal?.aborted) {
    if (!refreshPending)
      refreshPending = fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      })
        .then((response) => response.ok)
        .catch(() => false)
        .finally(() => {
          refreshPending = null;
        });
    if (await refreshPending) return apiRaw(path, init, true);
  }
  if ([502, 503, 504].includes(res.status)) netStatus.unreachable();
  else netStatus.reachable();
  if (!res.ok) {
    let details: Record<string, unknown> = {};
    try {
      details = (await res.json()) as Record<string, unknown>;
    } catch {
      /* Not JSON. */
    }
    const retry = Math.max(
      0,
      Number(res.headers.get("Retry-After")) || 0,
      typeof details.retryAfterSeconds === "number" ? details.retryAfterSeconds : 0,
    );
    throw new ApiError(
      res.status,
      typeof details.error === "string" && details.error.trim()
        ? details.error
        : wordsFor(res.status, Math.ceil(retry)),
      typeof details.code === "string" ? details.code : undefined,
      Math.ceil(retry),
    );
  }
  return res;
}

export const api = {
  /** `longPoll`: the server holds this request until something changes (not counted as a slow request). */
  get: <T>(
    path: string,
    options?: { signal?: AbortSignal; headers?: Record<string, string>; longPoll?: boolean },
  ) => request<T>(path, options),
  /** `timeoutMs`: for the rare request that may run longer than REQUEST_TIMEOUT_MS (big admin imports). */
  post: <T>(
    path: string,
    body?: unknown,
    options?: { signal?: AbortSignal; headers?: Record<string, string>; timeoutMs?: number },
  ) =>
    request<T>(path, {
      method: "POST",
      ...options,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(
    path: string,
    body: unknown,
    options?: { headers?: Record<string, string> },
  ) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...options,
    }),
  put: <T>(path: string, body: unknown, options?: { headers?: Record<string, string> }) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body), ...options }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
