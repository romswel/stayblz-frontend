import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { User } from "../../types";
import type { UpdateFeed, UpdatePost } from "./types";

interface UpdatesState {
  /** Newest posts (first page), or null until loaded. */
  recent: UpdatePost[] | null;
  /** Posts published since the person last opened Updates. */
  unread: UpdatePost[];
  /** The time the person last read Updates (from their account). */
  seenAt: string | null;
  popupOn: boolean;
  markSeen: () => Promise<void>;
  setPopup: (on: boolean) => Promise<void>;
  reload: () => void;
}

const UpdatesContext = createContext<UpdatesState | null>(null);
const localKey = (userId: string) => `stayblz.updates.${userId}`;

function readLocal(userId?: string): { seenAt?: string; popup?: boolean } {
  if (!userId) return {};
  try {
    return JSON.parse(localStorage.getItem(localKey(userId)) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Loads the newest Updates once for the signed-in layout and tracks what the person has
 * read. Read state is saved to the account (so it follows them across devices) with a
 * local copy so it still works if saving fails.
 */
export function UpdatesProvider({ children }: { children: ReactNode }) {
  const { user, acceptUser } = useAuth();
  const [recent, setRecent] = useState<UpdatePost[] | null>(null);
  const [local, setLocal] = useState(() => readLocal(user?.id));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<UpdateFeed>("/api/updates?limit=12", { signal: controller.signal })
      .then((feed) => {
        if (controller.signal.aborted || !Array.isArray(feed?.updates)) return;
        // Pinned posts can be older than the first page; keep both, newest first, once each.
        const seen = new Set<string>();
        const merged = [...(feed.pinned ?? []), ...feed.updates]
          .filter((post) => !seen.has(post.id) && seen.add(post.id))
          .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""));
        setRecent(merged);
      })
      .catch(() => {
        /* Updates are optional; the page itself shows loading and errors. */
      });
    return () => controller.abort();
  }, [user?.id, attempt]);

  const server = user?.preferences;
  const seenAt = useMemo(() => {
    const times = [server?.updatesSeenAt, local.seenAt].filter(Boolean) as string[];
    return times.length ? times.reduce((a, b) => (Date.parse(a) > Date.parse(b) ? a : b)) : null;
  }, [server?.updatesSeenAt, local.seenAt]);
  // Only once the server has sent this person's settings, so a development profile or an
  // older server never shows a pop-up it can't remember closing.
  const unread = useMemo(
    () =>
      server && seenAt && recent
        ? recent.filter((post) => post.publishedAt && Date.parse(post.publishedAt) > Date.parse(seenAt))
        : [],
    [server, seenAt, recent],
  );
  const popupOn = local.popup !== false && server?.updatesPopup !== false;

  const save = useCallback(
    async (prefs: { updatesSeen?: true; updatesPopup?: boolean }) => {
      if (!user) return;
      const next = {
        ...(prefs.updatesSeen ? { seenAt: new Date().toISOString() } : {}),
        ...(prefs.updatesPopup !== undefined ? { popup: prefs.updatesPopup } : {}),
      };
      setLocal((current) => {
        const merged = { ...current, ...next };
        try {
          localStorage.setItem(localKey(user.id), JSON.stringify(merged));
        } catch {
          /* the account copy still applies */
        }
        return merged;
      });
      try {
        const result = await api.patch<{ user?: User }>("/api/auth/preferences", prefs);
        // Never treat an odd reply as "signed out".
        if (result?.user?.id) acceptUser(result.user);
      } catch {
        /* kept on this device; the account copy updates next time */
      }
    },
    [user, acceptUser],
  );

  const value = useMemo<UpdatesState>(
    () => ({
      recent,
      unread,
      seenAt,
      popupOn,
      markSeen: () => save({ updatesSeen: true }),
      setPopup: (on: boolean) => save({ updatesPopup: on, ...(on ? {} : { updatesSeen: true as const }) }),
      reload: () => setAttempt((n) => n + 1),
    }),
    [recent, unread, seenAt, popupOn, save],
  );
  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

const outside: UpdatesState = {
  recent: null,
  unread: [],
  seenAt: null,
  popupOn: false,
  markSeen: async () => {},
  setPopup: async () => {},
  reload: () => {},
};
/** Safe outside the signed-in layout too (public pages): nothing is unread there. */
export const useUpdates = () => useContext(UpdatesContext) ?? outside;
