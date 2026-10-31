const TOKEN_KEY = 'stayblz.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
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
const API_BASE = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.status, 'The server returned an invalid response. Please try again.');
  }
  if (!res.ok) {
    throw new ApiError(res.status, (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') ? data.error : 'Something went wrong.');
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
};
