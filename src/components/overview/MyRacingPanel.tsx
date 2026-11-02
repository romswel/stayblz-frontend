import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { OverviewSection } from "./RacingSections";
export default function MyRacingPanel() {
  const [data, setData] = useState<{
    following: number;
    notes: number;
    conversations: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    api
      .get<typeof data>("/api/my-racing/summary", { signal: c.signal })
      .then((d) => {
        if (!c.signal.aborted) {
          if (
            !d ||
            !["following", "notes", "conversations"].every(
              (k) => typeof d[k as keyof typeof d] === "number",
            )
          )
            throw Error("Your racing summary could not be loaded.");
          setData(d);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [version]);
  return (
    <OverviewSection
      id="my-racing"
      number="05"
      title="Your side of the rail"
      subtitle="Follows, notes & conversations"
      link="/my-racing"
    >
      <div className="ov-personal-grid">
        {[
          [
            "Following",
            data?.following,
            "/my-racing",
            "Horses, jockeys & trainers",
          ],
          [
            "Race notebook",
            data?.notes,
            "/my-racing?tab=notes",
            "Your private observations",
          ],
          [
            "Messages",
            data?.conversations,
            "/messages",
            "Your racing conversations",
          ],
        ].map(([label, count, path, detail]) => (
          <Link key={label} to={String(path)}>
            <span>{label} ↗</span>
            <strong>{count ?? "—"}</strong>
            <small>{detail}</small>
          </Link>
        ))}
      </div>
      {error && (
        <div className="ov-load-error">
          <p role="status">Your account summary is unavailable.</p>
          <button
            className="ws-button"
            onClick={() => {
              setError("");
              setVersion((v) => v + 1);
            }}
          >
            Retry account summary
          </button>
        </div>
      )}
      <p className="ov-footnote">
        Saved to your account. You do not need to own or join a stable to use My
        racing.
      </p>
    </OverviewSection>
  );
}
