import { useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import type { PaddockCall } from "./engine/call";
import { setSoundsOn, soundsOn } from "./engine/sounds";
import { DevicePickers, LevelMeter, StreamVideo } from "./Preview";
import { modKey, useMedia } from "./useCall";

export function SettingsDialog({ call, onClose }: { call: PaddockCall; onClose: () => void }) {
  const media = call.media;
  useMedia(media);
  const [sounds, setSounds] = useState(soundsOn);
  const [mirror, setMirror] = useState(media.mirror);
  return (
    <Modal label="Call settings" onClose={onClose}>
      <DialogHead kicker="Stayblz Paddock" title="Settings" onClose={onClose} />
      <div className="dlg pd-settings">
        <div className="pd-settings-preview">
          {media.camOn && media.camStream ? (
            <StreamVideo stream={media.camStream} mirror={mirror} label="Your camera" />
          ) : (
            <span className="pd-small">Your camera is off.</span>
          )}
        </div>
        <DevicePickers media={media} onSpeaker={(id) => void call.chooseDevice("audiooutput", id)} />
        <p className="pd-small pd-level-row">
          Mic level <LevelMeter media={media} /> {media.micOn ? "" : "(you're muted)"}
        </p>
        <label className="pd-switch">
          <input
            type="checkbox"
            role="switch"
            checked={mirror}
            onChange={(e) => {
              media.setMirror(e.target.checked);
              setMirror(e.target.checked);
            }}
          />
          <span>
            <strong>Mirror my video</strong>
            <small>Only changes your own view. Others always see you the right way round.</small>
          </span>
        </label>
        <label className="pd-switch">
          <input
            type="checkbox"
            role="switch"
            checked={sounds}
            onChange={(e) => {
              setSoundsOn(e.target.checked);
              setSounds(e.target.checked);
            }}
          />
          <span>
            <strong>Play sounds</strong>
            <small>A soft tone when people join, leave, ask to join or send a message.</small>
          </span>
        </label>
        <div className="dlg-actions">
          <span />
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const mod = modKey();
  const rows: [string, string][] = [
    [`${mod} + D`, "Turn microphone on or off"],
    [`${mod} + E`, "Turn camera on or off"],
    ["Hold Space", "Talk while muted (push to talk)"],
    [`${mod} + Alt + H`, "Raise or lower your hand"],
    [`${mod} + Alt + C`, "Open or close chat"],
    [`${mod} + Alt + P`, "Open or close people"],
    ["Esc", "Close a panel or menu"],
  ];
  return (
    <Modal label="Keyboard shortcuts" className="modal-sm" onClose={onClose}>
      <DialogHead kicker="Stayblz Paddock" title="Keyboard shortcuts" onClose={onClose} />
      <div className="dlg">
        <dl className="pd-keys">
          {rows.map(([keys, what]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  );
}
