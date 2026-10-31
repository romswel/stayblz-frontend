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
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Set VITE_API_URL in production (e.g. https://stayblz-api.onrender.com);
// leave unset in development to use the Vite proxy.
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
    throw new ApiError(
      res.status,
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : "Something went wrong.",
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, options?: { signal?: AbortSignal }) =>
    request<T>(path, options),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
};
