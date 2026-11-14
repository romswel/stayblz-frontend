import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import Menu from "../messenger/Menu";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { codeFrom, MAX_PEOPLE, PADDOCK_NAME } from "./brand";
import { useActiveCall } from "./engine/store";
import { CalendarIcon, ClockIcon, LinkIcon, PaddockMark, PlusIcon } from "./icons";
import { CopyLink } from "./InfoTab";
import MeetingRow from "./MeetingRow";
import { paddockApi, type Meeting } from "./paddockApi";
import ScheduleDialog from "./ScheduleDialog";
import { isUpcoming } from "./time";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; meetings: Meeting[] };

export default function PaddockHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const active = useActiveCall();
  const liveCall = active?.isLive() ? active : null;
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [busy, setBusy] = useState<"" | "now" | "link">("");
  const [actionError, setActionError] = useState("");
  const [newMenu, setNewMenu] = useState(false);
  const newButton = useRef<HTMLButtonElement>(null);
  const [schedule, setSchedule] = useState<{ meeting?: Meeting } | null>(null);
  const [made, setMade] = useState<Meeting | null>(null);
  const [refresh, setRefresh] = useState(0);
  const firstName = (user?.displayName ?? "").trim().split(/\s+/)[0];
  const instantTitle = firstName ? `${firstName}'s meeting` : "My meeting";

  const fetchHome = useCallback(async (signal: AbortSignal, quiet: boolean) => {
    if (!quiet) setLoad((current) => (current.status === "ready" ? current : { status: "loading" }));
    try {
      const data = await paddockApi.home(signal);
      if (!signal.aborted) setLoad({ status: "ready", meetings: data.meetings });
    } catch (error) {
      // A quiet refresh that fails keeps what's on screen.
      if (!signal.aborted && !quiet) setLoad({ status: "error", message: error instanceof Error ? error.message : "Meetings didn't load." });
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetchHome(controller.signal, false);
    const timer = window.setInterval(() => document.visibilityState === "visible" && void fetchHome(controller.signal, true), 20_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [fetchHome, refresh]);

  async function create(kind: "now" | "link") {
    setBusy(kind);
    setActionError("");
    try {
      const { meeting } = await paddockApi.create({ title: instantTitle });
      if (kind === "now") navigate(`/paddock/${meeting.code}`);
      else {
        setMade(meeting);
        setRefresh((n) => n + 1);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The meeting couldn't be created. Try again.");
    } finally {
      setBusy("");
    }
  }

  function join() {
    const found = codeFrom(code);
    if (!found) return setCodeError("Enter a meeting code like abcd-efgh, or paste the meeting link.");
    setCodeError("");
    navigate(`/paddock/${found}`);
  }

  const meetings = load.status === "ready" ? load.meetings : [];
  const upcoming = meetings
    .filter((m) => m.live.count > 0 || isUpcoming(m.scheduledFor, m.durationMinutes))
    .sort((a, b) => b.live.count - a.live.count || Date.parse(a.scheduledFor ?? a.createdAt) - Date.parse(b.scheduledFor ?? b.createdAt));
  const recent = meetings.filter((m) => !upcoming.includes(m)).slice(0, 20);
  const row = (m: Meeting) => (
    <MeetingRow
      key={m.id}
      meeting={m}
      inCall={liveCall?.code === m.code}
      onEdit={() => setSchedule({ meeting: m })}
      onDelete={async () => {
        try {
          await paddockApi.remove(m.code);
          setRefresh((n) => n + 1);
        } catch (error) {
          setActionError(error instanceof Error ? error.message : "The meeting wasn't deleted. Try again.");
        }
      }}
    />
  );

  return (
    <div className="pd-home">
      {liveCall && (
        <p className="pd-callout is-gold" role="status">
          You're in a call right now.{" "}
          <Link to={`/paddock/${liveCall.code}`} className="btn btn-primary">
            Return to the call
          </Link>
        </p>
      )}
      <section className="pd-hero" aria-labelledby="pd-home-title">
        <div className="pd-hero-text">
          <span className="pd-hero-mark" aria-hidden="true">
            <PaddockMark size={28} />
          </span>
          <h1 id="pd-home-title">{PADDOCK_NAME}</h1>
          <p>Video meetings for owners, trainers and their teams. Free, right in your browser, for up to {MAX_PEOPLE} people.</p>
          <div className="pd-hero-actions">
            <button ref={newButton} type="button" className="btn btn-primary pd-new" aria-haspopup="menu" aria-expanded={newMenu} onClick={() => setNewMenu((v) => !v)} disabled={!!busy}>
              <PlusIcon /> {busy === "now" ? "Starting…" : busy === "link" ? "Creating…" : "New meeting"}
            </button>
            <form
              className="pd-joinbox"
              onSubmit={(e) => {
                e.preventDefault();
                join();
              }}
            >
              <label className="sr-only" htmlFor="pd-code">
                Meeting code or link
              </label>
              <input
                id="pd-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeError("");
                }}
                placeholder="Enter a code or link"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!codeError}
                aria-describedby={codeError ? "pd-code-error" : undefined}
              />
              <button type="submit" className="btn btn-quiet" disabled={!code.trim()}>
                Join
              </button>
            </form>
          </div>
          {codeError && (
            <p className="pd-error-text" id="pd-code-error" role="alert">
              {codeError}
            </p>
          )}
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
        </div>
        <ul className="pd-hero-facts" aria-label="About Paddock calls">
          <li>
            <strong>Direct and private</strong>
            Video goes straight between the people in the call. Nothing is recorded.
          </li>
          <li>
            <strong>Guests welcome</strong>
            Send the link. People without an account ask to join, and you let them in.
          </li>
          <li>
            <strong>Made for the barn</strong>
            Works on phones and computers. On a computer, share your screen to go over a race card together.
          </li>
        </ul>
      </section>

      {load.status === "loading" && (
        <div className="pd-list-skeleton" role="status" aria-label="Loading meetings">
          <span />
          <span />
          <span />
        </div>
      )}
      {load.status === "error" && (
        <div className="pd-callout is-warn" role="alert">
          {load.message}{" "}
          <button type="button" className="btn btn-quiet" onClick={() => setRefresh((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      {load.status === "ready" && meetings.length === 0 && (
        <section className="pd-empty panel">
          <h2>No meetings yet</h2>
          <p>Start one now and share the link, or schedule one for later. Meetings you're invited to show up here too.</p>
        </section>
      )}
      {upcoming.length > 0 && (
        <section className="pd-list" aria-labelledby="pd-upcoming">
          <h2 id="pd-upcoming">Live and upcoming</h2>
          <ul>{upcoming.map(row)}</ul>
        </section>
      )}
      {recent.length > 0 && (
        <section className="pd-list" aria-labelledby="pd-recent">
          <h2 id="pd-recent">Recent</h2>
          <ul>{recent.map(row)}</ul>
        </section>
      )}

      {newMenu && (
        <Menu
          anchor={newButton.current}
          label="New meeting"
          align="start"
          items={[
            { label: "Start a meeting now", icon: <ClockIcon />, onSelect: () => void create("now") },
            { label: "Schedule for later", icon: <CalendarIcon />, onSelect: () => setSchedule({}) },
            { label: "Get a link to share", icon: <LinkIcon size={16} />, onSelect: () => void create("link") },
          ]}
          onClose={() => setNewMenu(false)}
        />
      )}
      {schedule && (
        <ScheduleDialog
          meeting={schedule.meeting}
          onClose={() => setSchedule(null)}
          onSaved={(meeting) => {
            setSchedule(null);
            setRefresh((n) => n + 1);
            if (!schedule.meeting) setMade(meeting);
          }}
        />
      )}
      {made && (
        <Modal label="Your meeting is ready" className="modal-sm" onClose={() => setMade(null)}>
          <DialogHead kicker={PADDOCK_NAME} title="Your meeting is ready" onClose={() => setMade(null)} />
          <div className="dlg">
            <p className="pd-small">Send this link to the people you want to meet. Keep it to share again later: it works until you delete the meeting.</p>
            <CopyLink code={made.code} />
            <div className="dlg-actions">
              <button type="button" className="btn btn-quiet" onClick={() => setMade(null)}>
                Close
              </button>
              <Link className="btn btn-primary" to={`/paddock/${made.code}`}>
                Join now
              </Link>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
