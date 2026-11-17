import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { saddlecloth } from "./brand";
import CornerFloat from "./CornerFloat";
import type { PaddockCall, Person } from "./engine/call";
import { callStore, useActiveCall } from "./engine/store";
import { CamIcon, CamOffIcon, ChatIcon, ExpandIcon, HandIcon, MicIcon, MicOffIcon, PhoneOffIcon, PipIcon } from "./icons";
import { canPip, closePip, openPip } from "./pip";
import { Face, StreamVideo } from "./Preview";
import { Talking } from "./Tile";
import { useCallView } from "./useCall";
import "./paddock.css";
import "./room.css";

/** The call keeps going while you use the rest of Stayblz: this small window shows it. */
export default function MiniCall() {
  const active = useActiveCall();
  const { pathname } = useLocation();
  const onPage = !!active && pathname === `/paddock/${active.code}`;
  useEffect(() => {
    (active as PaddockCall | null)?.setOnPage?.(onPage);
  }, [active, onPage]);
  if (!active || onPage) return null;
  return <MiniWindow call={active as PaddockCall} />;
}

function MiniWindow({ call }: { call: PaddockCall }) {
  const navigate = useNavigate();
  const view = useCallView(call);
  if (view.phase !== "in")
    return (
      <div className="pd-mini is-ended gx-layer" role="status">
        <span>{view.phase === "ended" ? "The call ended." : view.phase === "removed" ? "You were removed from the call." : "You left the call."}</span>
        <button type="button" className="pd-btn is-quiet is-small" onClick={() => callStore.set(null)}>
          Dismiss
        </button>
      </div>
    );
  return (
    <CornerFloat storageKey="stayblz.paddock.miniCorner" scope="window" className="pd-mini gx-layer" label="Call in progress">
      <MiniView call={call} onReturn={(panel) => navigate(`/paddock/${view.code}`, panel ? { state: { panel } } : undefined)} />
    </CornerFloat>
  );
}

/** The call in a small box: who's talking or presenting, people waiting, new messages, quick controls. */
export function MiniView({ call, onReturn, inPip = false }: { call: PaddockCall; onReturn: (panel?: "chat" | "people") => void; inPip?: boolean }) {
  const view = useCallView(call);
  useEffect(() => {
    if (inPip && view.phase !== "in") closePip();
  }, [inPip, view.phase]);
  const others = view.people.filter((p) => !p.me);
  const presenter = others.find((p) => p.screen);
  const focus: Person | undefined = presenter ?? others.find((p) => p.id === view.activeSpeaker) ?? others.find((p) => p.cam) ?? others[0];
  const stream = presenter?.screen ?? focus?.cam ?? null;
  const cloth = saddlecloth(focus?.number ?? 1);
  const knock = view.knocks[0];
  return (
    <div className={`pd-mini-inner${inPip ? " is-pip" : ""}`}>
      <button type="button" className="pd-mini-view" onClick={() => onReturn()} aria-label={`Return to the call: ${view.title}`}>
        {stream ? (
          <StreamVideo stream={stream} fit={presenter ? "contain" : "cover"} />
        ) : focus ? (
          <Face name={focus.name} accountId={focus.accountId} className={`pd-face${focus.speaking ? " is-speaking" : ""}`} style={{ background: cloth.bg, color: cloth.ink }} />
        ) : (
          <span className="pd-mini-alone">Waiting for others to join…</span>
        )}
        <span className="pd-mini-caption">
          <strong>{view.title}</strong>
          <small>
            {focus?.speaking && <Talking />}
            {others.length === 0 ? "Only you" : `${view.people.length} in the call`}
            {focus && ` · ${presenter ? `${presenter.name} is presenting` : focus.name}`}
          </small>
        </span>
        {view.unread > 0 && (
          <span className="pd-mini-unread">
            <ChatIcon size={13} /> {view.unread}
          </span>
        )}
      </button>
      {knock && view.canManage && (
        <div className="pd-mini-knock" role="alert">
          <span>
            <strong>{knock.name}</strong> wants to join{view.knocks.length > 1 ? ` (+${view.knocks.length - 1} more)` : ""}
          </span>
          <button type="button" className="pd-btn is-quiet is-small" onClick={() => void call.admit(knock.id, false)}>
            Deny
          </button>
          <button type="button" className="pd-btn is-primary is-small" onClick={() => void call.admit(knock.id, true)}>
            Admit
          </button>
        </div>
      )}
      <div className="pd-mini-controls">
        <button type="button" className={`pd-round is-small${view.mic ? "" : " is-off"}`} aria-pressed={view.mic} aria-label={view.mic ? "Turn off microphone" : "Turn on microphone"} onClick={() => void call.toggleMic()}>
          {view.mic ? <MicIcon size={16} /> : <MicOffIcon size={16} />}
        </button>
        <button type="button" className={`pd-round is-small${view.cam ? "" : " is-off"}`} aria-pressed={view.cam} aria-label={view.cam ? "Turn off camera" : "Turn on camera"} onClick={() => void call.toggleCam()}>
          {view.cam ? <CamIcon size={16} /> : <CamOffIcon size={16} />}
        </button>
        <button type="button" className={`pd-round is-small${view.hand ? " is-active" : ""}`} aria-pressed={view.hand} aria-label={view.hand ? "Lower your hand" : "Raise your hand"} onClick={() => call.setHand(!view.hand)}>
          <HandIcon size={16} />
        </button>
        {!inPip && canPip() && (
          <button type="button" className="pd-round is-small" aria-label="Picture-in-picture" title="Keep the call on top of other windows" onClick={() => void openPip(call)}>
            <PipIcon />
          </button>
        )}
        <button type="button" className="pd-round is-small" aria-label="Return to the call" title="Return to the call" onClick={() => onReturn()}>
          <ExpandIcon size={16} />
        </button>
        <button type="button" className="pd-round is-small is-leave" aria-label="Leave call" title="Leave call" onClick={() => void call.leave()}>
          <PhoneOffIcon size={16} />
        </button>
      </div>
    </div>
  );
}
