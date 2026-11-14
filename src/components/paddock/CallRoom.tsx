import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PADDOCK_NAME } from "./brand";
import Dock, { type PanelTab } from "./Dock";
import type { CallView, PaddockCall } from "./engine/call";
import { LockIcon, MinimizeIcon, PaddockMark, PeopleIcon, SpeakerIcon } from "./icons";
import type { LayoutMode } from "./layout";
import { SettingsDialog, ShortcutsDialog } from "./SettingsDialog";
import SidePanel from "./SidePanel";
import Stage from "./Stage";
import { FloatingReactions, Toasts } from "./Toasts";
import { duration, useNow } from "./useCall";

const LAYOUT_KEY = "stayblz.paddock.layout";
const readLayout = (): LayoutMode => {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    return v === "grid" || v === "spotlight" || v === "sidebar" ? v : "auto";
  } catch {
    return "auto";
  }
};
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

export default function CallRoom({ call, view, canMinimize }: { call: PaddockCall; view: CallView; canMinimize: boolean }) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<PanelTab | null>(null);
  const [layout, setLayoutState] = useState<LayoutMode>(readLayout);
  const [pinned, setPinned] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "settings" | "shortcuts">(null);
  // Same breakpoint as the compact dock in room.css.
  const narrow = useMatch("(max-width: 900px)");
  const now = useNow();

  const setLayout = (mode: LayoutMode) => {
    setLayoutState(mode);
    try {
      localStorage.setItem(LAYOUT_KEY, mode);
    } catch {
      /* A convenience. */
    }
  };
  const togglePanel = useCallback((tab: PanelTab) => setPanel((current) => (current === tab ? null : tab)), []);

  useEffect(() => call.setChatOpen(panel === "chat"), [call, panel]);
  useEffect(() => {
    const before = document.title;
    document.title = `${view.title || "Call"} · ${PADDOCK_NAME}`;
    return () => {
      document.title = before;
    };
  }, [view.title]);

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
        void call.media.setMic(true);
      } else if (e.key === "?" && !typingIn(e.target) && !document.querySelector(".modal")) {
        setDialog("shortcuts");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && talking) {
        talking = false;
        void call.media.setMic(false);
      }
    };
    const blur = () => {
      if (talking) {
        talking = false;
        void call.media.setMic(false);
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

  return (
    <div className={`pd-room${panel ? " has-panel" : ""}`} aria-label={`Call: ${view.title}`} role="region">
      <header className="pd-top">
        <div className="pd-top-title">
          <span className="pd-top-mark" aria-hidden="true">
            <PaddockMark size={18} />
          </span>
          <div>
            <strong>{view.title}</strong>
            <small>
              <span className="pd-code">{view.code}</span> · <span aria-label="Time in call">{duration(now - view.startedAt)}</span>
            </small>
          </div>
        </div>
        <div className="pd-top-right">
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
        <Stage view={view} call={call} mode={layout} pinned={pinned} onPin={setPinned} />
        {panel && (
          <SidePanel view={view} call={call} tab={panel} onTab={setPanel} onClose={() => setPanel(null)} pinned={pinned} onPin={setPinned} />
        )}
      </div>

      <FloatingReactions view={view} />
      <Toasts view={view} call={call} onOpenChat={() => setPanel("chat")} onOpenPeople={() => setPanel("people")} />
      <Dock
        view={view}
        call={call}
        panel={panel}
        onPanel={setPanel}
        layout={layout}
        onLayout={setLayout}
        onSettings={() => setDialog("settings")}
        onShortcuts={() => setDialog("shortcuts")}
        narrow={narrow}
      />
      {dialog === "settings" && <SettingsDialog call={call} onClose={() => setDialog(null)} />}
      {dialog === "shortcuts" && <ShortcutsDialog onClose={() => setDialog(null)} />}
    </div>
  );
}
