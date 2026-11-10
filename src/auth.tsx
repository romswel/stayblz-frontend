import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError, setToken } from "./api";
import type { User } from "./types";
import { clearAccountDrafts } from "./components/ui/useDraft";

interface AuthState {
  user: User | null;
  loading: boolean;
  restoreError: string;
  login: (username: string, password: string, remember?: boolean) => Promise<User>;
  /** Signs out this device, or every device when `everywhere` is true. */
  logout: (everywhere?: boolean) => Promise<void>;
  acceptUser: (user: User | null) => void;
}
const AuthContext = createContext<AuthState | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoreError, setRestoreError] = useState("");
  const epoch = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const start = epoch.current;
    // A sleeping server gives no answer, or a proxy error page instead of our JSON, for up
    // to a minute. Keep waiting (the startup screen explains why) instead of logging people
    // out. A real answer from our API, even an error, is final.
    const waking = (error: unknown) =>
      error instanceof ApiError &&
      (error.status === 0 || error.code === "server_unavailable");
    const pause = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, ms);
        controller.signal.addEventListener("abort", () => {
          window.clearTimeout(timer);
          resolve();
        });
      });
    async function check(): Promise<{ user: User }> {
      try {
        return await api.get<{ user: User }>("/api/auth/me", {
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw error;
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        return api.post<{ user: User }>("/api/auth/refresh");
      }
    }
    async function restore() {
      try {
        let response: { user: User } | undefined;
        const waits = [2000, 3000, 5000, 8000, 10000, 10000, 10000];
        for (let attempt = 0; ; attempt++) {
          try {
            response = await check();
            break;
          } catch (error) {
            if (controller.signal.aborted) return;
            if (!waking(error) || attempt >= waits.length) throw error;
            await pause(waits[attempt]);
            if (controller.signal.aborted) return;
          }
        }
        if (!controller.signal.aborted && epoch.current === start)
          setUser(response.user);
      } catch (error) {
        if (
          !controller.signal.aborted &&
          epoch.current === start &&
          (!(error instanceof ApiError) || error.status !== 401)
        )
          setRestoreError(
            "We couldn't reach Stayblz to check your sign-in. Wait a moment and reload, or log in again.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void restore();
    return () => controller.abort();
  }, []);
  const acceptUser = useCallback((next: User | null) => {
    ++epoch.current;
    setToken(null);
    setUser(next);
    setRestoreError("");
  }, []);
  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      restoreError,
      login: async (username, password, remember = true) => {
        const start = ++epoch.current;
        const response = await api.post<{ user: User; token?: string }>(
          "/api/auth/login",
          { username, password, remember },
        );
        if (epoch.current !== start)
          throw new Error("The sign-in request was cancelled.");
        setToken(response.token ?? null);
        setUser(response.user);
        setRestoreError("");
        return response.user;
      },
      logout: async (everywhere = false) => {
        ++epoch.current;
        await api.post("/api/auth/logout", everywhere ? { everywhere: true } : {});
        // Unsent drafts belong to this account; don't leave them for the next person on this device.
        clearAccountDrafts(user?.id);
        setToken(null);
        setUser(null);
      },
      acceptUser,
    }),
    [user, loading, restoreError, acceptUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be inside AuthProvider");
  return context;
}
