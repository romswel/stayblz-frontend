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
const API_BASE = import.meta.env.PROD
  ? ""
  : (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

let refreshPending: Promise<boolean> | null = null;
async function request<T>(
  path: string,
  options: RequestInit = {},
  renewed = false,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
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
    throw new ApiError(
      res.status,
      "The server returned an invalid response. Please try again.",
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
    throw new ApiError(
      res.status,
      data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string"
        ? data.error
        : "Something went wrong.",
      typeof details.code === "string" ? details.code : undefined,
      Math.ceil(retry),
    );
  }
  return data as T;
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
};
