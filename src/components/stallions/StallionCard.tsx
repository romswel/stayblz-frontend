import { useState } from "react";
import { Link } from "react-router-dom";
import { stallionPicture } from "./api";
import { AVAILABILITY, ageOf, breedLabel, breedingLine, feeText, hands, recordText, regionLabel } from "./options";
import type { StallionCard as Card } from "./types";

export const CrestIcon = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 20c1-6 4-7 6-11l-5 2-1.5-2.5L11 3.5l1-3 4 4c5 3 6.5 9 6 15.5z" />
  </svg>
);
const HeartIcon = ({ on }: { on: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);

export function StallionPhoto({ stallion, className = "" }: { stallion: Pick<Card, "cover" | "name">; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = !broken ? stallionPicture(stallion.cover) : null;
  return (
    <span className={`st-photo ${className}`}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : <CrestIcon />}
    </span>
  );
}

export function AvailabilityTag({ value }: { value: string }) {
  const a = AVAILABILITY.find((x) => x.value === value);
  return <span className={`st-tag is-${a?.tone ?? "muted"}`}>{a?.label ?? value}</span>;
}

/** One stallion in the directory: picture, breeding, fee, where he stands, and Save / Compare. */
export default function StallionCard({
  stallion: s,
  compared,
  compareFull,
  onCompare,
  onSave,
  saving,
}: {
  stallion: Card;
  compared: boolean;
  compareFull: boolean;
  onCompare: () => void;
  /** Missing for signed-out visitors (Save needs an account). */
  onSave?: () => void;
  saving?: boolean;
}) {
  const age = ageOf(s.foaled);
  const facts = [breedLabel(s.breed), age !== null ? `${age} yrs` : "", s.color, hands(s.heightIn)].filter(Boolean).join(" · ");
  const record = recordText(s.raceRecord);
  return (
    <article className={`st-card gx-glass${s.featured ? " is-featured" : ""}`}>
      <Link to={`/stallions/${s.id}`} className="st-card-link" aria-label={`${s.name}, ${feeText(s)}. Open his page`}>
        <StallionPhoto stallion={s} className="st-card-photo" />
        <span className="st-card-badges">
          {s.featured && <span className="st-tag is-featured">Featured</span>}
          {s.videoCount > 0 && <span className="st-tag is-dark">Video</span>}
        </span>
      </Link>
      <div className="st-card-body">
        <div className="st-card-title">
          <h3>
            <Link to={`/stallions/${s.id}`}>{s.name}</Link>
          </h3>
          <span className="st-card-fee">
            {feeText(s)}
            {s.fee !== null && <small> {s.seasonYear}</small>}
          </span>
        </div>
        {breedingLine(s) && <p className="st-card-line">{breedingLine(s)}</p>}
        <p className="st-card-facts">{facts}</p>
        <p className="st-card-where">
          {[s.farm, s.location].filter(Boolean).join(", ") || regionLabel(s.region)}
        </p>
        <div className="st-card-meta">
          <AvailabilityTag value={s.availability} />
          {record && <span className="st-chip" title="Starts: wins-seconds-thirds (owner's figures)">{record}</span>}
          {!!s.runners && <span className="st-chip is-data" title="Offspring on Stayblz racing pages">{s.runners} {s.runners === 1 ? "runner" : "runners"}</span>}
          {s.methods.length > 0 && s.methods[0] !== "live_cover" && <span className="st-chip">{s.methods.includes("frozen") ? "Frozen" : "Shipped"}</span>}
        </div>
      </div>
      <div className="st-card-actions">
        {onSave ? (
          <button type="button" className={`st-icon-btn${s.saved ? " is-on" : ""}`} onClick={onSave} disabled={saving} aria-pressed={s.saved} title={s.saved ? "Saved" : "Save"} aria-label={s.saved ? `Remove ${s.name} from saved` : `Save ${s.name}`}>
            <HeartIcon on={s.saved} />
            <span>{s.saves}</span>
          </button>
        ) : (
          <Link to="/login" className="st-icon-btn" title="Log in to save" aria-label={`Log in to save ${s.name}`}>
            <HeartIcon on={false} />
            <span>{s.saves}</span>
          </Link>
        )}
        <label className={`st-compare-check${compared ? " is-on" : ""}`} title={compareFull && !compared ? "You can compare up to 3" : undefined}>
          <input type="checkbox" checked={compared} onChange={onCompare} disabled={compareFull && !compared} />
          Compare
        </label>
      </div>
    </article>
  );
}
