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

interface AuthState {
  user: User | null;
  loading: boolean;
  restoreError: string;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
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
    async function restore() {
      try {
        let response;
        try {
          response = await api.get<{ user: User }>("/api/auth/me", {
            signal: controller.signal,
          });
        } catch (error) {
          if (controller.signal.aborted) return;
          if (!(error instanceof ApiError) || error.status !== 401) throw error;
          response = await api.post<{ user: User }>("/api/auth/refresh");
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
            "Your session could not be checked. Try logging in again.",
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
      login: async (username, password) => {
        const start = ++epoch.current;
        const response = await api.post<{ user: User; token?: string }>(
          "/api/auth/login",
          { username, password },
        );
        if (epoch.current !== start)
          throw new Error("The sign-in request was cancelled.");
        setToken(response.token ?? null);
        setUser(response.user);
        setRestoreError("");
        return response.user;
      },
      logout: async () => {
        ++epoch.current;
        await api.post("/api/auth/logout");
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
