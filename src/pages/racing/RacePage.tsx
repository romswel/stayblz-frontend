import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoadNotice, RaceView, RacingHead, useRacing } from "../../components/racing/RacingParts";
import { dateLabel } from "../../components/racing/format";
import type { Race, Track } from "../../components/racing/types";
import StatusPage from "../../components/status/StatusPage";

type Loaded = {
  race: Race;
  day: { id: string; date: string };
  track: Track;
  previous: { id: string; number: number } | null;
  next: { id: string; number: number } | null;
};

/** A single race: entries before it runs, the full chart once it's official. Shareable. */
export default function RacePage() {
  const { id = "" } = useParams();
  const { data, loading, error, missing, retry } = useRacing<Loaded>(`/api/public/racing/races/${encodeURIComponent(id)}`);
  const [note, setNote] = useState("");
  if (missing)
    return (
      <StatusPage
        kind="not-found"
        title="That race isn't published"
        message="It may have been taken down for corrections. Check Entries or Results for the latest cards."
        actions={
          <Link className="btn btn-primary status-primary" to="/results">
            See results
          </Link>
        }
      />
    );
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setNote("Link copied.");
      }
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setNote("Copy the address from your browser to share it.");
    }
  }
  return (
    <div className="rc-page">
      <RacingHead
        eyebrow={data ? `${data.track.name} · ${dateLabel(data.day.date, "short")}` : "Race"}
        title={data ? `Race ${data.race.number}` : "Race"}
        actions={
          data && (
            <>
              <button type="button" className="btn btn-quiet" onClick={() => void share()}>
                Share
              </button>
              {note && <span role="status">{note}</span>}
            </>
          )
        }
      />
      <LoadNotice loading={loading && !data} error={error} retry={retry} />
      {data && (
        <>
          <nav className="up-crumbs" aria-label="Breadcrumb">
            <Link to={`/entries?date=${data.day.date}`}>{dateLabel(data.day.date, "short")}</Link>
            <span aria-hidden="true">/</span>
            <Link to={`/racing/days/${data.day.id}`}>{data.track.name}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Race {data.race.number}</span>
          </nav>
          <RaceView race={data.race} />
          <nav className="up-neighbours rc-neighbours" aria-label="Other races">
            {data.previous ? (
              <Link className="up-neighbour" to={`/racing/races/${data.previous.id}`}>
                <small>← Previous</small>Race {data.previous.number}
              </Link>
            ) : (
              <span />
            )}
            {data.next ? (
              <Link className="up-neighbour is-older" to={`/racing/races/${data.next.id}`}>
                <small>Next →</small>Race {data.next.number}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </>
      )}
    </div>
  );
}
