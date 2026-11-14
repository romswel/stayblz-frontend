import { useRef, useState, type ReactNode, type Ref } from "react";
import Menu, { type MenuEntry } from "../messenger/Menu";
import Popover from "../messenger/Popover";
import { useConfirm } from "../ui/Confirm";
import { meetingLink } from "./brand";
import type { CallView, PaddockCall } from "./engine/call";
import { canShareScreen } from "./engine/media";
import {
  CamIcon,
  CamOffIcon,
  ChatIcon,
  ChevronUpIcon,
  CopyIcon,
  ExpandIcon,
  GearIcon,
  GridIcon,
  HandIcon,
  InfoIcon,
  KeyboardIcon,
  MicIcon,
  MicOffIcon,
  MoreIcon,
  PeopleIcon,
  PhoneOffIcon,
  ScreenIcon,
  SmileIcon,
  SwitchCamIcon,
} from "./icons";
import { LAYOUTS, type LayoutMode } from "./layout";
import { modKey } from "./useCall";

export type PanelTab = "people" | "chat" | "info";
export const REACTIONS = ["👍", "👏", "❤️", "😂", "🎉", "😮", "🐎", "🏆"];

function DockButton({
  label,
  hint,
  active,
  off,
  onClick,
  children,
  badge,
  className = "",
  pressed,
  buttonRef,
  expanded,
}: {
  label: string;
  hint?: string;
  active?: boolean;
  off?: boolean;
  onClick: () => void;
  children: ReactNode;
  badge?: number | string;
  className?: string;
  pressed?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
  expanded?: boolean;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`pd-dock-btn${active ? " is-active" : ""}${off ? " is-off" : ""} ${className}`}
      aria-label={hint ?? label}
      title={hint ?? label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <span className="pd-dock-icon">
        {children}
        {badge !== undefined && badge !== 0 && <span className="pd-badge">{badge}</span>}
      </span>
      <span className="pd-dock-label">{label}</span>
    </button>
  );
}

