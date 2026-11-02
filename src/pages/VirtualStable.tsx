import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
interface WatchItem {
  id: string;
  name: string;
  watched: boolean;
  lastActivity: string;
  nextAlert: string | null;
}
type Kind = "horses" | "jockeys" | "trainers";
export default function VirtualStable({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [kind, setKind] = useState<Kind>("horses");
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [pending, setPending] = useState<string[]>([]);
  const pendingRef = useRef(new Set<string>());
  const [search, setSearch] = useState("");
  const [onlyFollowing, setOnlyFollowing] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    setItems([]);
    api
      .get<{ stable: WatchItem[] }>(
        `/api/watchlist${kind === "horses" ? "" : `?kind=${kind}`}`,
        { signal: c.signal },
      )
      .then((d) => {
        if (!c.signal.aborted) {
          if (!Array.isArray(d.stable))
            throw Error("Your follows could not be loaded.");
          setItems(d.stable);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [kind, version]);
  async function toggle(item: WatchItem) {
    if (pendingRef.current.has(item.id)) return;
    pendingRef.current.add(item.id);
    setPending([...pendingRef.current]);
    setSaveError("");
    try {
      const saved = await api.post<{ id: string; watched: boolean }>(
        "/api/watchlist/toggle",
        { id: item.id, watched: !item.watched },
      );
      setItems((old) =>
        old.map((w) =>
          w.id === item.id ? { ...w, watched: saved.watched } : w,
        ),
      );
    } catch (e) {
      setSaveError(
        e instanceof Error
          ? e.message
          : "Your follow preference could not be saved.",
      );
    } finally {
      pendingRef.current.delete(item.id);
      setPending([...pendingRef.current]);
    }
  }
  const filtered = items.filter(
    (i) =>
      (!onlyFollowing || i.watched) &&
      i.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <section>
      <div className="mr-intro">
        <span className="ov-kicker">YOUR PERSONAL VIRTUAL STABLE</span>
        {embedded ? <h2>Follow the form.</h2> : <h1>Following</h1>}
        <p>
          Keep the horses and racing people you care about close. Following does
          not mean owning a horse or joining a stable team.
        </p>
      </div>
      <div className="mr-follows-toolbar">
        <div className="ov-tabs">
          {(["horses", "jockeys", "trainers"] as const).map((k) => (
            <button
              key={k}
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setSearch("");
              }}
            >
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label="Search follows"
          placeholder={`Search ${kind}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="mr-follow-count">
        <label>
          <input
            type="checkbox"
            checked={onlyFollowing}
            onChange={(e) => setOnlyFollowing(e.target.checked)}
          />{" "}
          Only following
        </label>
        {!loading && !error && (
          <span>
            {" "}
            · {items.filter((i) => i.watched).length} following in this category
          </span>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}{" "}
          <button
            className="ws-button"
            onClick={() => setVersion((v) => v + 1)}
          >
            Retry follows
          </button>
        </p>
      )}
      {saveError && (
        <p className="form-error" role="alert">
          {saveError}
        </p>
      )}
      <div className="ov-paper">
        {loading ? (
          <p className="ov-empty">Loading your racing follows…</p>
        ) : error ? (
          <p className="ov-empty">
            Your follows could not be loaded. Use Retry follows to try again.
          </p>
        ) : !filtered.length ? (
          <div className="mr-empty">
            <h3>
              {search
                ? "No matches."
                : onlyFollowing
                  ? "Your list starts here."
                  : "The published field is still to come."}
            </h3>
            <p>
              {search
                ? "Try another name."
                : onlyFollowing
                  ? "Turn off Only following to explore available names."
                  : `Published ${kind} will appear here when available.`}
            </p>
          </div>
        ) : (
          <ul className="mr-follow-list">
            {filtered.map((w) => (
              <li key={w.id}>
                <button
                  className={`star-btn${w.watched ? " on" : ""}`}
                  disabled={pending.includes(w.id)}
                  onClick={() => void toggle(w)}
                  aria-pressed={w.watched}
                  aria-label={
                    w.watched ? `Stop watching ${w.name}` : `Watch ${w.name}`
                  }
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill={w.watched ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4-4.7-4.6 6.5-.9Z" />
                  </svg>
                </button>
                <div>
                  <strong>{w.name}</strong>
                  <p>{w.lastActivity}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="ov-footnote">
        Saved to your account across devices. Shows up to 500 published names
        per category plus your saved follows. Automatic alerts are not active
        yet. <Link to="/my-racing?tab=alerts">Choose alert preferences ↗</Link>
      </p>
    </section>
  );
}
