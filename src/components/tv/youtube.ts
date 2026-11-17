import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../api";

/* ==========================================================================
   STAYBLZ TV — past broadcasts from YouTube channels (demo until a stream
   provider is connected). The page reads GET /api/tv/youtube; the server
   reads each channel's public feed. Race data is only what the channel
   writes (race count, first post, highlights): no horse-by-horse results.
   ========================================================================== */

export type YouTubeChannel = { id: string; name: string; url: string };

export type YouTubeVideo = {
  id: string;
  channelId: string;
  title: string;
  kind: "card" | "preview" | "video";
  heading: string;
  publishedAt: string;
  raceDay: string | null;
  races: number | null;
  firstPost: string | null;
  highlight: string | null;
  description: string;
  views: number | null;
};

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export const isVideoId = (id: string) => VIDEO_ID.test(id);

/** Replays start with sound: the viewer clicked to watch, which lets YouTube autoplay unmuted. */
export const replayEmbedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;
export const thumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** The race day ("Sun, Nov 15, 2026") when the title names one, else the publish date. */
export function broadcastDate(v: YouTubeVideo) {
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", year: "numeric" };
  if (v.raceDay) return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: "UTC" }).format(new Date(`${v.raceDay}T12:00:00Z`));
  return new Intl.DateTimeFormat(undefined, opts).format(new Date(v.publishedAt));
}

export const viewCount = (n: number | null) =>
  n === null ? null : `${new Intl.NumberFormat(undefined, { notation: n >= 10_000 ? "compact" : "standard" }).format(n)} ${n === 1 ? "view" : "views"}`;

export function useYouTubeReplays() {
  const [state, setState] = useState<{ loading: boolean; error: string; channels: YouTubeChannel[]; videos: YouTubeVideo[] }>({
    loading: true,
    error: "",
    channels: [],
    videos: [],
  });
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const d = await api.get<{ channels: YouTubeChannel[]; videos: YouTubeVideo[] }>("/api/tv/youtube");
      if (mine !== generation.current) return;
      if (!Array.isArray(d?.channels) || !Array.isArray(d?.videos)) throw new Error("YouTube replays couldn't be loaded.");
      setState({ loading: false, error: "", channels: d.channels, videos: d.videos.filter((v) => isVideoId(v.id)) });
    } catch (e) {
      if (mine !== generation.current) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof ApiError ? e.message : "YouTube replays couldn't be loaded.",
      }));
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      generation.current++;
    };
  }, [load]);

  return { ...state, reload: load };
}
