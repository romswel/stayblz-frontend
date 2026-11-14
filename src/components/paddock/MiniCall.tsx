import { useLocation, useNavigate } from "react-router-dom";
import CornerFloat from "./CornerFloat";
import type { PaddockCall, Person } from "./engine/call";
import { callStore, useActiveCall } from "./engine/store";
import { CamIcon, CamOffIcon, ExpandIcon, MicIcon, MicOffIcon, PhoneOffIcon } from "./icons";
import { StreamVideo } from "./Preview";
import { saddlecloth } from "./brand";
import { initials, useCallView } from "./useCall";
import "./paddock.css";
import "./room.css";

/** The call keeps going while you use the rest of Stayblz: this small window shows it. */
export default function MiniCall() {
  const active = useActiveCall();
  const { pathname } = useLocation();
  if (!active || pathname === `/paddock/${active.code}`) return null;
  return <MiniWindow call={active as PaddockCall} />;
}

function MiniWindow({ call }: { call: PaddockCall }) {
  const view = useCallView(call);
  const navigate = useNavigate();
  const back = () => navigate(`/paddock/${view.code}`);
  if (view.phase !== "in")
    return (
      <div className="pd-mini is-ended" role="status">
        <span>{view.phase === "ended" ? "The call ended." : view.phase === "removed" ? "You were removed from the call." : "You left the call."}</span>
        <button type="button" className="btn btn-quiet" onClick={() => callStore.set(null)}>
          Dismiss
        </button>
      </div>
    );
  const others = view.people.filter((p) => !p.me);
  const presenter = others.find((p) => p.screen);
  const focus: Person | undefined = presenter ?? others.find((p) => p.id === view.activeSpeaker) ?? others.find((p) => p.cam) ?? others[0];
  const stream = presenter?.screen ?? focus?.cam ?? null;
  const cloth = saddlecloth(focus?.number ?? 1);
  return (
    <CornerFloat storageKey="stayblz.paddock.miniCorner" scope="window" className="pd-mini" label="Call in progress">
      <button type="button" className="pd-mini-view" onClick={back} aria-label={`Return to the call: ${view.title}`}>
        {stream ? (
          <StreamVideo stream={stream} fit={presenter ? "contain" : "cover"} />
        ) : (
          <span className="pd-avatar" style={{ background: cloth.bg, color: cloth.ink }} aria-hidden="true">
            {focus ? initials(focus.name) : "…"}
          </span>
        )}
        <span className="pd-mini-caption">
          <strong>{view.title}</strong>
          <small>
            {others.length === 0 ? "Waiting for others" : `${view.people.length} in the call`}
            {focus && ` · ${presenter ? `${presenter.name} is presenting` : focus.name}`}
          </small>
        </span>
      </button>
      <div className="pd-mini-controls">
        <button type="button" className={`pd-round is-small${view.mic ? "" : " is-off"}`} aria-pressed={view.mic} aria-label={view.mic ? "Turn off microphone" : "Turn on microphone"} onClick={() => void call.toggleMic()}>
          {view.mic ? <MicIcon size={16} /> : <MicOffIcon size={16} />}
        </button>
        <button type="button" className={`pd-round is-small${view.cam ? "" : " is-off"}`} aria-pressed={view.cam} aria-label={view.cam ? "Turn off camera" : "Turn on camera"} onClick={() => void call.toggleCam()}>
          {view.cam ? <CamIcon size={16} /> : <CamOffIcon size={16} />}
        </button>
        <button type="button" className="pd-round is-small" aria-label="Return to the call" title="Return to the call" onClick={back}>
          <ExpandIcon size={16} />
        </button>
        <button type="button" className="pd-round is-small is-leave" aria-label="Leave call" title="Leave call" onClick={() => void call.leave()}>
          <PhoneOffIcon size={16} />
        </button>
      </div>
    </CornerFloat>
  );
}
