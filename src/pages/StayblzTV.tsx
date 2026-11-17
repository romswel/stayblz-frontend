import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api";
import TvPlayer from "../components/tv/TvPlayer";
import { TV_NAME } from "../components/tv/brand";
import {
  formatDuration,
  normalize,
  ordinal,
  useReplays,
  winnerOf,
  type Replay,
} from "../components/tv/replays";
import {
  broadcastDate,
  isVideoId,
  replayEmbedUrl,
  thumbnailUrl,
  useYouTubeReplays,
  viewCount,
  watchUrl,
  type YouTubeVideo,
} from "../components/tv/youtube";
import "../components/overview/overview.css";
import "../components/tv/tv.css";
import "../components/tv/tv-glass.css";

/** `runners` is optional: when the server lists the horses in the live race, search can find them. */
type TvStatus = {
  state: "live" | "upcoming" | "off_air";
  title: string | null;
  startsAt: string | null;
  runners?: string[];
};

/** How often the page re-checks what's on, so it switches to live (or back) without a reload. */
const REFRESH_MS = 60_000;

const startTime = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
const raceDate = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

/* ---------- Icons ---------- */
const I = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;
const SearchIcon = () => (<svg {...I}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
const CloseIcon = () => (<svg {...I} width={14} height={14}><path d="M18 6 6 18M6 6l12 12" /></svg>);
const PlayIcon = () => (<svg {...I} fill="currentColor" stroke="none"><path d="M8 5.5v13l11-6.5z" /></svg>);
const ReplayIcon = () => (<svg {...I}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>);
const LiveIcon = () => (<svg {...I}><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M4.9 19.1a10 10 0 0 1 0-14.2" /></svg>);
const SparkIcon = () => (<svg {...I} width={14} height={14}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" /></svg>);
const TrophyIcon = () => (<svg {...I} width={14} height={14}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6" /></svg>);

function TvIcon() {
  return (
    <svg className="tvg-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M8 2.5l4 3.5 4-3.5" />
      <path d="M10.2 10.2v5.6l4.6-2.8z" />
    </svg>
  );
}

/** Ticks every second while `on`, for the countdown to the next broadcast. */
function useClock(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [on]);
  return now;
}

function Countdown({ to, now }: { to: string; now: number }) {
  const ms = Math.max(0, new Date(to).getTime() - now);
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const parts = [
    ...(d ? [[d, "days"] as const] : []),
    [h, "hrs"] as const,
    [m, "min"] as const,
    [s, "sec"] as const,
  ];
  return (
    <div className="tvg-countdown" role="timer" aria-label={`Starts in ${d ? `${d} days ` : ""}${h} hours ${m} minutes`}>
      {parts.map(([v, label], i) => (
        <span key={label} className="tvg-count-cell">
          <strong>{String(v).padStart(2, "0")}</strong>
          <small>{label}</small>
          {i < parts.length - 1 && <i aria-hidden="true">:</i>}
        </span>
      ))}
    </div>
  );
}

/**
 * Live race telecasts plus race replays. What's on comes from GET /api/tv/status; while live, the
 * player asks for the stream separately. Replays come from GET /api/tv/replays (see replays.ts).
 * Past YouTube broadcasts (GET /api/tv/youtube, see youtube.ts) play in the main screen instead of
 * the live feed, marked "Replay", with a button back to live. `?watch=<video id>` keeps that in the address.
 */
export default function StayblzTV() {
  const [status, setStatus] = useState<TvStatus | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);

  const load = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const next = await api.get<TvStatus>("/api/tv/status");
      if (mine !== generation.current) return;
      setStatus(next);
      setError("");
    } catch (e) {
      if (mine !== generation.current) return;
      // Keep showing the last known state on a background refresh; only an empty page shows the error.
      setError(e instanceof ApiError ? e.message : "STAYBLZ TV couldn't be reached.");
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      generation.current++;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const live = status?.state === "live";
  const upcoming = status?.state === "upcoming" && !!status.startsAt;
  const badge = live ? "Live" : status?.state === "upcoming" ? "Coming up" : status ? "Off air" : null;
  const now = useClock(upcoming);

  /* ---------- Replays, search & filters (kept in the address) ---------- */
  const { loading: replaysLoading, error: replaysError, replays, source, reload } = useReplays();
  const [params, setParams] = useSearchParams();
  const urlHorse = (params.get("horse") ?? "").slice(0, 60);
  const [horse, setHorse] = useState(urlHorse);
  useEffect(() => setHorse((typed) => (typed.trim() === urlHorse ? typed : urlHorse)), [urlHorse]);
  useEffect(() => {
    if (horse.trim() === urlHorse) return;
    const t = window.setTimeout(() => setParam({ horse: horse.trim() }), 250);
    return () => window.clearTimeout(t);
  }, [horse]);
  const track = params.get("track") ?? "";
  const surface = params.get("surface") ?? "";
  /** "" = race replays; "all" = every YouTube channel; otherwise one channel id. */
  const yt = params.get("yt") ?? "";
  const watchId = params.get("watch") ?? "";
  function setParam(changes: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  }

  const q = normalize(urlHorse);
  const tracks = useMemo(() => [...new Set(replays.map((r) => r.track))].sort(), [replays]);
  const sorted = useMemo(
    () => [...replays].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [replays],
  );
  const shown = sorted.filter(
    (r) =>
      (!track || r.track === track) &&
      (!surface || r.surface === surface) &&
      (!q || r.runners.some((x) => normalize(x.horse).includes(q))),
  );

  /** Every horse that matches the search, with each race it ran in (newest first). */
  const finder = useMemo(() => {
    if (!q) return [];
    const map = new Map<string, { name: string; races: { replay: Replay; pos: number | null }[]; live: boolean }>();
    for (const r of sorted)
      for (const x of r.runners)
        if (normalize(x.horse).includes(q)) {
          const key = normalize(x.horse);
          const entry = map.get(key) ?? { name: x.horse, races: [], live: false };
          entry.races.push({ replay: r, pos: x.pos });
          map.set(key, entry);
        }
    for (const name of status?.runners ?? [])
      if (normalize(name).includes(q)) {
        const key = normalize(name);
        const entry = map.get(key) ?? { name, races: [], live: false };
        entry.live = live || status?.state === "upcoming";
        map.set(key, entry);
      }
    return [...map.values()].sort((a, b) => Number(b.live) - Number(a.live) || b.races.length - a.races.length);
  }, [q, sorted, status, live]);

  const [open, setOpen] = useState<Replay | null>(null);
  const latest = sorted[0];

  /* ---------- YouTube broadcasts ---------- */
  const youtube = useYouTubeReplays();
  const channelName = (id: string) => youtube.channels.find((c) => c.id === id)?.name ?? "YouTube";
  const ytShown = youtube.videos.filter(
    (v) =>
      (yt === "all" || v.channelId === yt) &&
      (!q || normalize(`${v.title} ${v.description}`).includes(q)),
  );
  const watching = isVideoId(watchId) ? youtube.videos.find((v) => v.id === watchId) ?? null : null;
  const screenRef = useRef<HTMLElement>(null);
  /** Pushes a history entry, so the browser's Back button also returns to live. */
  function watch(id: string) {
    const next = new URLSearchParams(params);
    if (id) next.set("watch", id);
    else next.delete("watch");
    setParams(next);
    if (id) screenRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const backLabel = live ? "Back to live" : "Close replay";

  return (
    <div className="tvg">
      {/* ---------- Header ---------- */}
      <header className="tvg-hero gx-glass">
        <div className="tvg-hero-main">
          <span className="tvg-kicker">
            <span className="tvg-pulse" aria-hidden="true" /> Live race telecast
          </span>
          <h1>
            {TV_NAME}
            <span>.</span>
          </h1>
          <p>Watch races live from the track, catch up on replays, and find any horse's races.</p>
        </div>
        {badge && (
          <span className={`tvg-status is-${status?.state ?? "off_air"}`} role="status">
            <span className="tvg-dot" aria-hidden="true" />
            {badge}
          </span>
        )}
        <form
          className="tvg-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setParam({ horse: horse.trim() });
            document.getElementById("tvg-finder")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          <SearchIcon />
          <input
            type="search"
            value={horse}
            maxLength={60}
            placeholder="Find a horse — e.g. Midnight Ledger"
            aria-label="Search for a horse in live races and replays"
            onChange={(e) => setHorse(e.target.value)}
            enterKeyHint="search"
          />
          {horse && (
            <button type="button" className="tvg-icon-btn" aria-label="Clear search" onClick={() => { setHorse(""); setParam({ horse: "" }); }}>
              <CloseIcon />
            </button>
          )}
          <button type="submit" className="tvg-btn tvg-btn-primary">Search</button>
        </form>
      </header>

      {/* ---------- Stage: player + side panel ---------- */}
      <div className="tvg-stage">
        <section
          ref={screenRef}
          className={`tvg-screen${watching ? " is-replay has-bar" : live ? " is-live has-bar" : ""}`}
          aria-label={`${TV_NAME} player`}
        >
          <span className="tvg-scan" aria-hidden="true" />
          {watching || live ? (
            // A strip above the video, not on it: YouTube's player keeps its own controls at the
            // top corners (unmute top left, volume/captions/settings top right).
            <div className="tvg-screen-bar">
              {watching ? (
                <span className="tvg-onscreen is-replay">
                  <ReplayIcon />
                  Replay
                </span>
              ) : (
                <span className="tvg-onscreen is-live">
                  <span className="tvg-dot" aria-hidden="true" />
                  Live
                </span>
              )}
              <span className="tvg-bar-title">
                {watching ? `${watching.heading} · ${broadcastDate(watching)}` : status?.title ?? ""}
              </span>
              {watching && (
                <button type="button" className="tvg-btn tvg-btn-primary tvg-back-live" onClick={() => watch("")}>
                  {live ? <LiveIcon /> : <CloseIcon />} {backLabel}
                </button>
              )}
            </div>
          ) : (
            badge && (
              <span className={`tvg-onscreen is-${status?.state ?? "off_air"}`}>
                <span className="tvg-dot" aria-hidden="true" />
                {badge}
              </span>
            )
          )}
          {watching ? (
              <div className="tvg-player">
                <iframe
                  key={watching.id}
                  className="tv-video tv-embed"
                  src={replayEmbedUrl(watching.id)}
                  title={`Replay: ${watching.heading}, ${broadcastDate(watching)}`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  // The site sends no referrer; YouTube's player refuses to start without one.
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
          ) : live ? (
            <div className="tvg-player">
              <TvPlayer onOffAir={load} />
            </div>
          ) : (
            <div className="tvg-screen-inner">
              {!status && !error && (
                <p role="status" className="tvg-checking">
                  <span className="tvg-spinner" aria-hidden="true" /> Checking what's on…
                </p>
              )}
              {!status && error && (
                <>
                  <h2>Couldn't load {TV_NAME}</h2>
                  <p role="alert">{error}</p>
                  <button type="button" className="tvg-btn" onClick={load}>
                    Try again
                  </button>
                </>
              )}
              {status && (
                <>
                  <TvIcon />
                  {upcoming ? (
                    <>
                      <span className="tvg-label">Next broadcast</span>
                      <h2>{status.title ?? "Next broadcast"}</h2>
                      <Countdown to={status.startsAt!} now={now} />
                      <p>
                        Starts <time dateTime={status.startsAt!}>{startTime(status.startsAt!)}</time>. This screen
                        switches to the live race when it begins.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2>No live broadcast right now</h2>
                      <p>When {TV_NAME} goes on air, races will play here and this screen will show what's live.</p>
                      {latest && (
                        <button type="button" className="tvg-btn tvg-btn-primary" onClick={() => setOpen(latest)}>
                          <ReplayIcon /> Watch the latest replay
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        <aside className="tvg-side gx-glass" aria-label={watching ? "Now playing" : "On air"}>
          {watching ? (
            <WatchingPanel
              video={watching}
              channel={channelName(watching.channelId)}
              backLabel={backLabel}
              onBack={() => watch("")}
            />
          ) : (
          <>
          <div className="tvg-side-head">
            <span className="tvg-label">{live ? "Now on air" : upcoming ? "Up next" : "Schedule"}</span>
            {live && <span className="tvg-chip is-live">Live</span>}
          </div>
          <h2 className="tvg-now">
            {status?.title ?? (live ? "Live race" : upcoming ? "Next broadcast" : "Nothing scheduled")}
          </h2>
          {upcoming && status?.startsAt && (
            <p className="tvg-side-time">
              <time dateTime={status.startsAt}>{startTime(status.startsAt)}</time>
            </p>
          )}
          {status?.runners?.length ? (
            <>
              <span className="tvg-label">Horses in this race</span>
              <ol className="tvg-runners">
                {status.runners.map((name, i) => {
                  const hit = !!q && normalize(name).includes(q);
                  return (
                    <li key={name} className={hit ? "is-hit" : undefined}>
                      <span className="tvg-post">{i + 1}</span>
                      <button type="button" onClick={() => { setHorse(name); setParam({ horse: name }); }}>
                        {name}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <p className="tvg-side-note">
              {status?.state === "off_air" || !status
                ? "Broadcast times appear here as soon as they're scheduled."
                : "The field for this race will appear here when it's published."}
            </p>
          )}
          <div className="tvg-side-foot">
            <p>Follow Updates for news about {TV_NAME}.</p>
            <Link className="tvg-btn" to="/updates">
              See Updates
            </Link>
          </div>
          </>
          )}
        </aside>
      </div>

      {/* ---------- Horse finder ---------- */}
      {q && (
        <section id="tvg-finder" className="tvg-finder gx-glass" aria-labelledby="tvg-finder-title" aria-live="polite">
          <header className="tvg-section-head">
            <span className="tvg-num" aria-hidden="true"><SearchIcon /></span>
            <div>
              <h2 id="tvg-finder-title">Horse finder</h2>
              <p>
                {finder.length
                  ? `${finder.length} ${finder.length === 1 ? "horse matches" : "horses match"} “${urlHorse}”`
                  : `No horse named “${urlHorse}” is in a live race or replay.`}
              </p>
            </div>
          </header>
          {finder.length > 0 && (
            <ul className="tvg-finder-list">
              {finder.map((h) => {
                const wins = h.races.filter((r) => r.pos === 1).length;
                return (
                  <li key={h.name} className="tvg-horse">
                    <div className="tvg-horse-head">
                      <span className="tvg-horse-avatar" aria-hidden="true">{h.name.charAt(0)}</span>
                      <div>
                        <h3>{h.name}</h3>
                        <p>
                          {h.races.length} {h.races.length === 1 ? "replay" : "replays"} · {wins} {wins === 1 ? "win" : "wins"}
                        </p>
                      </div>
                      {h.live && <span className="tvg-chip is-live">{live ? "Racing now" : "In the next race"}</span>}
                    </div>
                    {h.races.length > 0 && (
                      <ul className="tvg-appearances">
                        {h.races.map(({ replay, pos }) => (
                          <li key={replay.id}>
                            <span className={`tvg-pos${pos === 1 ? " is-win" : pos && pos <= 3 ? " is-place" : ""}`}>
                              {pos ? ordinal(pos) : "—"}
                            </span>
                            <span className="tvg-app-text">
                              <strong>{replay.title}</strong>
                              <small>
                                {replay.track} · R{replay.raceNumber} · {raceDate(replay.date)}
                              </small>
                            </span>
                            <button type="button" className="tvg-btn tvg-btn-sm" onClick={() => setOpen(replay)}>
                              <PlayIcon /> Replay
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ---------- Replays ---------- */}
      <section className="tvg-replays gx-glass" aria-labelledby="tvg-replays-title">
        <header className="tvg-section-head">
          <span className="tvg-num" aria-hidden="true"><ReplayIcon /></span>
          <div>
            <h2 id="tvg-replays-title">Replays</h2>
            <p>
              {yt
                ? `Past broadcasts from ${yt === "all" ? "YouTube" : channelName(yt)}. They play in the ${TV_NAME} screen above.`
                : `Recent races with full results${source === "sample" ? "" : " and video"}.`}
            </p>
          </div>
          {yt && <span className="tvg-chip is-yt">YouTube</span>}
          {!yt && source === "sample" && (
            <span className="tvg-chip is-sample" title="Shown until /api/tv/replays returns real replays">
              Sample data
            </span>
          )}
        </header>

        <div className="tvg-toolbar">
          <div className="tvg-seg" role="group" aria-label="Surface or YouTube channel">
            {["", "Dirt", "Turf", "Synthetic"].map((s) => (
              <button type="button" key={s || "all"} aria-pressed={!yt && surface === s} onClick={() => setParam({ surface: s, yt: "" })}>
                {s || "All surfaces"}
              </button>
            ))}
            {(youtube.channels.length > 0 || (youtube.error && !youtube.loading)) && (
              <>
                <span className="tvg-seg-divider" aria-hidden="true" />
                <button type="button" aria-pressed={yt === "all"} onClick={() => setParam({ yt: "all", surface: "", track: "" })}>
                  All YouTube
                </button>
                {youtube.channels.map((c) => (
                  <button type="button" key={c.id} aria-pressed={yt === c.id} onClick={() => setParam({ yt: c.id, surface: "", track: "" })}>
                    {c.name}
                  </button>
                ))}
              </>
            )}
          </div>
          {!yt && (
          <label className="tvg-select">
            <span>Track</span>
            <select value={track} onChange={(e) => setParam({ track: e.target.value })}>
              <option value="">All tracks</option>
              {tracks.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          )}
        </div>

        {yt ? (
          youtube.loading && !youtube.videos.length ? (
            <ul className="tvg-grid" aria-hidden="true">
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="tvg-card tvg-skeleton">
                  <span className="tvg-sk tvg-sk-thumb" />
                  <span className="tvg-sk tvg-sk-line" />
                  <span className="tvg-sk tvg-sk-line short" />
                </li>
              ))}
            </ul>
          ) : youtube.error && !youtube.videos.length ? (
            <div className="tvg-empty" role="alert">
              <h3>YouTube replays could not be loaded.</h3>
              <p>{youtube.error}</p>
              <button type="button" className="tvg-btn" onClick={youtube.reload}>Try again</button>
            </div>
          ) : !ytShown.length ? (
            <div className="tvg-empty">
              <h3>{youtube.videos.length ? "No broadcasts match." : "No broadcasts yet."}</h3>
              <p>
                {youtube.videos.length
                  ? "Try all of YouTube, or clear the search."
                  : "Past broadcasts from the channel will appear here."}
              </p>
              {youtube.videos.length > 0 && q && (
                <button type="button" className="tvg-btn" onClick={() => { setHorse(""); setParam({ horse: "" }); }}>
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="tvg-count">
                <strong>{ytShown.length}</strong> {ytShown.length === 1 ? "broadcast" : "broadcasts"} from{" "}
                {yt === "all" ? "YouTube" : channelName(yt)}
                {q && <> matching “{urlHorse}”</>}
              </p>
              <ul className="tvg-grid">
                {ytShown.map((v) => (
                  <li key={v.id}>
                    <YouTubeCard
                      video={v}
                      channel={channelName(v.channelId)}
                      playing={watching?.id === v.id}
                      onWatch={() => watch(v.id)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )
        ) : replaysLoading && !replays.length ? (
          <ul className="tvg-grid" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="tvg-card tvg-skeleton">
                <span className="tvg-sk tvg-sk-thumb" />
                <span className="tvg-sk tvg-sk-line" />
                <span className="tvg-sk tvg-sk-line short" />
              </li>
            ))}
          </ul>
        ) : replaysError ? (
          <div className="tvg-empty" role="alert">
            <h3>Replays could not be loaded.</h3>
            <p>{replaysError}</p>
            <button type="button" className="tvg-btn" onClick={reload}>Try again</button>
          </div>
        ) : !shown.length ? (
          <div className="tvg-empty">
            <h3>{replays.length ? "No replays match." : "No replays yet."}</h3>
            <p>
              {replays.length
                ? "Try another track or surface, or clear the horse search."
                : "Finished races will appear here with their results."}
            </p>
            {replays.length > 0 && (
              <button type="button" className="tvg-btn" onClick={() => { setHorse(""); setParam({ horse: "", track: "", surface: "" }); }}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="tvg-count">
              <strong>{shown.length}</strong> {shown.length === 1 ? "replay" : "replays"}
              {q && <> with “{urlHorse}”</>}
            </p>
            <ul className="tvg-grid">
              {shown.map((r) => (
                <li key={r.id}>
                  <ReplayCard replay={r} query={q} onOpen={() => setOpen(r)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {open && <ReplayDialog replay={open} query={q} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** A past YouTube broadcast, in the same card format as race replays. */
function YouTubeCard({ video: v, channel, playing, onWatch }: { video: YouTubeVideo; channel: string; playing: boolean; onWatch: () => void }) {
  const rows: [string, string][] = [
    ...(v.races !== null ? [["Races", String(v.races)] as [string, string]] : []),
    ...(v.firstPost ? [["First post", v.firstPost] as [string, string]] : []),
    ...(v.kind === "preview" ? [["Show", "Preview & handicapping"] as [string, string]] : []),
    ...(v.views !== null ? [["Views", new Intl.NumberFormat().format(v.views)] as [string, string]] : []),
  ];
  return (
    <article className={`tvg-card${playing ? " is-playing" : ""}`}>
      <button
        type="button"
        className="tvg-thumb"
        onClick={onWatch}
        aria-label={`Watch replay: ${v.heading}, ${broadcastDate(v)}`}
        aria-current={playing || undefined}
      >
        <img className="tvg-thumb-img" src={thumbnailUrl(v.id)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        <span className="tvg-play" aria-hidden="true"><PlayIcon /></span>
        <span className="tvg-thumb-top" aria-hidden="true">
          <span className="tvg-chip">{channel}</span>
          {v.kind === "card" && <span className="tvg-chip is-grade">Full card</span>}
          {v.kind === "preview" && <span className="tvg-chip">Preview</span>}
        </span>
        {playing && <span className="tvg-duration is-playing" aria-hidden="true">Now playing</span>}
      </button>
      <div className="tvg-card-body">
        <div className="tvg-card-title">
          <h3>{v.heading}</h3>
          {v.races !== null && <span className="tvg-race-no">{v.races} races</span>}
        </div>
        <p className="tvg-meta">
          {broadcastDate(v)} · YouTube
        </p>
        {v.highlight ? (
          <p className="tvg-winner tvg-yt-note">
            <SparkIcon /> <span>{v.highlight}</span>
          </p>
        ) : (
          v.kind !== "card" && v.description && <p className="tvg-yt-desc">{v.description}</p>
        )}
        {rows.length > 0 && (
          <ol className="tvg-podium" aria-label="Broadcast details">
            {rows.map(([label, value]) => (
              <li key={label}>
                <span className="tvg-podium-name">{label}</span>
                <span className="tvg-podium-odds">{value}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </article>
  );
}

/** Side panel while a YouTube replay plays in the main screen. */
function WatchingPanel({ video: v, channel, backLabel, onBack }: { video: YouTubeVideo; channel: string; backLabel: string; onBack: () => void }) {
  const views = viewCount(v.views);
  return (
    <>
      <div className="tvg-side-head">
        <span className="tvg-label">Now playing</span>
        <span className="tvg-chip is-replay">Replay</span>
      </div>
      <h2 className="tvg-now">{v.heading}</h2>
      <p className="tvg-side-time">{broadcastDate(v)}</p>
      <dl className="tvg-facts tvg-side-facts">
        <div><dt>Channel</dt><dd>{channel}</dd></div>
        {v.races !== null && <div><dt>Races</dt><dd>{v.races}</dd></div>}
        {v.firstPost && <div><dt>First post</dt><dd>{v.firstPost}</dd></div>}
        {views && <div><dt>Views</dt><dd>{views.replace(/ views?$/, "")}</dd></div>}
      </dl>
      {(v.highlight || v.kind !== "card") && <p className="tvg-side-note">{v.highlight ?? v.description}</p>}
      <div className="tvg-side-foot">
        <p>
          <a href={watchUrl(v.id)} target="_blank" rel="noopener noreferrer">Open on YouTube</a> · {v.title}
        </p>
        <button type="button" className="tvg-btn tvg-btn-primary" onClick={onBack}>
          {backLabel}
        </button>
      </div>
    </>
  );
}

function ReplayCard({ replay: r, query, onOpen }: { replay: Replay; query: string; onOpen: () => void }) {
  const win = winnerOf(r);
  const hit = query ? r.runners.find((x) => normalize(x.horse).includes(query)) : undefined;
  const podium = r.runners.filter((x) => x.pos && x.pos <= 3).sort((a, b) => (a.pos ?? 9) - (b.pos ?? 9));
  return (
    <article className="tvg-card">
      <button type="button" className="tvg-thumb" onClick={onOpen} aria-label={`Watch replay: ${r.title}, ${r.track} race ${r.raceNumber}`}>
        <span className={`tvg-thumb-art is-${r.surface.toLowerCase()}`} aria-hidden="true">
          <span className="tvg-rail" />
          <span className="tvg-rail is-2" />
        </span>
        <span className="tvg-play" aria-hidden="true"><PlayIcon /></span>
        <span className="tvg-thumb-top" aria-hidden="true">
          <span className="tvg-chip">{r.track}</span>
          {r.grade && <span className="tvg-chip is-grade">{r.grade}</span>}
        </span>
        {r.duration !== undefined && <span className="tvg-duration" aria-hidden="true">{formatDuration(r.duration)}</span>}
      </button>
      <div className="tvg-card-body">
        <div className="tvg-card-title">
          <h3>{r.title}</h3>
          <span className="tvg-race-no">R{r.raceNumber}</span>
        </div>
        <p className="tvg-meta">
          {raceDate(r.date)} · {r.distance} · {r.surface}
          {r.winningTime && <> · <span className="tvg-mono">{r.winningTime}</span></>}
        </p>
        {hit ? (
          <p className="tvg-hit">
            <strong>{hit.horse}</strong> finished{" "}
            <span className={`tvg-pos${hit.pos === 1 ? " is-win" : hit.pos && hit.pos <= 3 ? " is-place" : ""}`}>
              {hit.pos ? ordinal(hit.pos) : "—"}
            </span>
          </p>
        ) : (
          win && (
            <p className="tvg-winner">
              <TrophyIcon /> <strong>{win.horse}</strong>
              {win.jockey && <small> · {win.jockey}</small>}
            </p>
          )
        )}
        <ol className="tvg-podium" aria-label="Top three">
          {podium.map((x) => (
            <li key={x.horse} className={hit?.horse === x.horse ? "is-hit" : undefined}>
              <span className="tvg-podium-pos">{x.pos}</span>
              <span className="tvg-podium-name">{x.horse}</span>
              <span className="tvg-podium-odds">{x.odds}</span>
            </li>
          ))}
        </ol>
      </div>
    </article>
  );
}

function ReplayDialog({ replay: r, query, onClose }: { replay: Replay; query: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      before?.focus();
    };
  }, [onClose]);
  const finishers = [...r.runners].sort((a, b) => (a.pos ?? 99) - (b.pos ?? 99));
  return (
    <div className="tvg-dialog-wrap">
      <button type="button" className="tvg-scrim" aria-label="Close replay" tabIndex={-1} onClick={onClose} />
      <div className="tvg-dialog gx-glass" role="dialog" aria-modal="true" aria-labelledby="tvg-dialog-title">
        <header className="tvg-dialog-head">
          <div>
            <span className="tvg-label">
              Replay · {r.track} · Race {r.raceNumber}
            </span>
            <h2 id="tvg-dialog-title">{r.title}</h2>
          </div>
          <button ref={closeRef} type="button" className="tvg-icon-btn" aria-label="Close replay" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <div className="tvg-dialog-body">
          <div className="tvg-video">
            {r.videoUrl ? (
              <video src={r.videoUrl} controls playsInline preload="metadata" />
            ) : (
              <div className="tvg-video-empty">
                <TvIcon />
                <p>The video for this race isn't available yet. Full results are below.</p>
              </div>
            )}
          </div>
          <dl className="tvg-facts">
            <div><dt>Date</dt><dd>{raceDate(r.date)}</dd></div>
            <div><dt>Distance</dt><dd>{r.distance}</dd></div>
            <div><dt>Surface</dt><dd>{r.surface}</dd></div>
            {r.grade && <div><dt>Grade</dt><dd>{r.grade}</dd></div>}
            {r.purse && <div><dt>Purse</dt><dd>{r.purse}</dd></div>}
            {r.winningTime && <div><dt>Final time</dt><dd className="tvg-mono">{r.winningTime}</dd></div>}
          </dl>
          <div className="tvg-results">
            <table>
              <caption>Official finish</caption>
              <thead>
                <tr>
                  <th scope="col">Pos</th>
                  <th scope="col">Horse</th>
                  <th scope="col">Post</th>
                  <th scope="col">Jockey</th>
                  <th scope="col">Trainer</th>
                  <th scope="col">Odds</th>
                  <th scope="col">Margin</th>
                </tr>
              </thead>
              <tbody>
                {finishers.map((x) => {
                  const hit = !!query && normalize(x.horse).includes(query);
                  return (
                    <tr key={x.horse} className={hit ? "is-hit" : undefined}>
                      <td>
                        <span className={`tvg-pos${x.pos === 1 ? " is-win" : x.pos && x.pos <= 3 ? " is-place" : ""}`}>
                          {x.pos ? ordinal(x.pos) : "DNF"}
                        </span>
                      </td>
                      <th scope="row">{x.horse}</th>
                      <td className="tvg-mono">{x.post ?? "—"}</td>
                      <td>{x.jockey ?? "—"}</td>
                      <td>{x.trainer ?? "—"}</td>
                      <td className="tvg-mono">{x.odds ?? "—"}</td>
                      <td className="tvg-mono">{x.pos === 1 ? "—" : x.margin || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}