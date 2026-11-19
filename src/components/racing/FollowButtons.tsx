import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { followsApi, type FollowKind, type FollowState } from "./follows";

const Star = ({ on }: { on: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.8l-5.8 3 1.1-6.4L2.6 9.8l6.5-.9z" />
  </svg>
);
const Tree = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="5" r="2.5" />
    <circle cx="5" cy="19" r="2.5" />
    <circle cx="19" cy="19" r="2.5" />
    <path d="M12 7.5V12M12 12H5v4.5M12 12h7v4.5" />
  </svg>
);

/**
 * Follow buttons for a racing profile: "Follow" (the horse or person) and, for horses, "Follow family".
 * Signed out: a link to log in that comes back here. Followers get alerts in the bell and on their devices.
 */
export default function FollowButtons({ target, id, name }: { target: "horse" | "person"; id: string; name: string }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const signedIn = !!user && !user.passwordSetupRequired;
  const [state, setState] = useState<FollowState | null>(null);
  const [busy, setBusy] = useState<FollowKind | null>(null);
  const [message, setMessage] = useState("");
  const current = useRef(id);

  useEffect(() => {
    current.current = id;
    setState(null);
    setMessage("");
    if (!signedIn || !id) return;
    const c = new AbortController();
    followsApi
      .state(id, c.signal)
      .then((d) => current.current === id && setState(d.state))
      .catch(() => undefined); // the buttons still work; the first click loads the real state
    return () => c.abort();
  }, [id, signedIn]);

  if (!user)
    return (
      <Link className="btn btn-quiet rc-follow" to="/login" state={{ destination: pathname, intent: `follow ${name}` }}>
        <Star on={false} /> Log in to follow
      </Link>
    );
  if (!signedIn)
    return (
      <p className="rc-follow-hint">
        <Link to="/account/security">Set your password</Link> to follow {name}.
      </p>
    );

  async function toggle(kind: FollowKind) {
    if (busy) return;
    const on = !(state?.[kind] ?? false);
    setBusy(kind);
    setMessage("");
    try {
      const d = await followsApi.set(kind, id, on);
      if (current.current !== id) return;
      setState(d.state);
      setMessage(
        on
          ? kind === "family"
            ? `Following ${name}'s family. You'll get alerts when relatives are entered, race or work out.`
            : `Following ${name}. You'll get alerts for entries, scratches, results${target === "horse" ? " and workouts" : ""}.`
          : kind === "family"
            ? `Stopped following ${name}'s family.`
            : `Stopped following ${name}.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Your follow could not be saved. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const main: FollowKind = target === "horse" ? "horse" : "person";
  const following = state?.[main] ?? false;
  const family = state?.family ?? false;
  const relatives = state?.relatives ?? 0;
  return (
    <div className="rc-follows">
      <div className="rc-follow-row">
        <button
          type="button"
          className={`btn rc-follow${following ? " is-on" : " btn-quiet"}`}
          aria-pressed={following}
          disabled={busy === main}
          onClick={() => toggle(main)}
        >
          <Star on={following} /> {following ? "Following" : "Follow"}
        </button>
        {target === "horse" && (
          <button
            type="button"
            className={`btn rc-follow${family ? " is-on" : " btn-quiet"}`}
            aria-pressed={family}
            disabled={busy === "family"}
            onClick={() => toggle("family")}
            title="Sire, dam, brothers and sisters out of the same dam, and foals"
          >
            <Tree /> {family ? "Following family" : "Follow family"}
          </button>
        )}
      </div>
      {target === "horse" && state && (
        <p className="rc-follow-hint">
          Family = sire, dam, brothers and sisters out of the same dam, and foals
          {relatives > 0 ? ` · ${relatives} on Stayblz now` : " · none on Stayblz yet; new ones count as they appear"}.
        </p>
      )}
      <p className="rc-follow-note" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
