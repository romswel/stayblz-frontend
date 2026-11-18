import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { REACTIONS, emptySummary, react, totalOf, useReactionCounts, type ReactionKey, type ReactionSummary } from "./reactions";

/** Read-only reaction counts for a feed card ("👍 3  🎉 1"). Nothing when there are none. */
export function ReactionCounts({ summary }: { summary: ReactionSummary | undefined }) {
  const total = totalOf(summary);
  if (!summary || !total) return null;
  return (
    <span className="up-react-counts" aria-label={`${total} ${total === 1 ? "reaction" : "reactions"}`}>
      {REACTIONS.filter((r) => summary.counts[r.key]).map((r) => (
        <span key={r.key} className={summary.mine.includes(r.key) ? "is-mine" : undefined} aria-hidden="true">
          {r.emoji} {summary.counts[r.key]}
        </span>
      ))}
    </span>
  );
}

/**
 * "How was this post?" — four reactions under a post. Signed-in readers toggle them (the count
 * changes at once and goes back if saving fails); signed-out readers see the counts and a log in link.
 */
export default function ReactionBar({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const loaded = useReactionCounts([slug])[slug];
  const [summary, setSummary] = useState<ReactionSummary>(emptySummary);
  const [busy, setBusy] = useState<ReactionKey | null>(null);
  const [error, setError] = useState("");
  const touched = useRef(false);
  useEffect(() => {
    if (loaded && !touched.current) setSummary(loaded);
  }, [loaded]);

  async function toggle(key: ReactionKey) {
    if (!signedIn || busy) return;
    touched.current = true;
    const on = !summary.mine.includes(key);
    const before = summary;
    setError("");
    setBusy(key);
    setSummary({
      counts: { ...summary.counts, [key]: Math.max(0, (summary.counts[key] ?? 0) + (on ? 1 : -1)) },
      mine: on ? [...summary.mine, key] : summary.mine.filter((k) => k !== key),
    });
    try {
      setSummary(await react(slug, key, on));
    } catch (reason) {
      setSummary(before);
      setError(reason instanceof Error ? reason.message : "That didn't save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="up-react" aria-label="Reactions">
      <span className="up-react-title">How was this post?</span>
      <div className="up-react-buttons" role="group" aria-label="React to this post">
        {REACTIONS.map((r) => {
          const count = summary.counts[r.key] ?? 0;
          const mine = summary.mine.includes(r.key);
          return (
            <button
              key={r.key}
              type="button"
              className={`up-react-button${mine ? " is-mine" : ""}`}
              aria-pressed={signedIn ? mine : undefined}
              disabled={!signedIn || busy === r.key}
              title={signedIn ? (mine ? `Take back "${r.label}"` : r.label) : "Log in to react"}
              onClick={() => void toggle(r.key)}
            >
              <span className="up-react-emoji" aria-hidden="true">
                {r.emoji}
              </span>
              <span>{r.label}</span>
              {count > 0 && <span className="up-react-count">{count}</span>}
            </button>
          );
        })}
      </div>
      {!signedIn && (
        <p className="up-react-note">
          <Link to="/login" state={{ destination: `/updates/${slug}` }}>
            Log in
          </Link>{" "}
          to react.
        </p>
      )}
      {error && (
        <p className="up-react-note is-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