export default function Dock({
  view,
  call,
  panel,
  onPanel,
  layout,
  onLayout,
  onSettings,
  onShortcuts,
  narrow,
}: {
  view: CallView;
  call: PaddockCall;
  panel: PanelTab | null;
  onPanel: (tab: PanelTab | null) => void;
  layout: LayoutMode;
  onLayout: (mode: LayoutMode) => void;
  onSettings: () => void;
  onShortcuts: () => void;
  narrow: boolean;
}) {
  const confirm = useConfirm();
  const [open, setOpen] = useState<null | "mic" | "cam" | "more" | "react" | "leave" | "layout">(null);
  const refs = {
    mic: useRef<HTMLButtonElement>(null),
    cam: useRef<HTMLButtonElement>(null),
    more: useRef<HTMLButtonElement>(null),
    react: useRef<HTMLButtonElement>(null),
    leave: useRef<HTMLButtonElement>(null),
    layout: useRef<HTMLButtonElement>(null),
  };
  const mod = modKey();
  const media = call.media;
  const toggle = (which: typeof open) => setOpen((v) => (v === which ? null : which));
  const panelButton = (tab: PanelTab) => onPanel(panel === tab ? null : tab);
  const screenOk = canShareScreen();
  const people = view.people.length;

  const deviceItems = (kind: "audioinput" | "videoinput"): MenuEntry[] => {
    const list = media.devices[kind];
    const current = (kind === "audioinput" ? media.micTrack : media.camTrack)?.getSettings?.().deviceId ?? media.choice[kind];
    const items: MenuEntry[] = [{ section: kind === "audioinput" ? "Microphone" : "Camera" }];
    if (!list.length) items.push({ label: kind === "audioinput" ? "No microphone found" : "No camera found", onSelect: () => undefined, disabled: true });
    list.forEach((d, i) =>
      items.push({
        label: d.label || `${kind === "audioinput" ? "Microphone" : "Camera"} ${i + 1}`,
        checked: d.deviceId === current,
        onSelect: () => void call.chooseDevice(kind, d.deviceId),
      }),
    );
    if (kind === "audioinput" && media.devices.audiooutput.length) {
      items.push({ section: "Speaker" });
      items.push({ label: "Choose in settings…", icon: <GearIcon size={16} />, onSelect: onSettings });
    } else items.push({ label: "All settings…", icon: <GearIcon size={16} />, onSelect: onSettings });
    return items;
  };

  const moreItems: MenuEntry[] = [
    ...(narrow
      ? ([
          { label: `People (${people})`, icon: <PeopleIcon size={16} />, onSelect: () => onPanel("people") },
          { label: view.unread ? `Chat (${view.unread} new)` : "Chat", icon: <ChatIcon size={16} />, onSelect: () => onPanel("chat") },
          { label: "Meeting details", icon: <InfoIcon size={16} />, onSelect: () => onPanel("info") },
          ...(screenOk
            ? [{ label: view.screen ? "Stop presenting" : "Present your screen", icon: <ScreenIcon size={16} />, onSelect: () => void call.toggleScreen() }]
            : []),
        ] as MenuEntry[])
      : []),
    ...(media.devices.videoinput.length > 1 && view.cam
      ? [{ label: "Switch camera", icon: <SwitchCamIcon size={16} />, onSelect: () => void media.flipCamera() }]
      : []),
    { section: "Layout" },
    ...LAYOUTS.map((l) => ({ label: l.label, checked: layout === l.value, onSelect: () => onLayout(l.value) })),
    { section: "More" },
    { label: "Settings", icon: <GearIcon size={16} />, onSelect: onSettings },
    {
      label: document.fullscreenElement ? "Exit full screen" : "Full screen",
      icon: <ExpandIcon size={16} />,
      onSelect: () => {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        else void document.documentElement.requestFullscreen?.().catch(() => undefined);
      },
    },
    { label: "Copy meeting link", icon: <CopyIcon size={16} />, onSelect: () => void navigator.clipboard?.writeText(meetingLink(view.code)).catch(() => undefined) },
    ...(!narrow ? [{ label: "Keyboard shortcuts", icon: <KeyboardIcon size={16} />, onSelect: onShortcuts }] : []),
  ];

  async function endForAll() {
    const sure = await confirm({
      title: "End the call for everyone?",
      message: "Everyone leaves now. The meeting link keeps working, so you can start again later.",
      confirmLabel: "End for everyone",
      tone: "danger",
    });
    if (sure) void call.endForAll();
  }

  return (
    <footer className="pd-dock" aria-label="Call controls">
      <div className="pd-dock-main">
        <div className="pd-split">
          <DockButton
            label="Mic"
            hint={`${view.mic ? "Turn off microphone" : "Turn on microphone"} (${mod}+D)`}
            off={!view.mic}
            pressed={view.mic}
            onClick={() => void call.toggleMic()}
          >
            {view.mic ? <MicIcon /> : <MicOffIcon />}
          </DockButton>
          {!narrow && (
            <button ref={refs.mic} type="button" className="pd-caret" aria-label="Microphone options" aria-haspopup="menu" aria-expanded={open === "mic"} onClick={() => toggle("mic")}>
              <ChevronUpIcon />
            </button>
          )}
        </div>
        <div className="pd-split">
          <DockButton
            label="Camera"
            hint={`${view.cam ? "Turn off camera" : "Turn on camera"} (${mod}+E)`}
            off={!view.cam}
            pressed={view.cam}
            onClick={() => void call.toggleCam()}
          >
            {view.cam ? <CamIcon /> : <CamOffIcon />}
          </DockButton>
          {!narrow && (
            <button ref={refs.cam} type="button" className="pd-caret" aria-label="Camera options" aria-haspopup="menu" aria-expanded={open === "cam"} onClick={() => toggle("cam")}>
              <ChevronUpIcon />
            </button>
          )}
        </div>
        {!narrow && screenOk && (
          <DockButton
            label={view.screen ? "Stop" : "Present"}
            hint={view.screen ? "Stop presenting" : "Present your screen"}
            active={view.screen}
            pressed={view.screen}
            onClick={() => void call.toggleScreen()}
          >
            <ScreenIcon />
          </DockButton>
        )}
        <DockButton label="React" hint="Send a reaction" buttonRef={refs.react} expanded={open === "react"} onClick={() => toggle("react")}>
          <SmileIcon />
        </DockButton>
        <DockButton
          label={view.hand ? "Lower" : "Hand"}
          hint={`${view.hand ? "Lower your hand" : "Raise your hand"} (${mod}+Alt+H)`}
          active={view.hand}
          pressed={view.hand}
          onClick={() => call.setHand(!view.hand)}
        >
          <HandIcon />
        </DockButton>
        <DockButton label="More" hint="More options" buttonRef={refs.more} expanded={open === "more"} onClick={() => toggle("more")} badge={narrow && view.unread ? view.unread : undefined}>
          <MoreIcon />
        </DockButton>
        <button
          ref={refs.leave}
          type="button"
          className="pd-leave"
          aria-label={view.canManage ? "Leave or end the call" : "Leave call"}
          title={view.canManage ? "Leave or end the call" : "Leave call"}
          aria-haspopup={view.canManage ? "menu" : undefined}
          onClick={() => (view.canManage ? toggle("leave") : void call.leave())}
        >
          <PhoneOffIcon />
          <span>Leave</span>
        </button>
      </div>
      {!narrow && (
        <div className="pd-dock-side">
          <DockButton
            label="People"
            hint={view.knocks.length ? `People (${people}, ${view.knocks.length} waiting to join)` : `People (${people})`}
            active={panel === "people"}
            onClick={() => panelButton("people")}
            badge={view.knocks.length ? `+${view.knocks.length}` : people}
            className={view.knocks.length ? "has-waiting" : ""}
          >
            <PeopleIcon />
          </DockButton>
          <DockButton label="Chat" hint={view.unread ? `Chat (${view.unread} new)` : "Chat"} active={panel === "chat"} onClick={() => panelButton("chat")} badge={view.unread || undefined}>
            <ChatIcon />
          </DockButton>
          <DockButton label="Details" hint="Meeting details" active={panel === "info"} onClick={() => panelButton("info")}>
            <InfoIcon />
          </DockButton>
          <DockButton label="Layout" hint="Change layout" buttonRef={refs.layout} expanded={open === "layout"} onClick={() => toggle("layout")}>
            <GridIcon />
          </DockButton>
        </div>
      )}

      {open === "mic" && <Menu anchor={refs.mic.current} label="Microphone options" items={deviceItems("audioinput")} onClose={() => setOpen(null)} align="start" />}
      {open === "cam" && <Menu anchor={refs.cam.current} label="Camera options" items={deviceItems("videoinput")} onClose={() => setOpen(null)} align="start" />}
      {open === "more" && <Menu anchor={refs.more.current} label="More options" items={moreItems} onClose={() => setOpen(null)} />}
      {open === "layout" && (
        <Menu
          anchor={refs.layout.current}
          label="Layout"
          items={[{ section: "Layout" }, ...LAYOUTS.map((l) => ({ label: `${l.label} — ${l.hint}`, checked: layout === l.value, onSelect: () => onLayout(l.value) }))]}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "leave" && (
        <Menu
          anchor={refs.leave.current}
          label="Leave options"
          items={[
            { label: "Leave the call", icon: <PhoneOffIcon size={16} />, onSelect: () => void call.leave() },
            { label: "End the call for everyone", danger: true, onSelect: () => void endForAll() },
          ]}
          onClose={() => setOpen(null)}
        />
      )}
      {open === "react" && (
        <ReactionPicker anchor={refs.react.current} onPick={(emoji) => call.react(emoji)} onClose={() => setOpen(null)} />
      )}
    </footer>
  );
}

function ReactionPicker({ anchor, onPick, onClose }: { anchor: HTMLElement | null; onPick: (emoji: string) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  return (
    <Popover anchor={anchor} align="start">
      <div
        ref={box}
        className="pd-reactions-pick"
        role="toolbar"
        aria-label="Reactions"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onClose();
            anchor?.focus();
          }
        }}
        onBlur={(e) => {
          if (!box.current?.contains(e.relatedTarget as Node) && e.relatedTarget !== anchor) onClose();
        }}
      >
        {REACTIONS.map((emoji, i) => (
          <button key={emoji} type="button" aria-label={`React with ${emoji}`} autoFocus={i === 0} onClick={() => onPick(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
    </Popover>
  );
}
