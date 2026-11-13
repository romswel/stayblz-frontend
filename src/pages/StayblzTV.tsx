import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api";
import TvPlayer from "../components/tv/TvPlayer";
import { TV_NAME } from "../components/tv/brand";
import "../components/overview/overview.css";
import "../components/tv/tv.css";

type TvStatus = { state: "live" | "upcoming" | "off_air"; title: string | null; startsAt: string | null };

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

/**
 * Live race telecasts. What's on comes from GET /api/tv/status; while live, the player asks for
 * the stream separately. No sample video, schedule or "live" badge that the server didn't report.
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
  const badge = live ? "Live" : status?.state === "upcoming" ? "Coming up" : status ? "Off air" : null;

  return (
    <div className="tv-page">
      <header className="ov-heading">
        <div>
          <span className="ov-kicker">LIVE RACE TELECAST</span>
          <h1>
            {TV_NAME}
            <span>.</span>
          </h1>
          <p>Watch races live from the track, right inside Stayblz.</p>
        </div>
      </header>
      <section className={`tv-screen${live ? " is-live" : ""}`} aria-label={`${TV_NAME} player`}>
        {badge && (
          <span className={`tv-status${live ? " is-live" : ""}`}>
            <span className="tv-dot" aria-hidden="true" />
            {badge}
          </span>
        )}
        {live ? (
          <TvPlayer onOffAir={load} />
        ) : (
          <div className="tv-screen-inner">
            {!status && !error && (
              <p role="status">
                <span className="tv-spinner" aria-hidden="true" /> Checking what's on…
              </p>
            )}
            {!status && error && (
              <>
                <h2>Couldn't load {TV_NAME}</h2>
                <p role="alert">{error}</p>
                <button type="button" className="tv-action" onClick={load}>
                  Try again
                </button>
              </>
            )}
            {status && (
              <>
                <TvIcon />
                {status.state === "upcoming" && status.startsAt ? (
                  <>
                    <h2>{status.title ?? "Next broadcast"}</h2>
                    <p>
                      Starts <time dateTime={status.startsAt}>{startTime(status.startsAt)}</time>. This screen
                      switches to the live race when it begins.
                    </p>
                  </>
                ) : (
                  <>
                    <h2>No live broadcast right now</h2>
                    <p>When {TV_NAME} goes on air, races will play here and this screen will show what's live.</p>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </section>
      {live && status?.title && <h2 className="tv-now">{status.title}</h2>}
      <div className="tv-next">
        <p>Follow Updates for news about {TV_NAME}.</p>
        <Link className="ws-button" to="/updates">
          See Updates
        </Link>
      </div>
    </div>
  );
}

function TvIcon() {
  return (
    <svg className="tv-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="13" rx="2" />
      <path d="M8 2.5l4 3.5 4-3.5" />
      <path d="M10.2 10.2v5.6l4.6-2.8z" />
    </svg>
  );
}
