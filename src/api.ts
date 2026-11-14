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

/** Friendly words for failures. Raw server or browser errors are never shown. */
export const friendly = {
  network:
    "We can't reach Stayblz right now. Check your internet connection and try again.",
  starting:
    "Stayblz is starting up or busy. Please try again in a moment.",
  server: "Something went wrong on our side. Please try again.",
  notFound: "We couldn't find what you were looking for.",
  unavailable: "This feature isn't available yet.",
};

let refreshPending: Promise<boolean> | null = null;
async function request<T>(
  path: string,
  options: RequestInit = {},
  renewed = false,
): Promise<T> {
  const token = getToken();
  const settle = netStatus.track();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    // Cancelled on purpose: let callers see the abort as before.
    if (options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError"))
      throw error;
    netStatus.unreachable();
    throw new ApiError(0, friendly.network, "network");
  } finally {
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
    if (await refreshPending) return request<T>(path, options, true);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    // Not our JSON: a proxy page, a sleeping server, or a missing route.
    throw new ApiError(
      res.status,
      [502, 503, 504].includes(res.status)
        ? friendly.starting
        : res.status === 404
          ? friendly.notFound
          : friendly.server,
      [502, 503, 504].includes(res.status) ? "server_unavailable" : undefined,
      res.status === 503 ? 15 : 0,
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
    const retry = Math.min(
      86400,
      Math.max(
        0,
        Number.isFinite(retryHeader) ? retryHeader : 0,
        Number.isFinite(retryBody) ? retryBody : 0,
        res.status === 429 ? 60 : 0,
      ),
    );
    const message =
      typeof details.error === "string" && details.error.trim()
        ? details.error
        : res.status === 402
          ? friendly.unavailable
          : res.status >= 500
            ? friendly.server
            : "Something went wrong.";
    throw new ApiError(
      res.status,
      message,
      typeof details.code === "string"
        ? details.code
        : res.status === 402
          ? "feature_unavailable"
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
  if (!res.ok) {
    let details: Record<string, unknown> = {};
    try {
      details = (await res.json()) as Record<string, unknown>;
    } catch {
      /* Not JSON. */
    }
    throw new ApiError(
      res.status,
      typeof details.error === "string" && details.error.trim()
        ? details.error
        : res.status >= 500
          ? friendly.starting
          : friendly.server,
      typeof details.code === "string" ? details.code : undefined,
    );
  }
  return res;
}

export const api = {
  get: <T>(
    path: string,
    options?: { signal?: AbortSignal; headers?: Record<string, string> },
  ) => request<T>(path, options),
  post: <T>(
    path: string,
    body?: unknown,
    options?: { headers?: Record<string, string> },
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
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
