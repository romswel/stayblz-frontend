import { useEffect, useRef, useState } from "react";
import Menu from "../messenger/Menu";
import { useConfirm } from "../ui/Confirm";
import ChatTab from "./ChatTab";
import type { PanelTab } from "./Dock";
import type { CallView, PaddockCall, Person } from "./engine/call";
import HostTab from "./HostTab";
import { CamOffIcon, CloseIcon, HandIcon, MicIcon, MicOffIcon, MoreIcon, RingIcon, ScreenIcon, SearchIcon, UserPlusIcon } from "./icons";
import InfoTab from "./InfoTab";
import { paddockApi } from "./paddockApi";
import { Face } from "./Preview";
import { handOrder, personMenu, roleTag, Talking } from "./Tile";
import { saddlecloth } from "./brand";

const TITLES: Record<PanelTab, string> = { people: "People", chat: "In-call messages", info: "Paddock info", host: "Host controls" };

export default function SidePanel({
  view,
  call,
  tab,
  onTab,
  onClose,
  pinned,
  onPin,
  onAddPeople,
}: {
  view: CallView;
  call: PaddockCall;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  onClose: () => void;
  pinned: string | null;
  onPin: (key: string | null) => void;
  onAddPeople: () => void;
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
  const tabs: PanelTab[] = view.canManage ? ["people", "chat", "info", "host"] : ["people", "chat", "info"];
  return (
    <aside ref={ref} className="pd-panel" aria-label={TITLES[tab]}>
      <div className="pd-panel-head">
        <h2>{TITLES[tab]}</h2>
        <button type="button" className="pd-icon-btn" aria-label="Close panel" title="Close panel" onClick={onClose}>
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="pd-tabs" role="tablist" aria-label="Call panel">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`pd-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`pd-tabpanel-${t}`}
            className={tab === t ? "is-active" : ""}
            onClick={() => onTab(t)}
          >
            {t === "people" ? "People" : t === "chat" ? "Chat" : t === "info" ? "Details" : "Host"}
            {t === "people" && <span className="pd-tab-count">{view.people.length}</span>}
            {t === "chat" && view.unread > 0 && tab !== "chat" && <span className="pd-tab-dot" aria-label={`${view.unread} new`} />}
          </button>
        ))}
      </div>
      <div className="pd-panel-body" role="tabpanel" id={`pd-tabpanel-${tab}`} aria-labelledby={`pd-tab-${tab}`}>
        {tab === "people" && <PeopleTab view={view} call={call} pinned={pinned} onPin={onPin} onAddPeople={onAddPeople} />}
        {tab === "chat" && <ChatTab view={view} call={call} />}
        {tab === "info" && <InfoTab view={view} call={call} />}
        {tab === "host" && view.canManage && <HostTab view={view} call={call} />}
      </div>
    </aside>
  );
}

function PersonRow({ person, view, call, pinned, onPin }: { person: Person; view: CallView; call: PaddockCall; pinned: string | null; onPin: (key: string | null) => void }) {
  const confirm = useConfirm();
  const button = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const tag = roleTag(person);
  const cloth = saddlecloth(person.number);
  const hand = handOrder(view, person);
  return (
    <li className="pd-person">
      <Face name={person.name} accountId={person.accountId} className={`pd-face is-small${person.speaking ? " is-speaking" : ""}`} style={{ background: cloth.bg, color: cloth.ink }} />
      <span className="pd-person-name">
        <strong>
          {person.name}
          {person.me && " (You)"}
        </strong>
        {(tag || person.state.screen || view.spotlight === person.id) && (
          <small>{[tag, person.state.screen ? "Presenting" : "", view.spotlight === person.id ? "Spotlight" : ""].filter(Boolean).join(" · ")}</small>
        )}
      </span>
      <span className="pd-person-icons">
        {hand > 0 && (
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
          {person.state.mic ? person.speaking ? <Talking /> : <MicIcon size={15} /> : <MicOffIcon size={15} />}
        </span>
      </span>
      <button ref={button} type="button" className="pd-icon-btn" aria-label={`Options for ${person.name}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
        <MoreIcon size={16} />
      </button>
      {menu && <Menu anchor={button.current} label={`Options for ${person.name}`} items={personMenu(person, view, call, pinned, onPin, confirm)} onClose={() => setMenu(false)} />}
    </li>
  );
}

/** The host sees who was invited but isn't here, to ring them. */
function useInvitees(view: CallView) {
  const [invitees, setInvitees] = useState<{ id: string; name: string }[]>([]);
  const isHost = view.role === "host" && view.member;
  const count = view.people.length;
  useEffect(() => {
    if (!isHost) return;
    const controller = new AbortController();
    paddockApi
      .get(view.code, controller.signal)
      .then((d) => setInvitees(d.meeting.invitees ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [isHost, view.code, count]);
  const here = new Set(view.people.map((p) => p.accountId).filter(Boolean));
  return invitees.filter((p) => !here.has(p.id));
}

function PeopleTab({
  view,
  call,
  pinned,
  onPin,
  onAddPeople,
}: {
  view: CallView;
  call: PaddockCall;
  pinned: string | null;
  onPin: (key: string | null) => void;
  onAddPeople: () => void;
}) {
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const missing = useInvitees(view);
  const ringingNames = new Set(view.ringing.map((r) => r.name));
  const hands = view.people.filter((p) => p.state.hand !== null).sort((a, b) => (a.state.hand ?? 0) - (b.state.hand ?? 0));
  const anyMic = view.people.some((p) => !p.me && p.state.mic);
  const q = query.trim().toLowerCase();
  const shown = q ? view.people.filter((p) => p.name.toLowerCase().includes(q)) : view.people;
  return (
    <div className="pd-people">
      {view.member && (view.canManage || view.role === "member") && (
        <div className="pd-people-actions">
          {view.canManage && (
            <button type="button" className="pd-btn is-primary is-small" onClick={onAddPeople}>
              <UserPlusIcon /> Add people
            </button>
          )}
          <button type="button" className="pd-btn is-quiet is-small" onClick={() => void call.ring()}>
            <RingIcon /> Ring invited
          </button>
        </div>
      )}
      {view.people.length > 3 && (
        <label className="pd-search">
          <SearchIcon />
          <span className="sr-only">Search people in the call</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search for people" />
        </label>
      )}

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
                <button type="button" className="pd-btn is-quiet is-small" onClick={() => void call.admit(k.id, false)}>
                  Deny
                </button>
                <button type="button" className="pd-btn is-primary is-small" onClick={() => void call.admit(k.id, true)}>
                  Admit
                </button>
              </li>
            ))}
          </ul>
          {view.knocks.length > 1 && (
            <button type="button" className="pd-btn is-quiet is-small pd-wide" onClick={() => void call.admitAll()}>
              Admit all ({view.knocks.length})
            </button>
          )}
        </section>
      )}

      {view.ringing.length > 0 && (
        <section className="pd-section" aria-label="Ringing">
          <h3>
            Ringing <span>{view.ringing.length}</span>
          </h3>
          <ul className="pd-ringing">
            {view.ringing.map((r) => (
              <li key={r.name}>
                <span className="pd-ring-dot" aria-hidden="true">
                  <RingIcon size={14} />
                </span>
                {r.name}
              </li>
            ))}
          </ul>
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
                <HandIcon size={15} />
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
          {view.canManage && anyMic && (
            <button
              type="button"
              className="pd-link"
              onClick={async () => {
                if (await confirm({ title: "Mute everyone?", message: "Everyone else's microphone turns off. They can unmute themselves when they need to talk.", confirmLabel: "Mute everyone" }))
                  void call.muteAll();
              }}
            >
              Mute everyone
            </button>
          )}
        </h3>
        <ul>
          {shown.map((p) => (
            <PersonRow key={p.id} person={p} view={view} call={call} pinned={pinned} onPin={onPin} />
          ))}
          {shown.length === 0 && <li className="pd-small">Nobody in the call matches “{query}”.</li>}
        </ul>
      </section>

      {missing.length > 0 && (
        <section className="pd-section" aria-label="Invited, not here yet">
          <h3>
            Invited, not here <span>{missing.length}</span>
          </h3>
          <ul>
            {missing.map((p) => (
              <li key={p.id} className="pd-person is-missing">
                <Face name={p.name} accountId={p.id} className="pd-face is-small" />
                <span className="pd-person-name">
                  <strong>{p.name}</strong>
                  <small>{ringingNames.has(p.name) ? "Ringing…" : "Not in the call"}</small>
                </span>
                <button type="button" className="pd-btn is-quiet is-small" disabled={ringingNames.has(p.name)} onClick={() => void call.ring([p.id])}>
                  <RingIcon /> Ring
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
