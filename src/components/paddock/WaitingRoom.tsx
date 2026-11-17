import type { LocalMedia } from "./engine/media";
import { CamIcon, CamOffIcon, MicIcon, MicOffIcon, PhoneOffIcon } from "./icons";
import { SelfPreview } from "./Preview";
import { meetingTime } from "./time";
import { useMedia } from "./useCall";

/** A horse looking over the paddock rails (drawn here, so nothing to download). */
export function PaddockArt() {
  return (
    <svg className="pd-art" viewBox="0 0 320 220" role="img" aria-label="A horse waiting by the paddock rails">
      <defs>
        <linearGradient id="pd-art-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--gx-accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--gx-accent-2)" stopOpacity="0.12" />
        </linearGradient>
      </defs>
      <circle cx="226" cy="70" r="54" fill="url(#pd-art-sky)" className="pd-art-sun" />
      <circle cx="70" cy="46" r="7" fill="none" stroke="var(--gx-accent-2)" strokeWidth="2" className="pd-art-bubble" />
      <circle cx="96" cy="26" r="4" fill="var(--gx-accent)" className="pd-art-bubble is-late" />
      {/* Rails */}
      <g stroke="var(--gx-text-2)" strokeWidth="5" strokeLinecap="round" opacity="0.75">
        <path d="M20 150h280M20 186h280" />
        <path d="M44 128v80M160 128v80M276 128v80" />
      </g>
      {/* Horse head and neck over the top rail */}
      <g className="pd-art-horse">
        <path
          d="M118 214c4-34 10-60 26-84l-22 9-8-11 30-26 3-20 18 18c26 15 34 46 31 114Z"
          fill="var(--gx-text)"
        />
        <path d="m156 96 18 15-14 10" fill="none" stroke="var(--gx-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="153" cy="104" r="3.2" fill="var(--gx-bg-solid)" />
      </g>
      <path d="M20 214h280" stroke="var(--gx-border-strong)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** After "Ask to join": wait for a host, with your own camera in the corner and quick controls. */
export default function WaitingRoom({
  title,
  scheduledFor,
  durationMinutes,
  hostPresent,
  media,
  name,
  accountId,
  onCancel,
}: {
  title: string;
  scheduledFor: string | null;
  durationMinutes: number;
  hostPresent: boolean;
  media: LocalMedia;
  name: string;
  accountId?: string | null;
  onCancel: () => void;
}) {
  useMedia(media);
  const when = meetingTime(scheduledFor, durationMinutes);
  return (
    <section className="pd-waitroom" aria-labelledby="pd-wait-title">
      <div className="pd-waitroom-text">
        {when && <span className="pd-chip">{when}</span>}
        <span className="pd-kicker">Asking to join</span>
        <h1 id="pd-wait-title">{title}</h1>
        <p className="pd-waitroom-status" role="status" aria-live="polite">
          <span className="pd-spinner" aria-hidden="true" />
          <span>
            <strong>Waiting for someone to let you in…</strong>
            {hostPresent
              ? "The host has been told you're here. Keep this page open."
              : "The host isn't in the call yet. You'll be let in once they join and say yes. Keep this page open."}
          </span>
        </p>
      </div>
      <PaddockArt />
      <div className="pd-waitroom-self">
        <SelfPreview media={media} name={name} accountId={accountId} compact />
      </div>
      <div className="pd-waitroom-dock gx-glass" role="group" aria-label="While you wait">
        <button
          type="button"
          className={`pd-dock-round${media.micOn ? "" : " is-off"}`}
          aria-pressed={media.micOn}
          aria-label={media.micOn ? "Turn off microphone" : "Turn on microphone"}
          onClick={() => void media.setMic(!media.micOn)}
        >
          {media.micOn ? <MicIcon /> : <MicOffIcon />}
        </button>
        <button
          type="button"
          className={`pd-dock-round${media.camOn ? "" : " is-off"}`}
          aria-pressed={media.camOn}
          aria-label={media.camOn ? "Turn off camera" : "Turn on camera"}
          onClick={() => void media.setCam(!media.camOn)}
        >
          {media.camOn ? <CamIcon /> : <CamOffIcon />}
        </button>
        <button type="button" className="pd-leave" onClick={onCancel}>
          <PhoneOffIcon />
          <span>Cancel</span>
        </button>
      </div>
    </section>
  );
}
