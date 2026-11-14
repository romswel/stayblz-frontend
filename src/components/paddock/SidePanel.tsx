import { useEffect, useRef, useState } from "react";
import Menu from "../messenger/Menu";
import { useConfirm } from "../ui/Confirm";
import ChatTab from "./ChatTab";
import type { PanelTab } from "./Dock";
import type { CallView, PaddockCall, Person } from "./engine/call";
import { CamOffIcon, CloseIcon, HandIcon, LockIcon, MicIcon, MicOffIcon, MoreIcon, ScreenIcon, UnlockIcon } from "./icons";
import InfoTab from "./InfoTab";
import { Cloth, personMenu, roleTag } from "./Tile";

const TABS: { value: PanelTab; label: string }[] = [
  { value: "people", label: "People" },
  { value: "chat", label: "Chat" },
  { value: "info", label: "Details" },
];

export default function SidePanel({
  view,
  call,
  tab,
  onTab,
  onClose,
  pinned,
  onPin,
}: {
  view: CallView;
  call: PaddockCall;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  onClose: () => void;
  pinned: string | null;
  onPin: (key: string | null) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".modal, .mx-menu, .mx-popover")) return;
      if (ref.current?.contains(document.activeElement)) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside ref={ref} className="pd-panel" aria-label="Call panel">
      <div className="pd-panel-head">
        <div className="pd-tabs" role="tablist" aria-label="Call panel">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              id={`pd-tab-${t.value}`}
              aria-selected={tab === t.value}
              aria-controls={`pd-tabpanel-${t.value}`}
              className={tab === t.value ? "is-active" : ""}
              onClick={() => onTab(t.value)}
            >
              {t.label}
              {t.value === "people" && <span className="pd-tab-count">{view.people.length}</span>}
              {t.value === "chat" && view.unread > 0 && tab !== "chat" && <span className="pd-tab-dot" aria-label={`${view.unread} new`} />}
            </button>
          ))}
        </div>
        <button type="button" className="dlg-close" aria-label="Close panel" title="Close panel" onClick={onClose}>
          <CloseIcon size={16} />
        </button>
      </div>
      <div className="pd-panel-body" role="tabpanel" id={`pd-tabpanel-${tab}`} aria-labelledby={`pd-tab-${tab}`}>
        {tab === "people" && <PeopleTab view={view} call={call} pinned={pinned} onPin={onPin} />}
        {tab === "chat" && <ChatTab view={view} call={call} />}
        {tab === "info" && <InfoTab view={view} call={call} />}
      </div>
    </aside>
  );
}

