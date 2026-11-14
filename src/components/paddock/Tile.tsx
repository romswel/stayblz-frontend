import { useRef, useState } from "react";
import Menu, { type MenuEntry } from "../messenger/Menu";
import { useConfirm } from "../ui/Confirm";
import { saddlecloth } from "./brand";
import type { CallView, PaddockCall, Person } from "./engine/call";
import { HandIcon, MicOffIcon, MoreIcon, PinIcon, ScreenOffIcon, SignalIcon } from "./icons";
import type { TileItem } from "./layout";
import { StreamVideo } from "./Preview";
import { initials } from "./useCall";

export const roleTag = (p: Person) => (p.role === "host" ? "Host" : p.role === "cohost" ? "Co-host" : p.guest ? "Guest" : "");

/** The coloured number each person has in the call (like a saddlecloth). */
export function Cloth({ n, size = "md" }: { n: number; size?: "sm" | "md" }) {
  const c = saddlecloth(n);
  return (
    <span className={`pd-cloth is-${size}`} style={{ background: c.bg, color: c.ink }} aria-hidden="true">
      {n}
    </span>
  );
}

export function personMenu(person: Person, view: CallView, call: PaddockCall, pinned: string | null, onPin: (key: string | null) => void, confirm: ReturnType<typeof useConfirm>, key = person.id): MenuEntry[] {
  const items: MenuEntry[] = [
    { label: pinned === key ? "Unpin" : "Pin for me", icon: <PinIcon size={16} />, onSelect: () => onPin(pinned === key ? null : key) },
  ];
  if (person.me || !view.canManage) return items;
  items.push({ section: "Host tools" });
  if (person.state.mic) items.push({ label: "Mute", icon: <MicOffIcon size={16} />, onSelect: () => void call.mute(person.id) });
  if (person.state.hand) items.push({ label: "Lower hand", icon: <HandIcon size={16} />, onSelect: () => void call.lowerHand(person.id) });
  if (person.state.screen) items.push({ label: "Stop their presentation", icon: <ScreenOffIcon size={16} />, onSelect: () => void call.stopScreenOf(person.id) });
  if (view.role === "host" && !person.guest && person.role !== "host")
    items.push({
      label: person.role === "cohost" ? "Remove as co-host" : "Make co-host",
      onSelect: () => void call.makeCohost(person.id, person.role !== "cohost"),
    });
  if (person.role !== "host")
    items.push({
      label: "Remove from call",
      danger: true,
      onSelect: async () => {
        const sure = await confirm({
          title: `Remove ${person.name}?`,
          message: person.guest
            ? "They leave the call now and can't ask to join again from this page."
            : "They leave the call now and can't join this meeting again.",
          confirmLabel: "Remove",
          tone: "danger",
        });
        if (sure) void call.removePerson(person.id);
      },
    });
  return items;
}

const statusText = (p: Person) =>
  p.link === "connecting" ? "Connecting…" : p.link === "reconnecting" ? "Reconnecting…" : p.link === "failed" ? "Couldn't connect" : "";

export default function Tile({
  item,
  view,
  call,
  size,
  pinned,
  onPin,
}: {
  item: TileItem;
  view: CallView;
  call: PaddockCall;
  size: "grid" | "main" | "strip" | "float" | "solo";
  pinned: string | null;
  onPin: (key: string | null) => void;
}) {
  const { person, kind } = item;
  const confirm = useConfirm();
  const menuButton = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const screen = kind === "screen";
  const stream = screen ? person.screen : person.cam;
  const cloth = saddlecloth(person.number);
  const tag = roleTag(person);
  const status = statusText(person);
  const label = [
    screen ? `${person.me ? "Your" : `${person.name}'s`} screen` : person.me ? `${person.name} (you)` : person.name,
    !screen && !person.state.mic ? "muted" : "",
    !screen && person.speaking ? "speaking" : "",
    !screen && person.state.hand ? "hand raised" : "",
    status,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={`pd-tile is-${size}${screen ? " is-screen" : ""}${person.speaking && !screen ? " is-speaking" : ""}${person.me ? " is-me" : ""}`}
      role="group"
      aria-label={label}
      style={{ ["--cloth" as string]: cloth.bg }}
      onDoubleClick={() => onPin(pinned === item.key ? null : item.key)}
    >
      {screen && person.me ? (
        <div className="pd-presenting">
          <strong>You're presenting to everyone</strong>
          <button type="button" className="btn btn-quiet" onClick={() => void call.toggleScreen()}>
            Stop presenting
          </button>
        </div>
      ) : stream ? (
        <StreamVideo
          stream={stream}
          mirror={!screen && person.me && call.media.mirror}
          fit={screen ? "contain" : size === "main" || size === "solo" ? "auto" : "cover"}
        />
      ) : (
        <div className="pd-tile-off">
          <span className="pd-avatar" style={{ background: cloth.bg, color: cloth.ink }} aria-hidden="true">
            {screen ? "…" : initials(person.name)}
          </span>
          {screen && <span className="pd-tile-note">Starting presentation…</span>}
        </div>
      )}

      {status && !screen && (
        <div className={`pd-tile-status${person.link === "failed" ? " is-failed" : ""}`}>
          {person.link !== "failed" && <span className="pd-spinner is-small" aria-hidden="true" />}
          <span>{status}</span>
          {person.link === "failed" && (
            <>
              <small>Their network or yours may block direct calls.</small>
              <button type="button" className="btn btn-quiet" onClick={() => call.retryLink(person.id)}>
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {!screen && person.state.hand && (
        <span className="pd-hand" title="Hand raised">
          <HandIcon size={16} />
        </span>
      )}

      <div className="pd-plate">
        <Cloth n={person.number} size="sm" />
        <span className="pd-plate-name">
          {screen ? `${person.me ? "You" : person.name} · presenting` : person.me ? `${person.name} (You)` : person.name}
        </span>
        {tag && !screen && size !== "float" && <span className="pd-plate-tag">{tag}</span>}
        {!screen && !person.state.mic && (
          <span className="pd-plate-mute" title="Muted">
            <MicOffIcon size={14} />
          </span>
        )}
        {person.quality && person.quality !== "good" && (
          <span className={`pd-plate-signal is-${person.quality}`} title={person.quality === "poor" ? "Weak connection" : "Fair connection"}>
            <SignalIcon level={person.quality} />
          </span>
        )}
      </div>

      {size !== "float" && (
        <button
          ref={menuButton}
          type="button"
          className="pd-tile-more"
          aria-label={`Options for ${screen ? `${person.name}'s screen` : person.name}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          <MoreIcon size={18} />
        </button>
      )}
      {pinned === item.key && (
        <span className="pd-pinned" title="Pinned">
          <PinIcon size={14} />
        </span>
      )}
      {menu && (
        <Menu
          anchor={menuButton.current}
          label={`Options for ${person.name}`}
          items={personMenu(person, view, call, pinned, onPin, confirm, item.key)}
          onClose={() => setMenu(false)}
        />
      )}
    </div>
  );
}
