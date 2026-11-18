import { useEffect, useRef, useState } from "react";
import { api } from "../../api";

/** The four reactions readers can leave on a post (the API and database check the same list). */
export const REACTIONS = [
  { key: "like", emoji: "👍", label: "Helpful" },
  { key: "celebrate", emoji: "🎉", label: "Nice one" },
  { key: "love", emoji: "❤️", label: "Love it" },
  { key: "horse", emoji: "🐎", label: "Giddy-up" },
] as const;
export type ReactionKey = (typeof REACTIONS)[number]["key"];
export type ReactionSummary = { counts: Partial<Record<ReactionKey, number>>; mine: ReactionKey[] };
export const emptySummary: ReactionSummary = { counts: {}, mine: [] };

export const totalOf = (summary: ReactionSummary | undefined) =>
  Object.values(summary?.counts ?? {}).reduce((sum, n) => sum + (n ?? 0), 0);

/**
 * Reaction counts for the posts on screen, fetched in one request. Quiet on failure: the feed
 * still works, it just leaves the counts out. Late answers for an older list are ignored.
 */
export function useReactionCounts(slugs: string[]) {
  const [counts, setCounts] = useState<Record<string, ReactionSummary>>({});
  // Posts already asked about (so "Load older posts" only fetches the new ones), and whether we're still on screen.
  const asked = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const key = slugs.join(",");
  useEffect(() => {
    const wanted = [...new Set(slugs)].filter((slug) => slug && !asked.current.has(slug));
    wanted.forEach((slug) => asked.current.add(slug));
    // The API answers for up to 30 posts at a time.
    for (let i = 0; i < wanted.length; i += 30) {
      const chunk = wanted.slice(i, i + 30);
      api
        .get<{ reactions: Record<string, ReactionSummary> }>(`/api/updates/reactions?slugs=${encodeURIComponent(chunk.join(","))}`)
        .then((data) => {
          if (alive.current && data?.reactions && typeof data.reactions === "object")
            setCounts((current) => ({ ...current, ...data.reactions }));
        })
        // Quiet: the feed works without counts. Forget these so a later render can ask again.
        .catch(() => chunk.forEach((slug) => asked.current.delete(slug)));
    }
    // `slugs` is represented by `key`.
  }, [key]);
  return counts;
}

/** Add or take back one reaction; resolves to the new summary for that post. */
export async function react(slug: string, reaction: ReactionKey, on: boolean) {
  const data = await api.post<{ reactions: ReactionSummary }>(`/api/updates/${encodeURIComponent(slug)}/reactions`, {
    reaction,
    on,
  });
  return data.reactions ?? emptySummary;
}
