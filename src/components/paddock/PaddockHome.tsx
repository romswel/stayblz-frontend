import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth";
import Brand from "../Brand";
import Menu from "../messenger/Menu";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { codeFrom, MAX_PEOPLE, PADDOCK_NAME } from "./brand";
import { useActiveCall } from "./engine/store";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, KeyboardIcon, LinkIcon, PlusIcon } from "./icons";
import { CopyLink } from "./InfoTab";
import MeetingRow from "./MeetingRow";
import { paddockApi, type Meeting } from "./paddockApi";
import ScheduleDialog from "./ScheduleDialog";
import { addDays, dayStart, isUpcoming, longDay, sameDay, weekStart } from "./time";
import { useNow } from "./useCall";

type Load = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; meetings: Meeting[] };
const startOf = (m: Meeting) => Date.parse(m.scheduledFor ?? m.createdAt);
const endOf = (m: Meeting) => startOf(m) + m.durationMinutes * 60_000;

/** /paddock — like a meeting app's home: start or join, a week of scheduled meetings, live calls and recent ones. */
export default function PaddockHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const active = useActiveCall();
  const liveCall = active?.isLive() ? active : null;
  const now = useNow(30_000);
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
  const [day, setDay] = useState(() => dayStart(Date.now()));
  const [week, setWeek] = useState(() => weekStart(Date.now()));
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

  const meetings = useMemo(() => (load.status === "ready" ? load.meetings : []), [load]);
  const live = meetings.filter((m) => m.live.count > 0).sort((a, b) => b.live.count - a.live.count);
  const scheduled = meetings.filter((m) => m.scheduledFor && m.live.count === 0);
  const busyDays = new Set(meetings.filter((m) => m.scheduledFor).map((m) => dayStart(Date.parse(m.scheduledFor!))));
  const onDay = scheduled.filter((m) => sameDay(startOf(m), day)).sort((a, b) => startOf(a) - startOf(b));
  const dayUpcoming = onDay.filter((m) => isUpcoming(m.scheduledFor, m.durationMinutes, now));
  const dayPast = onDay.filter((m) => !dayUpcoming.includes(m));
  const next = scheduled.filter((m) => startOf(m) > now && !sameDay(startOf(m), day)).sort((a, b) => startOf(a) - startOf(b)).slice(0, 3);
  const recent = meetings
    .filter((m) => !m.scheduledFor && m.live.count === 0)
    .sort((a, b) => Date.parse(b.lastJoinedAt ?? b.createdAt) - Date.parse(a.lastJoinedAt ?? a.createdAt))
    .slice(0, 8);
  const today = dayStart(now);

  const row = (m: Meeting, compact = false) => (
    <MeetingRow
      key={m.id}
      meeting={m}
      compact={compact}
      past={!!m.scheduledFor && endOf(m) < now && m.live.count === 0}
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
  const pick = (at: number) => {
    setDay(dayStart(at));
    setWeek(weekStart(at));
  };

  return (
    <div className="pd-home">
      {liveCall && (
        <p className="pd-callout is-live" role="status">
          <span className="pd-pulse" aria-hidden="true" />
          You're in a call right now.
          <Link to={`/paddock/${liveCall.code}`} className="pd-btn is-primary is-small">
            Return to the call
          </Link>
        </p>
      )}
      <section className="pd-hero gx-glass" aria-labelledby="pd-home-title">
        <div className="pd-hero-brand">
          <span className="pd-crest" aria-hidden="true">
            <Brand />
          </span>
          <div>
            <h1 id="pd-home-title">{PADDOCK_NAME}</h1>
            <p>Video meetings for owners, trainers and their teams. Free, right in your browser, for up to {MAX_PEOPLE} people.</p>
          </div>
        </div>
        <div className="pd-hero-actions">
          <button
            ref={newButton}
            type="button"
            className="pd-btn is-primary pd-new"
            aria-haspopup="menu"
            aria-expanded={newMenu}
            onClick={() => setNewMenu((v) => !v)}
            disabled={!!busy}
          >
            <PlusIcon /> {busy === "now" ? "Starting…" : busy === "link" ? "Creating…" : "New meeting"}
          </button>
          <form
            className={`pd-joinbox${codeError ? " is-invalid" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
          >
            <KeyboardIcon size={18} />
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
            <button type="submit" className="pd-joinbox-go" disabled={!code.trim()}>
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
          <p className="pd-error-text" role="alert">
            {actionError}
          </p>
        )}
        <ul className="pd-hero-facts" aria-label="About Paddock calls">
          <li>Direct and private: nothing is recorded</li>
          <li>Guests ask to join, you let them in</li>
          <li>Share a race replay with its sound</li>
          <li>Works on phones and computers</li>
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
          {load.message}
          <button type="button" className="pd-btn is-quiet is-small" onClick={() => setRefresh((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}

      {live.length > 0 && (
        <section className="pd-section-card gx-glass pd-live-now" aria-labelledby="pd-live-title">
          <h2 id="pd-live-title">
            <span className="pd-pulse" aria-hidden="true" /> Live now
          </h2>
          <ul className="pd-cards">{live.map((m) => row(m))}</ul>
        </section>
      )}

      {load.status === "ready" && (
        <div className="pd-home-grid">
          <section className="pd-section-card gx-glass pd-agenda" aria-labelledby="pd-day-title">
            <header className="pd-agenda-head">
              <h2 id="pd-day-title">
                {sameDay(day, today) ? "Today" : longDay(day)}
                <small>{sameDay(day, today) ? longDay(day) : ""}</small>
              </h2>
              <button type="button" className="pd-btn is-quiet is-small" onClick={() => pick(Date.now())} disabled={sameDay(day, today) && week === weekStart(today)}>
                Today
              </button>
            </header>
            <div className="pd-week" role="group" aria-label="Choose a day">
              <button type="button" className="pd-icon-btn" aria-label="Previous week" onClick={() => setWeek((w) => addDays(w, -7))}>
                <ChevronLeftIcon />
              </button>
              <ol>
                {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d) => {
                  const date = new Date(d);
                  const selected = sameDay(d, day);
                  return (
                    <li key={d}>
                      <button
                        type="button"
                        className={`pd-day${selected ? " is-selected" : ""}${sameDay(d, today) ? " is-today" : ""}`}
                        aria-pressed={selected}
                        aria-label={`${date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}${busyDays.has(d) ? ", has meetings" : ""}`}
                        onClick={() => setDay(d)}
                      >
                        <small>{date.toLocaleDateString([], { weekday: "short" }).toUpperCase()}</small>
                        <strong>{date.getDate()}</strong>
                        {busyDays.has(d) && <i aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <button type="button" className="pd-icon-btn" aria-label="Next week" onClick={() => setWeek((w) => addDays(w, 7))}>
                <ChevronRightIcon />
              </button>
            </div>

            {meetings.length === 0 ? (
              <div className="pd-empty">
                <span className="pd-empty-art" aria-hidden="true">
                  <CalendarIcon size={26} />
                </span>
                <h3>No meetings yet</h3>
                <p>Start one now and share the link, or schedule one for later. Meetings you're invited to show up here too.</p>
              </div>
            ) : onDay.length === 0 ? (
              <div className="pd-empty is-small">
                <p>Nothing scheduled for {sameDay(day, today) ? "today" : longDay(day)}.</p>
                <button type="button" className="pd-btn is-quiet is-small" onClick={() => setSchedule({})}>
                  <CalendarIcon /> Schedule a meeting
                </button>
              </div>
            ) : (
              <>
                {dayUpcoming.length > 0 && <ul className="pd-cards">{dayUpcoming.map((m) => row(m))}</ul>}
                {dayPast.length > 0 && (
                  <>
                    <h3 className="pd-subhead">Past</h3>
                    <ul className="pd-cards">{dayPast.map((m) => row(m))}</ul>
                  </>
                )}
              </>
            )}
            {next.length > 0 && (
              <div className="pd-coming">
                <h3 className="pd-subhead">Coming up</h3>
                <ul className="pd-cards is-compact">{next.map((m) => row(m, true))}</ul>
              </div>
            )}
          </section>

          <section className="pd-section-card gx-glass pd-recent" aria-labelledby="pd-recent">
            <h2 id="pd-recent">Recent</h2>
            {recent.length ? (
              <ul className="pd-cards is-compact">{recent.map((m) => row(m, true))}</ul>
            ) : (
              <p className="pd-small">Meetings you start or join (that aren't scheduled) show here, so you can open them again.</p>
            )}
          </section>
        </div>
      )}

      {newMenu && (
        <Menu
          anchor={newButton.current}
          label="New meeting"
          align="start"
          items={[
            { label: "Start a meeting now", icon: <ClockIcon />, onSelect: () => void create("now") },
            { label: "Get a link to share", icon: <LinkIcon size={16} />, onSelect: () => void create("link") },
            { label: "Schedule for later", icon: <CalendarIcon />, onSelect: () => setSchedule({}) },
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
            if (meeting.scheduledFor) pick(Date.parse(meeting.scheduledFor));
            if (!schedule.meeting) setMade(meeting);
          }}
        />
      )}
      {made && (
        <Modal label="Your meeting is ready" className="modal-sm gx-layer" onClose={() => setMade(null)}>
          <DialogHead kicker={PADDOCK_NAME} title="Your meeting is ready" onClose={() => setMade(null)} />
          <div className="dlg pd-dlg">
            <p className="pd-small">Send this link to the people you want to meet. It works until you delete the meeting.</p>
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
