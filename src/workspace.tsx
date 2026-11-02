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
import { Link } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./auth";
export interface Stable {
  id: string;
  name: string;
  role: "owner" | "manager" | "member";
}
export interface Teammate {
  id: string;
  displayName: string;
  role: Stable["role"];
}
interface WorkspaceState {
  stables: Stable[];
  active: Stable | null;
  loading: boolean;
  error: string;
  select: (id: string) => void;
  reload: () => Promise<Stable[]>;
}
const Context = createContext<WorkspaceState | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [stables, setStables] = useState<Stable[]>([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const key = `stayblz.stable.${user?.id ?? ""}`;
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.get<{ stables: Stable[] }>("/api/workspaces");
      if (
        !Array.isArray(response.stables) ||
        response.stables.some(
          (s) =>
            !s ||
            typeof s.id !== "string" ||
            typeof s.name !== "string" ||
            !["owner", "manager", "member"].includes(s.role),
        )
      )
        throw Error("The stable list could not be loaded.");
      if (request !== generation.current) return [];
      setStables(response.stables);
      setActiveId((old) => {
        let saved = "";
        try {
          saved = localStorage.getItem(key) ?? "";
        } catch {
          /* Preference is optional. */
        }
        return response.stables.some((s) => s.id === old)
          ? old
          : response.stables.some((s) => s.id === saved)
            ? saved
            : (response.stables[0]?.id ?? "");
      });
      return response.stables;
    } catch (reason) {
      if (request === generation.current) {
        setStables([]);
        setActiveId("");
        setError(
          reason instanceof Error
            ? reason.message
            : "Your stables could not be loaded.",
        );
      }
      return [];
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [key]);
  useEffect(() => {
    void reload();
    return () => {
      ++generation.current;
    };
  }, [reload]);
  const select = useCallback(
    (id: string) => {
      if (!stables.some((s) => s.id === id)) return;
      setActiveId(id);
      try {
        localStorage.setItem(key, id);
      } catch {
        /* Selection still works. */
      }
    },
    [stables, key],
  );
  const value = useMemo(
    () => ({
      stables,
      active: stables.find((s) => s.id === activeId) ?? null,
      loading,
      error,
      select,
      reload,
    }),
    [stables, activeId, loading, error, select, reload],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw Error("WorkspaceProvider is required.");
  return context;
}
export function useStableApi() {
  const { active } = useWorkspace();
  return useMemo(() => {
    const headers = { "X-Stayblz-Stable": active?.id ?? "" };
    return {
      get: <T,>(path: string, options?: { signal?: AbortSignal }) =>
        api.get<T>(path, { ...options, headers }),
      post: <T,>(path: string, body?: unknown) =>
        api.post<T>(path, body, { headers }),
      patch: <T,>(path: string, body: unknown) =>
        api.patch<T>(path, body, { headers }),
    };
  }, [active?.id]);
}
export function StableGate({ children }: { children: ReactNode }) {
  const { active, loading, error, reload } = useWorkspace();
  if (loading) return <div className="loading">Loading your stable…</div>;
  if (error)
    return (
      <section className="panel ws-access">
        <h1>Your stable could not be loaded</h1>
        <p role="alert">{error}</p>
        <button className="ws-button" onClick={() => void reload()}>
          Try again
        </button>
      </section>
    );
  if (!active)
    return (
      <section className="panel ws-access">
        <h1>Start your stable</h1>
        <p>
          Create your own stable or accept a team invitation to use team messages,
          inventory, tracking and the stable feed.
        </p>
        <Link className="ws-button" to="/stables">
          Set up your stable
        </Link>
      </section>
    );
  return <>{children}</>;
}
