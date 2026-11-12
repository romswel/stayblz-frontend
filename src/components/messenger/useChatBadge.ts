import { useEffect, useState } from "react";
import { api } from "../../api";
import type { UnreadCounts } from "./types";

const BADGE_POLL_MS = 60_000;
const EMPTY: UnreadCounts = { personal: 0, requests: 0, team: 0 };

/**
 * Unread chat counts for the menu. One small request a minute while the tab is visible,
 * plus a refresh shortly after you read, send or accept something.
 */
export function useChatBadge(enabled: boolean): UnreadCounts {
  const [counts, setCounts] = useState<UnreadCounts>(EMPTY);
  useEffect(() => {
    if (!enabled) {
      setCounts(EMPTY);
      return;
    }
    let stopped = false;
    let soonTimer = 0;
    const load = () => {
      if (document.hidden) return;
      api
        .get<UnreadCounts>("/api/messages/unread")
        .then((data) => {
          if (!stopped && data && typeof data.personal === "number") setCounts(data);
        })
        .catch(() => {
          /* The badge is a hint; a failed check just keeps the last numbers. */
        });
    };
    load();
    const timer = window.setInterval(load, BADGE_POLL_MS);
    const soon = () => {
      window.clearTimeout(soonTimer);
      soonTimer = window.setTimeout(load, 1500);
    };
    window.addEventListener("stayblz:chats-changed", soon);
    document.addEventListener("visibilitychange", load);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearTimeout(soonTimer);
      window.removeEventListener("stayblz:chats-changed", soon);
      document.removeEventListener("visibilitychange", load);
    };
  }, [enabled]);
  // "(3) Stayblz" in the browser tab when chats are waiting.
  useEffect(() => {
    const total = counts.personal + counts.requests + counts.team;
    const base = document.title.replace(/^\(\d+\+?\) /, "");
    document.title = total ? `(${total > 99 ? "99+" : total}) ${base}` : base;
  }, [counts]);
  return counts;
}
