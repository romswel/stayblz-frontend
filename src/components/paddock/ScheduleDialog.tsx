import { useState } from "react";
import { useAuth } from "../../auth";
import { useWorkspace } from "../../workspace";
import PersonPicker from "../messenger/PersonPicker";
import type { Person } from "../messenger/types";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import { PADDOCK_NAME } from "./brand";
import { paddockApi, type Access, type Meeting } from "./paddockApi";
import { fromInputs, timeZoneName, toInputs } from "./time";
import "../messenger/messenger.css";
import "../messenger/panels.css";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const durationLabel = (m: number) => (m < 60 ? `${m} minutes` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} hour${m === 60 ? "" : "s"}`);

interface Form {
  title: string;
  date: string;
  clock: string;
  durationMinutes: number;
  access: Access;
  guestsAllowed: boolean;
  stableId: string;
  invitees: Person[];
}

/** Schedule a meeting for later, or change one you host. */
export default function ScheduleDialog({ meeting, onClose, onSaved }: { meeting?: Meeting; onClose: () => void; onSaved: (meeting: Meeting) => void }) {
  const { user } = useAuth();
  const { stables } = useWorkspace();
  const editing = !!meeting;
  const start = toInputs(meeting?.scheduledFor ?? null);
  const initial: Form = {
    title: meeting?.title ?? "",
    date: start.date,
    clock: start.clock,
    durationMinutes: meeting?.durationMinutes ?? 60,
    access: meeting?.access ?? "ask",
    guestsAllowed: meeting?.guestsAllowed ?? true,
    stableId: meeting?.stableId ?? "",
    invitees: (meeting?.invitees ?? []).map((p) => ({ id: p.id, name: p.name }) as Person),
  };
  // New meetings keep a draft; edits start from what's saved.
  const [form, setForm, clearDraft, restored] = useDraft<Form>(editing ? null : accountDraftKey(user?.id, "paddock.schedule"), initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const scheduledFor = fromInputs(form.date, form.clock);
    if (!form.title.trim()) return setError("Give the meeting a name.");
    if (!scheduledFor) return setError("Choose a date and start time.");
    if (Date.parse(scheduledFor) < Date.now() - 5 * 60_000 && !editing) return setError("That time has already passed. Choose a later time.");
    setSaving(true);
    setError("");
    const body = {
      title: form.title.trim(),
      scheduledFor,
      durationMinutes: form.durationMinutes,
      access: form.access,
      guestsAllowed: form.guestsAllowed,
      stableId: form.stableId || null,
      inviteeIds: form.invitees.map((p) => p.id),
    };
    try {
      const saved = editing ? await paddockApi.update(meeting.code, body) : await paddockApi.create(body);
      clearDraft();
      onSaved(saved.meeting);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The meeting wasn't saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal label={editing ? "Edit meeting" : "Schedule a meeting"} onClose={onClose} className="modal-wide">
      <DialogHead kicker={PADDOCK_NAME} title={editing ? "Edit meeting" : "Schedule a meeting"} onClose={onClose} />
      <form
        className="dlg pd-schedule"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {restored && !editing && (
          <p className="pd-callout" role="status">
            We kept what you typed last time.{" "}
            <button type="button" className="pd-link" onClick={() => clearDraft()}>
              Start over
            </button>
          </p>
        )}
        <label className="pd-field">
          <span className="ld-label">Meeting name</span>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={100} placeholder="e.g. Saturday gallops plan" data-autofocus />
        </label>
        <div className="pd-row3">
          <label className="pd-field">
            <span className="ld-label">Date</span>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
          </label>
          <label className="pd-field">
            <span className="ld-label">Start time</span>
            <input type="time" value={form.clock} onChange={(e) => set("clock", e.target.value)} required />
          </label>
          <label className="pd-field">
            <span className="ld-label">Length</span>
            <select value={form.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))}>
              {(DURATIONS.includes(form.durationMinutes) ? DURATIONS : [...DURATIONS, form.durationMinutes].sort((a, b) => a - b)).map((m) => (
                <option key={m} value={m}>
                  {durationLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="pd-small">Times are in {timeZoneName()}. Everyone sees the time in their own time zone.</p>

        <fieldset className="pd-fieldset">
          <legend className="ld-label">Who can join</legend>
          <label className="pd-option">
            <input type="radio" name="pd-sched-access" checked={form.access === "ask"} onChange={() => set("access", "ask")} />
            <span>
              <strong>Invited people join; others ask</strong>
              <small>People you invite below (and your stable, if chosen) come straight in. Anyone else with the link asks and you let them in.</small>
            </span>
          </label>
          <label className="pd-option">
            <input type="radio" name="pd-sched-access" checked={form.access === "open"} onChange={() => set("access", "open")} />
            <span>
              <strong>Any Stayblz member with the link</strong>
              <small>Signed-in members join without asking.</small>
            </span>
          </label>
          <label className="pd-switch">
            <input type="checkbox" role="switch" checked={form.guestsAllowed} onChange={(e) => set("guestsAllowed", e.target.checked)} />
            <span>
              <strong>Guests can ask to join</strong>
              <small>People without an account type a name and wait for you to let them in.</small>
            </span>
          </label>
        </fieldset>

        {stables.length > 0 && (
          <label className="pd-field">
            <span className="ld-label">
              Team meeting <em>Optional</em>
            </span>
            <select value={form.stableId} onChange={(e) => set("stableId", e.target.value)}>
              <option value="">No stable</option>
              {stables.map((s) => (
                <option key={s.id} value={s.id}>
                  Everyone in {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="pd-field">
          <span className="ld-label">
            Invite people <em>Optional</em>
          </span>
          <PersonPicker picked={form.invitees} onChange={(people) => set("invitees", people)} exclude={user ? [user.id] : []} max={50} autoFocus={false} />
          <small className="pd-small">Invited people see this meeting on their {PADDOCK_NAME} page. Stayblz doesn't send emails yet, so share the link too.</small>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Schedule meeting"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
