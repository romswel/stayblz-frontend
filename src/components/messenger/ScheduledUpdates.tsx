import { useCallback, useEffect, useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import ScheduledNoteCard from "./ScheduledNoteCard";
import { inPh, sameTarget, scheduleApi, type ScheduleLogEntry, type ScheduleState, type ScheduleTarget } from "./scheduleApi";
import "./scheduled.css";

const STATUS_WORDS: Record<ScheduleLogEntry["status"], string> = {
  sent: "Sent",
  empty: "Nothing to send",
  missed: "Missed",
  failed: "Didn't send",
};

/**
 * Scheduled updates (only for the accounts allowed to use it): three notes, each sent once a day at its Philippine
 * time (9 PM, 1 AM, 5 AM by default) to a chat you pick, plus what happened recently.
 */
export default function ScheduledUpdates({ openChat, onClose }: { openChat: ScheduleTarget | null; onClose: () => void }) {
  const [state, setState] = useState<ScheduleState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const data = await scheduleApi.load(signal);
      if (!signal?.aborted) setState(data);
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : "Scheduled updates couldn't be loaded.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);
  // "in 3 h 12 min" stays current while the dialog is open.
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const chats = state?.chats ?? [];
  const open = openChat ? (chats.find((c) => sameTarget(c, openChat)) ?? null) : null;
  const chatTitle = (t: ScheduleTarget | null) => {
    const found = t ? chats.find((c) => sameTarget(c, t)) : null;
    return found ? found.title : t ? "a chat you've left" : "no chat";
  };
  const replace = (note: ScheduleState["notes"][number]) =>
    setState((old) => (old ? { ...old, notes: old.notes.map((n) => (n.slot === note.slot ? note : n)) } : old));

  async function useForAll(target: ScheduleTarget) {
    if (!state) return;
    setError("");
    try {
      for (const n of state.notes)
        if (!sameTarget(n.chat, target)) replace((await scheduleApi.save(n.slot, { chat: target })).note);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    }
  }

  return (
    <Modal label="Scheduled updates" onClose={onClose} className="modal-wide mx-dialog mx-layer gx-layer sched-dialog">
      <DialogHead kicker="Only you can see this" title="Scheduled updates" onClose={onClose} />
      <div className="dlg sched-body">
        <p className="mx-hint">
          Paste an update into a note. Each note is sent once a day at its Philippine time to the chat you pick, as a normal
          message from you. A note empties after it's sent, unless you keep it.
          {state ? ` If Stayblz's server is off at that time, it still sends up to ${state.lateMinutes} minutes late; after that the time is marked missed.` : ""}
        </p>
        {loading && !state && (
          <p className="ws-loading" role="status">
            Loading your notes…
          </p>
        )}
        {error && (
          <p className="sched-error" role="alert">
            {error}{" "}
            {!state && (
              <button type="button" className="sched-link" onClick={() => void load()}>
                Try again
              </button>
            )}
          </p>
        )}
        {state?.chatsError && <p className="sched-error">Your chats couldn't be loaded, so you can't change where notes go right now.</p>}
        {state && (
          <>
            <div className="sched-notes">
              {state.notes.map((note) => (
                <ScheduledNoteCard
                  key={note.slot}
                  note={note}
                  chats={chats}
                  openChat={open}
                  onNote={replace}
                  onSent={(entry) => entry && setState((old) => (old ? { ...old, history: [entry, ...old.history].slice(0, 30) } : old))}
                  onUseForAll={(t) => void useForAll(t)}
                />
              ))}
            </div>
            <section className="sched-history" aria-labelledby="sched-history-title">
              <div className="sched-history-head">
                <h3 id="sched-history-title">Recent</h3>
                <button type="button" className="sched-link" onClick={() => void load()} disabled={loading}>
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              {state.history.length === 0 ? (
                <p className="mx-hint">Nothing sent yet. Sends, empty notes and missed times show here.</p>
              ) : (
                <ul>
                  {state.history.map((entry) => {
                    return (
                      <li key={entry.id} className={`is-${entry.status}`}>
                        <span className="sched-chip">{STATUS_WORDS[entry.status]}</span>
                        <span className="sched-history-text">
                          <strong>
                            {entry.dueAt ? `${inPh(entry.dueAt)} PH` : `Send now · ${inPh(entry.at)} PH`}
                          </strong>
                          {entry.status === "sent" && <> to {chatTitle(entry.chat)}</>}
                          {entry.preview && <span className="sched-preview">“{entry.preview}”</span>}
                          {entry.detail && entry.status !== "sent" && <span className="sched-detail">{entry.detail}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
