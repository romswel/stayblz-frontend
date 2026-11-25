import { useEffect, useRef, useState } from "react";
import { useConfirm } from "../ui/Confirm";
import {
  awayFromPh,
  clockLabel,
  inPh,
  localTime,
  sameTarget,
  scheduleApi,
  targetKey,
  untilText,
  type NoteChange,
  type ScheduleChat,
  type ScheduledNote,
  type ScheduleLogEntry,
  type ScheduleTarget,
} from "./scheduleApi";

const SAVE_AFTER_MS = 700;

/**
 * One scheduled note: its Philippine time, on/off, the chat it goes to, the words (saved as you type), keep-or-empty,
 * and Send now / Skip next / Clear.
 */
export default function ScheduledNoteCard({
  note,
  chats,
  openChat,
  onNote,
  onSent,
  onUseForAll,
}: {
  note: ScheduledNote;
  chats: ScheduleChat[];
  /** The chat open behind the dialog, if it's one you can send to. */
  openChat: ScheduleChat | null;
  onNote: (note: ScheduledNote) => void;
  onSent: (entry: ScheduleLogEntry | null) => void;
  onUseForAll: (target: ScheduleTarget) => void;
}) {
  const confirm = useConfirm();
  const [text, setText] = useState(note.body);
  const [saving, setSaving] = useState<"" | "saving" | "saved" | "failed">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(note);
  latest.current = note;

  // The server emptied the note after sending (or another device changed it) and nothing is waiting to save.
  useEffect(() => {
    if (pending.current === null) setText(note.body);
  }, [note.body]);

  async function save(change: NoteChange) {
    setSaving("saving");
    setError("");
    const before = latest.current;
    // Switches, the chat and the time change on screen at once; the words are already in the box.
    const { body: _body, ...shown } = change;
    if (Object.keys(shown).length) onNote({ ...before, ...shown });
    try {
      const { note: saved } = await scheduleApi.save(note.slot, change);
      if (change.body !== undefined && pending.current === change.body) pending.current = null;
      onNote(saved);
      // Words typed since then are still waiting: don't say "Saved" yet.
      setSaving(pending.current === null ? "saved" : "");
      return true;
    } catch (e) {
      if (Object.keys(shown).length) onNote(before);
      setSaving("failed");
      setError(e instanceof Error ? e.message : "Couldn't save.");
      return false;
    }
  }
  function flush() {
    window.clearTimeout(timer.current);
    if (pending.current !== null) void save({ body: pending.current });
  }
  // Closing the dialog mid-typing still saves.
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function type(value: string) {
    setText(value);
    pending.current = value;
    setSaving("");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_AFTER_MS);
  }

  const target = chats.find((c) => sameTarget(c, note.chat)) ?? null;
  const chatName = (c: ScheduleChat) => (c.kind === "team" ? `${c.title} · ${c.stableName ?? "Stable"}` : c.title);

  async function sendNow() {
    if (!target || !text.trim()) return;
    if (!(await confirm({ title: `Send this note to ${chatName(target)} now?`, message: "It goes out as a normal message from you. The schedule stays the same.", confirmLabel: "Send now" })))
      return;
    window.clearTimeout(timer.current);
    setBusy(true);
    setError("");
    try {
      // Send exactly what's in the box: save the last few keys first.
      if (pending.current !== null && !(await save({ body: pending.current }))) return;
      const r = await scheduleApi.sendNow(note.slot);
      onNote(r.note);
      onSent(r.entry);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Not sent.");
    } finally {
      setBusy(false);
    }
  }
  async function skip(on: boolean) {
    setBusy(true);
    setError("");
    try {
      onNote((await scheduleApi.skip(note.slot, on)).note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }
  async function clear() {
    if (!(await confirm({ title: "Clear this note?", message: "The words are removed. Nothing is sent.", confirmLabel: "Clear note", tone: "danger" })))
      return;
    window.clearTimeout(timer.current);
    pending.current = "";
    setText("");
    await save({ body: "" });
  }

  const phTime = clockLabel(note.sendAt);
  const showLocal = awayFromPh();
  const status = !note.enabled
    ? "Off. Nothing is sent at this time."
    : !target
      ? "Pick a chat to send it to."
      : !text.trim()
        ? `Empty. Nothing will go out at ${phTime}.`
        : note.skippingAt
          ? `Skipping ${inPh(note.skippingAt)}. Then ${inPh(note.nextAt)}.`
          : `Sends ${inPh(note.nextAt)} PH (${untilText(note.nextAt)}).`;
  const groups: [string, ScheduleChat[]][] = (
    [
      ["Groups", chats.filter((c) => c.kind === "personal" && c.group)],
      ["One-to-one", chats.filter((c) => c.kind === "personal" && !c.group)],
    ] as [string, ScheduleChat[]][]
  ).concat(
    [...new Set(chats.filter((c) => c.kind === "team").map((c) => c.stableName ?? "Stable"))].map(
      (name): [string, ScheduleChat[]] => [`Team · ${name}`, chats.filter((c) => c.kind === "team" && (c.stableName ?? "Stable") === name)],
    ),
  ).filter(([, list]) => list.length > 0);
  const id = `sched-${note.slot}`;

  return (
    <section className={`sched-note${note.enabled ? "" : " is-off"}`} aria-labelledby={`${id}-title`}>
      <header className="sched-note-head">
        <div>
          <h3 id={`${id}-title`}>
            {phTime} <small>PH time</small>
          </h3>
          {showLocal && <span className="sched-local">{localTime(note.nextAt)} your time</span>}
        </div>
        <label className="sched-switch">
          <input
            type="checkbox"
            role="switch"
            checked={note.enabled}
            onChange={(e) => void save({ enabled: e.target.checked })}
            aria-label={`Send the ${phTime} note`}
          />
          <span aria-hidden="true" />
          {note.enabled ? "On" : "Off"}
        </label>
      </header>
      <p className={`sched-status${note.enabled && target && text.trim() ? " is-ready" : ""}`} role="status">
        {status}
      </p>

      <div className="sched-fields">
        <label className="sched-field">
          <span>Send to</span>
          <select
            value={target ? targetKey(target) : ""}
            onChange={(e) => {
              const picked = chats.find((c) => targetKey(c) === e.target.value);
              void save({ chat: picked ? { kind: picked.kind, id: picked.id, stableId: picked.stableId } : null });
            }}
          >
            <option value="">Pick a chat…</option>
            {groups.map(([label, list]) => (
              <optgroup key={label} label={label}>
                {list.map((c) => (
                  <option key={targetKey(c)} value={targetKey(c)}>
                    {c.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="sched-field sched-time">
          <span>Time (PH)</span>
          <input type="time" value={note.sendAt} step={60} onChange={(e) => e.target.value && void save({ sendAt: e.target.value })} />
        </label>
      </div>
      {(openChat && !sameTarget(openChat, target)) || target ? (
        <div className="sched-links">
          {openChat && !sameTarget(openChat, target) && (
            <button type="button" className="sched-link" onClick={() => void save({ chat: openChat })}>
              Use the open chat ({openChat.title})
            </button>
          )}
          {target && (
            <button type="button" className="sched-link" onClick={() => onUseForAll(target)}>
              Use this chat for all three
            </button>
          )}
        </div>
      ) : null}

      <label className="sched-field sched-text">
        <span>
          Update <em className="sched-count">{text.length.toLocaleString()} / 4,000</em>
        </span>
        <textarea
          value={text}
          maxLength={4000}
          rows={5}
          placeholder="Paste your progress update here…"
          onChange={(e) => type(e.target.value)}
          onBlur={flush}
        />
      </label>
      <div className="sched-row">
        <label className="sched-check">
          <input type="checkbox" checked={note.keepAfterSend} onChange={(e) => void save({ keepAfterSend: e.target.checked })} />
          Keep it after sending (repeats every day)
        </label>
        <span className={`sched-saved is-${saving || "idle"}`} aria-live="polite">
          {saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : saving === "failed" ? "Not saved" : ""}
        </span>
      </div>
      {error && (
        <p className="sched-error" role="alert">
          {error}{" "}
          {saving === "failed" && (
            <button type="button" className="sched-link" onClick={() => void save({ body: text })}>
              Try again
            </button>
          )}
        </p>
      )}
      <div className="sched-actions">
        <button type="button" className="btn btn-quiet" onClick={clear} disabled={busy || !text}>
          Clear
        </button>
        {note.enabled && (
          <button type="button" className="btn btn-quiet" onClick={() => void skip(!note.skippingAt)} disabled={busy}>
            {note.skippingAt ? "Undo skip" : "Skip next"}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={() => void sendNow()} disabled={busy || !target || !text.trim()}>
          {busy ? "Working…" : "Send now"}
        </button>
      </div>
    </section>
  );
}
