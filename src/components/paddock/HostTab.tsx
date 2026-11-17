import { useEffect, useState } from "react";
import { useConfirm } from "../ui/Confirm";
import type { CallView, PaddockCall } from "./engine/call";
import { paddockApi, type Access, type Meeting, type RuleKey } from "./paddockApi";

const RULES: { key: RuleKey; label: string; hint: string }[] = [
  { key: "present", label: "Share their screen", hint: "Present a screen, a window or a tab." },
  { key: "chat", label: "Send chat messages", hint: "Write in the in-call chat." },
  { key: "react", label: "Send reactions", hint: "Send emoji reactions." },
  { key: "mic", label: "Turn on their microphone", hint: "Off: everyone is muted and stays muted. Hands can still go up." },
  { key: "cam", label: "Turn on their video", hint: "Off: cameras switch off and stay off." },
];

function Switch({ checked, disabled, onChange, label, hint }: { checked: boolean; disabled?: boolean; onChange: (on: boolean) => void; label: string; hint: string }) {
  return (
    <label className="pd-switch">
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

/** Host controls: what everyone may do, who can get in, and actions for the whole call. Hosts and co-hosts. */
export default function HostTab({ view, call }: { view: CallView; call: PaddockCall }) {
  const confirm = useConfirm();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const isHost = view.role === "host" && view.member;

  useEffect(() => {
    if (!isHost) return;
    const controller = new AbortController();
    paddockApi
      .get(view.code, controller.signal)
      .then((d) => setMeeting(d.meeting))
      .catch(() => undefined);
    return () => controller.abort();
  }, [isHost, view.code]);

  async function save(change: { access?: Access; guestsAllowed?: boolean }) {
    if (!meeting) return;
    setSaving(Object.keys(change)[0]);
    setError("");
    try {
      setMeeting((await paddockApi.update(view.code, change)).meeting);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That change wasn't saved. Try again.");
    } finally {
      setSaving("");
    }
  }
  const hands = view.people.some((p) => !p.me && p.state.hand !== null);
  const mics = view.people.some((p) => !p.me && p.state.mic);

  return (
    <div className="pd-host">
      <p className="pd-small">Use these settings to keep the meeting on track. They apply to everyone except hosts and co-hosts.</p>
      <section className="pd-section">
        <h3>Meeting moderation</h3>
        <Switch
          label="Lock the meeting"
          hint="Nobody new can join or ask to join. People already here stay."
          checked={view.locked}
          onChange={async (on) => {
            if (!on) return void call.lock(false);
            if (await confirm({ title: "Lock this meeting?", message: "Nobody new can join or ask to join until you unlock it. People already here stay.", confirmLabel: "Lock meeting" }))
              void call.lock(true);
          }}
        />
      </section>
      <section className="pd-section">
        <h3>Let everyone</h3>
        {RULES.map((r) => (
          <Switch key={r.key} label={r.label} hint={r.hint} checked={view.rules[r.key]} onChange={(on) => void call.setRule(r.key, on)} />
        ))}
      </section>
      {isHost && meeting && (
        <section className="pd-section">
          <h3>Meeting access</h3>
          <label className="pd-option">
            <input type="radio" name="pd-access" checked={meeting.access === "ask"} disabled={!!saving} onChange={() => void save({ access: "ask" })} />
            <span>
              <strong>Invited people join; others ask</strong>
              <small>People you invited (and your stable, if linked) come straight in.</small>
            </span>
          </label>
          <label className="pd-option">
            <input type="radio" name="pd-access" checked={meeting.access === "open"} disabled={!!saving} onChange={() => void save({ access: "open" })} />
            <span>
              <strong>Any Stayblz member with the link</strong>
              <small>Signed-in members join without asking.</small>
            </span>
          </label>
          <Switch
            label="Guests can ask to join"
            hint="People without a Stayblz account type a name and wait for you to let them in."
            checked={meeting.guestsAllowed}
            disabled={!!saving}
            onChange={(on) => void save({ guestsAllowed: on })}
          />
          {error && (
            <p className="pd-error-text" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
      <section className="pd-section">
        <h3>Everyone in the call</h3>
        <div className="pd-host-row">
          <button
            type="button"
            className="pd-btn is-quiet is-small"
            disabled={!mics}
            onClick={async () => {
              if (await confirm({ title: "Mute everyone?", message: "Everyone else's microphone turns off. They can unmute themselves when they need to talk.", confirmLabel: "Mute everyone" }))
                void call.muteAll();
            }}
          >
            Mute everyone
          </button>
          <button type="button" className="pd-btn is-quiet is-small" disabled={!hands} onClick={() => void call.lowerAll()}>
            Lower all hands
          </button>
          <button
            type="button"
            className="pd-btn is-danger is-small"
            onClick={async () => {
              if (await confirm({ title: "End the call for everyone?", message: "Everyone leaves now. The meeting link keeps working, so you can start again later.", confirmLabel: "End for everyone", tone: "danger" }))
                void call.endForAll();
            }}
          >
            End call for everyone
          </button>
        </div>
      </section>
    </div>
  );
}
