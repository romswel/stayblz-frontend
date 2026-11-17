import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Brand from "../Brand";
import { PADDOCK_NAME } from "./brand";
import { AddPeopleDialog, LayoutDialog } from "./CallDialogs";
import Dock, { type PanelTab } from "./Dock";
import type { CallView, PaddockCall } from "./engine/call";
import { CloseIcon, InfoIcon, LockIcon, MinimizeIcon, PeopleIcon, RingIcon, SpeakerIcon, UserPlusIcon } from "./icons";
import { CopyLink } from "./InfoTab";
import { readPrefs, savePrefs, type ViewPrefs } from "./layout";
import { openPip } from "./pip";
import { SettingsDialog, ShortcutsDialog } from "./SettingsDialog";
import SidePanel from "./SidePanel";
import Stage from "./Stage";
import { FloatingReactions, Toasts } from "./Toasts";
import { duration, useNow } from "./useCall";

function useMatch(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatch(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return match;
}
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement && !!target.closest("input, textarea, select, [contenteditable='true']");

/** "Your meeting's ready": shown while you're the only one here, until closed. */
function ReadyCard({ view, onAdd, onClose }: { view: CallView; onAdd: () => void; onClose: () => void }) {
  return (
    <section className="pd-ready gx-glass" aria-labelledby="pd-ready-title">
      <header>
        <h2 id="pd-ready-title">{view.canManage ? "Your meeting's ready" : "You're the only one here"}</h2>
        <button type="button" className="pd-icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon size={18} />
        </button>
      </header>
      {view.canManage && view.member && (
        <button type="button" className="pd-btn is-primary is-small" onClick={onAdd}>
          <UserPlusIcon /> Add others
        </button>
      )}
      <p className="pd-small">{view.canManage && view.member ? "Or share this meeting link with others you want in the meeting." : "Share this link to bring more people in."}</p>
      <CopyLink code={view.code} label="Copy meeting link" />
      <p className="pd-ready-note">
        <InfoIcon size={16} /> People without an invitation ask to join, and a host lets them in.
      </p>
      <small className="pd-ready-me">Joined as {view.me.name}</small>
    </section>
  );
}

export default function CallRoom({ call, view, canMinimize }: { call: PaddockCall; view: CallView; canMinimize: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [panel, setPanel] = useState<PanelTab | null>(() => (location.state as { panel?: PanelTab } | null)?.panel ?? null);
  const [prefs, setPrefsState] = useState<ViewPrefs>(readPrefs);
  const [pinned, setPinned] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "settings" | "shortcuts" | "layout" | "add">(null);
  const [readyClosed, setReadyClosed] = useState(false);
  // Same breakpoint as the compact dock in room.css.
  const narrow = useMatch("(max-width: 900px)");
  const now = useNow();

  const setPrefs = (next: ViewPrefs) => {
    setPrefsState(next);
    savePrefs(next);
  };
  const togglePanel = useCallback((tab: PanelTab) => setPanel((current) => (current === tab ? null : tab)), []);

  useEffect(() => call.setChatOpen(panel === "chat"), [call, panel]);
  useEffect(() => {
    call.setOnPage(true);
    return () => call.setOnPage(false);
  }, [call]);
  // A host's "Admit" from the mini window or a toast opens People here.
  useEffect(() => {
    const wanted = (location.state as { panel?: PanelTab } | null)?.panel;
    if (wanted) setPanel(wanted);
  }, [location.state]);
  useEffect(() => {
    const before = document.title;
    document.title = `${view.title || "Call"} · ${PADDOCK_NAME}`;
    return () => {
      document.title = before;
    };
  }, [view.title]);
  // Browsers that float a call automatically when you switch tabs (Chrome) use this.
  useEffect(() => {
    try {
      navigator.mediaSession?.setActionHandler("enterpictureinpicture" as MediaSessionAction, () => void openPip(call));
    } catch {
      /* Not supported. */
    }
  }, [call]);

  // Keyboard shortcuts, and hold Space to talk while muted.
  useEffect(() => {
    let talking = false;
    const down = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.altKey && !e.shiftKey && e.code === "KeyD") {
        e.preventDefault();
        void call.toggleMic();
      } else if (mod && !e.altKey && !e.shiftKey && e.code === "KeyE") {
        e.preventDefault();
        void call.toggleCam();
      } else if (mod && e.altKey && e.code === "KeyH") {
        e.preventDefault();
        call.setHand(!call.getView().hand);
      } else if (mod && e.altKey && e.code === "KeyC") {
        e.preventDefault();
        togglePanel("chat");
      } else if (mod && e.altKey && e.code === "KeyP") {
        e.preventDefault();
        togglePanel("people");
      } else if (
        e.code === "Space" &&
        !e.repeat &&
        !mod &&
        !typingIn(e.target) &&
        !(e.target instanceof HTMLButtonElement) &&
        !document.querySelector(".modal, .mx-menu") &&
        !call.media.micOn &&
        call.media.micTrack
      ) {
        e.preventDefault();
        talking = true;
        call.talk(true);
      } else if (e.key === "?" && !typingIn(e.target) && !document.querySelector(".modal")) {
        setDialog("shortcuts");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && talking) {
        talking = false;
        call.talk(false);
      }
    };
    const blur = () => {
      if (talking) {
        talking = false;
        call.talk(false);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [call, togglePanel]);

  function minimize() {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === "number" && idx > 0) navigate(-1);
    else navigate("/paddock");
  }
  const alone = view.people.length === 1;

  return (
    <div className={`pd-room${panel ? " has-panel" : ""}`} aria-label={`Call: ${view.title}`} role="region">
      <header className="pd-top">
        <div className="pd-top-title">
          <span className="pd-crest is-small" aria-hidden="true">
            <Brand />
          </span>
          <div>
            <strong>{view.title}</strong>
            <small>
              <span className="pd-code">{view.code}</span> · <span aria-label="Time in call">{duration(now - view.startedAt)}</span>
            </small>
          </div>
        </div>
        <div className="pd-top-right">
          {view.ringing.length > 0 && (
            <span className="pd-chip is-ringing" title={view.ringing.map((r) => r.name).join(", ")}>
              <RingIcon size={14} /> Ringing {view.ringing.length === 1 ? view.ringing[0].name : `${view.ringing.length} people`}…
            </span>
          )}
          {view.locked && (
            <span className="pd-chip" title="Nobody new can join">
              <LockIcon size={14} /> Locked
            </span>
          )}
          <button type="button" className="pd-chip is-button" onClick={() => togglePanel("people")} aria-label={`People in the call: ${view.people.length} of ${view.maxPeople}`}>
            <PeopleIcon size={15} /> {view.people.length}/{view.maxPeople}
          </button>
          {canMinimize && (
            <button type="button" className="pd-top-btn" onClick={minimize} title="Keep the call going in a small window while you use Stayblz">
              <MinimizeIcon size={16} /> <span>Browse Stayblz</span>
            </button>
          )}
        </div>
      </header>

      {(view.trouble || view.rejoining) && (
        <p className="pd-banner" role="status">
          {view.rejoining ? "Reconnecting to Stayblz…" : "We can't reach Stayblz right now. Your call keeps going; changes catch up when the connection is back."}
        </p>
      )}
      {view.audioBlocked && (
        <button type="button" className="pd-banner is-action" onClick={() => call.resumeAudio()}>
          <SpeakerIcon size={16} /> Your browser paused the sound. Click here to hear everyone.
        </button>
      )}

      <div className="pd-body">
        <Stage view={view} call={call} prefs={prefs} pinned={pinned} onPin={setPinned} />
        {panel && (
          <SidePanel
            view={view}
            call={call}
            tab={panel === "host" && !view.canManage ? "people" : panel}
            onTab={setPanel}
            onClose={() => setPanel(null)}
            pinned={pinned}
            onPin={setPinned}
            onAddPeople={() => setDialog("add")}
          />
        )}
        {alone && !readyClosed && <ReadyCard view={view} onAdd={() => setDialog("add")} onClose={() => setReadyClosed(true)} />}
      </div>

      <FloatingReactions view={view} />
      <Toasts view={view} call={call} onOpenChat={() => setPanel("chat")} onOpenPeople={() => setPanel("people")} />
      <Dock
        view={view}
        call={call}
        panel={panel}
        onPanel={setPanel}
        onLayout={() => setDialog("layout")}
        onSettings={() => setDialog("settings")}
        onShortcuts={() => setDialog("shortcuts")}
        onPip={() => void openPip(call)}
        narrow={narrow}
      />
      {dialog === "settings" && <SettingsDialog call={call} onClose={() => setDialog(null)} />}
      {dialog === "shortcuts" && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {dialog === "layout" && <LayoutDialog prefs={prefs} onChange={setPrefs} onClose={() => setDialog(null)} />}
      {dialog === "add" && <AddPeopleDialog call={call} onClose={() => setDialog(null)} />}
    </div>
  );
}