function PersonRow({ person, view, call, pinned, onPin }: { person: Person; view: CallView; call: PaddockCall; pinned: string | null; onPin: (key: string | null) => void }) {
  const confirm = useConfirm();
  const button = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const tag = roleTag(person);
  return (
    <li className="pd-person">
      <Cloth n={person.number} />
      <span className="pd-person-name">
        <strong>
          {person.name}
          {person.me && " (You)"}
        </strong>
        {(tag || person.state.screen) && (
          <small>
            {[tag, person.state.screen ? "Presenting" : ""].filter(Boolean).join(" · ")}
          </small>
        )}
      </span>
      <span className="pd-person-icons">
        {person.state.hand && (
          <span className="is-hand" title="Hand raised">
            <HandIcon size={15} />
          </span>
        )}
        {person.state.screen && (
          <span title="Presenting">
            <ScreenIcon size={15} />
          </span>
        )}
        {!person.state.cam && (
          <span title="Camera off">
            <CamOffIcon size={15} />
          </span>
        )}
        <span className={person.state.mic ? (person.speaking ? "is-speaking" : "") : "is-muted"} title={person.state.mic ? "Mic on" : "Muted"}>
          {person.state.mic ? <MicIcon size={15} /> : <MicOffIcon size={15} />}
        </span>
      </span>
      <button ref={button} type="button" className="pd-icon-btn" aria-label={`Options for ${person.name}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
        <MoreIcon size={16} />
      </button>
      {menu && (
        <Menu anchor={button.current} label={`Options for ${person.name}`} items={personMenu(person, view, call, pinned, onPin, confirm)} onClose={() => setMenu(false)} />
      )}
    </li>
  );
}

function PeopleTab({ view, call, pinned, onPin }: { view: CallView; call: PaddockCall; pinned: string | null; onPin: (key: string | null) => void }) {
  const confirm = useConfirm();
  const hands = view.people.filter((p) => p.state.hand !== null).sort((a, b) => (a.state.hand ?? 0) - (b.state.hand ?? 0));
  const anyMic = view.people.some((p) => !p.me && p.state.mic);
  return (
    <div className="pd-people">
      {view.canManage && view.knocks.length > 0 && (
        <section className="pd-section is-waiting" aria-label="Waiting to join">
          <h3>
            Waiting to join <span>{view.knocks.length}</span>
          </h3>
          <ul>
            {view.knocks.map((k) => (
              <li key={k.id} className="pd-knock">
                <span className="pd-person-name">
                  <strong>{k.name}</strong>
                  <small>{k.guest ? "Guest (no Stayblz account)" : "Stayblz member"}</small>
                </span>
                <button type="button" className="btn btn-quiet" onClick={() => void call.admit(k.id, false)}>
                  Deny
                </button>
                <button type="button" className="btn btn-primary" onClick={() => void call.admit(k.id, true)}>
                  Admit
                </button>
              </li>
            ))}
          </ul>
          {view.knocks.length > 1 && (
            <button type="button" className="btn btn-quiet pd-wide" onClick={() => void call.admitAll()}>
              Admit all ({view.knocks.length})
            </button>
          )}
        </section>
      )}

      {hands.length > 0 && (
        <section className="pd-section" aria-label="Raised hands">
          <h3>
            Hands up <span>{hands.length}</span>
          </h3>
          <ol className="pd-hands">
            {hands.map((p) => (
              <li key={p.id}>
                <Cloth n={p.number} size="sm" />
                <span>{p.me ? "You" : p.name}</span>
                {(view.canManage || p.me) && (
                  <button type="button" className="pd-link" onClick={() => (p.me ? call.setHand(false) : void call.lowerHand(p.id))}>
                    Lower
                  </button>
                )}
              </li>
            ))}
          </ol>
          {view.canManage && hands.length > 1 && (
            <button type="button" className="pd-link" onClick={() => void call.lowerAll()}>
              Lower all hands
            </button>
          )}
        </section>
      )}

      <section className="pd-section" aria-label="In the call">
        <h3>
          In the call{" "}
          <span>
            {view.people.length} of {view.maxPeople}
          </span>
        </h3>
        <ul>
          {view.people.map((p) => (
            <PersonRow key={p.id} person={p} view={view} call={call} pinned={pinned} onPin={onPin} />
          ))}
        </ul>
      </section>

      {view.canManage && (
        <section className="pd-section pd-host" aria-label="Host tools">
          <h3>Host tools</h3>
          <div className="pd-host-row">
            <button
              type="button"
              className="btn btn-quiet"
              disabled={!anyMic}
              onClick={async () => {
                if (await confirm({ title: "Mute everyone?", message: "Everyone else's microphone turns off. They can unmute themselves when they need to talk.", confirmLabel: "Mute everyone" }))
                  void call.muteAll();
              }}
            >
              <MicOffIcon size={16} /> Mute everyone
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              aria-pressed={view.locked}
              onClick={async () => {
                if (view.locked) return void call.lock(false);
                if (await confirm({ title: "Lock this meeting?", message: "Nobody new can join or ask to join until you unlock it. People already here stay.", confirmLabel: "Lock meeting" }))
                  void call.lock(true);
              }}
            >
              {view.locked ? <UnlockIcon /> : <LockIcon />} {view.locked ? "Unlock meeting" : "Lock meeting"}
            </button>
          </div>
          {view.locked && <p className="pd-small">Locked: nobody new can join or ask to join.</p>}
        </section>
      )}
    </div>
  );
}
