import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api";
import { useAuth } from "../../auth";
import BackButton from "../ui/BackButton";
import { useDraft } from "../ui/useDraft";
import { MAX_PEOPLE, PADDOCK_NAME } from "./brand";
import { PaddockCall, passKey, peerKey } from "./engine/call";
import { LocalMedia, problemText } from "./engine/media";
import { callStore, useActiveCall } from "./engine/store";
import { PaddockMark, PeopleIcon } from "./icons";
import { guestApi, knockApi, paddockApi, type GuestMeeting, type JoinAnswer, type Meeting } from "./paddockApi";
import { DevicePickers, SelfPreview } from "./Preview";
import { meetingTime } from "./time";
import { newPeerId, useMedia } from "./useCall";

type Info =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; message: string }
  | { kind: "member"; meeting: Meeting; canJoin: boolean }
  | { kind: "guest"; meeting: GuestMeeting; live: { count: number; full: boolean; locked: boolean; hostPresent: boolean } };
type Step =
  | { kind: "ready" }
  | { kind: "joining" }
  | { kind: "waiting"; hostPresent: boolean }
  | { kind: "denied" }
  | { kind: "problem"; message: string; code?: string };

const PREJOIN_KEY = "stayblz.paddock.prejoin";
function readPrejoin() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREJOIN_KEY) ?? "{}");
    return { mic: raw.mic !== false, cam: raw.cam !== false };
  } catch {
    return { mic: true, cam: true };
  }
}
const session = (key: string) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const forget = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Nothing stored. */
  }
};

export default function GreenRoom({ code }: { code: string }) {
  const { user } = useAuth();
  const guest = !user;
  const active = useActiveCall();
  const otherCall = active && active.code !== code && active.isLive() ? (active as PaddockCall) : null;
  const [info, setInfo] = useState<Info>({ kind: "loading" });
  const [step, setStep] = useState<Step>({ kind: "ready" });
  const [media, setMedia] = useState<LocalMedia | null>(null);
  const [guestName, setGuestName] = useDraft("paddock.guest-name", "");
  const [nameError, setNameError] = useState("");
  const handed = useRef(false);
  const knock = useRef<{ id: string; token: string; abort: AbortController } | null>(null);
  const [reload, setReload] = useState(0);
  useMedia(media);

  // Camera and mic for the preview. Handed to the call on joining; stopped if you leave this page.
  useEffect(() => {
    const local = new LocalMedia();
    setMedia(local);
    void local.start(readPrejoin());
    return () => {
      if (!handed.current) local.stop();
    };
  }, []);
  useEffect(() => {
    if (!media) return;
    return media.subscribe(() => {
      try {
        localStorage.setItem(PREJOIN_KEY, JSON.stringify({ mic: media.micOn, cam: media.camOn }));
      } catch {
        /* A convenience only. */
      }
    });
  }, [media]);

  // What this meeting is, and who's here. Refreshed quietly while you get ready.
  const load = useCallback(
    async (signal: AbortSignal, quiet: boolean) => {
      if (!quiet) setInfo({ kind: "loading" });
      try {
        if (guest) {
          const data = await guestApi.info(code, signal);
          if (!signal.aborted) setInfo({ kind: "guest", meeting: data.meeting, live: data.live });
        } else {
          const data = await paddockApi.get(code, signal);
          if (!signal.aborted) setInfo({ kind: "member", meeting: data.meeting, canJoin: data.canJoin });
        }
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof ApiError && error.status === 404) setInfo({ kind: "missing" });
        else if (!quiet) setInfo({ kind: "error", message: error instanceof Error ? error.message : "This meeting couldn't be loaded." });
      }
    },
    [code, guest],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal, false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(controller.signal, true);
    }, 10_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [load, reload]);

  // Leaving this page while waiting withdraws the request.
  useEffect(
    () => () => {
      const k = knock.current;
      if (k) {
        k.abort.abort();
        void knockApi.cancel(k.id, k.token);
      }
    },
    [],
  );

  const displayName = guest ? guestName.trim() : (user?.displayName ?? "You");

  function startCall(answer: JoinAnswer) {
    if (!media) return;
    handed.current = true;
    knock.current = null;
    media.resumeAudio();
    const call = new PaddockCall(code, answer, media, displayName);
    call.start();
  }

  function explain(error: unknown) {
    if (error instanceof ApiError) {
      if (error.code === "ask") return setStep({ kind: "ready" });
      setStep({ kind: "problem", message: error.message, code: error.code });
    } else setStep({ kind: "problem", message: error instanceof Error ? error.message : "Joining didn't work. Try again." });
  }

  async function waitForAnswer(id: string, token: string) {
    const abort = new AbortController();
    knock.current = { id, token, abort };
    setStep({ kind: "waiting", hostPresent: true });
    let failures = 0;
    while (!abort.signal.aborted) {
      let answer;
      try {
        answer = await knockApi.status(id, token, 15_000, abort.signal);
      } catch {
        return; // cancelled
      }
      if (answer.status === 404) return setStep({ kind: "problem", message: "Your request to join expired. Ask again." });
      if (answer.status !== 200) {
        failures++;
        await new Promise((resolve) => window.setTimeout(resolve, Math.min(8000, 500 * 2 ** failures)));
        continue;
      }
      failures = 0;
      const { status, hostPresent } = answer.data;
      if (status === "admitted") {
        try {
          const joined = await knockApi.join(id, token, newPeerId(), media ? { mic: media.micOn, cam: media.camOn } : undefined);
          return startCall(joined);
        } catch (error) {
          knock.current = null;
          return explain(error);
        }
      }
      if (status === "denied") {
        knock.current = null;
        return setStep({ kind: "denied" });
      }
      if (status === "ended") {
        knock.current = null;
        return setStep({ kind: "problem", message: "The host ended this call." });
      }
      setStep({ kind: "waiting", hostPresent });
    }
  }

  async function join() {
    if (!media || step.kind === "joining" || step.kind === "waiting") return;
    if (guest) {
      const name = guestName.replace(/\s+/g, " ").trim();
      if (name.length < 2) return setNameError("Enter your name (at least 2 letters) so people know who's asking.");
      if (name.length > 40) return setNameError("Use a shorter name (40 characters or fewer).");
      setNameError("");
    }
    if (otherCall) {
      await otherCall.leave();
      callStore.set(null);
    }
    setStep({ kind: "joining" });
    media.resumeAudio();
    const replaces = session(peerKey(code)) ?? undefined;
    const state = { mic: media.micOn, cam: media.camOn };
    try {
      // Let in before (a reload): straight back in with the return pass.
      const pass = session(passKey(code));
      if (pass) {
        const back = await knockApi.rejoin(pass, newPeerId(), replaces, state);
        if (back.status === 200) return startCall(back.data);
        forget(passKey(code));
      }
      if (info.kind === "member" && info.canJoin) return startCall(await paddockApi.join(code, newPeerId(), replaces, state));
      const asked = guest ? await guestApi.knock(code, guestName.trim()) : await paddockApi.knock(code);
      await waitForAnswer(asked.knock.id, asked.knock.token);
    } catch (error) {
      // Access changed since the page loaded (e.g. now open, or you were invited): look again.
      if (error instanceof ApiError && error.code === "direct") {
        try {
          return startCall(await paddockApi.join(code, newPeerId(), replaces, { mic: media.micOn, cam: media.camOn }));
        } catch (again) {
          return explain(again);
        }
      }
      explain(error);
    }
  }

  function cancelWaiting() {
    const k = knock.current;
    knock.current = null;
    if (k) {
      k.abort.abort();
      void knockApi.cancel(k.id, k.token);
    }
    setStep({ kind: "ready" });
  }

  if (info.kind === "loading" || !media)
    return (
      <div className="pd-green is-loading">
        <p className="ws-loading" role="status">
          Opening the meeting…
        </p>
      </div>
    );
  if (info.kind === "missing" || info.kind === "error")
    return (
      <div className="pd-green">
        <div className="pd-green-top">
          <BackButton signedIn={!guest} fallback={guest ? { to: "/", label: "Home" } : undefined} />
        </div>
        <section className="pd-notfound panel">
          <span className="pd-notfound-mark" aria-hidden="true">
            <PaddockMark size={30} />
          </span>
          <h1>{info.kind === "missing" ? "We couldn't find that meeting" : "This meeting didn't load"}</h1>
          <p>
            {info.kind === "missing"
              ? "Check the code or link. The host may have deleted the meeting."
              : info.message}
          </p>
          <div className="pd-actions">
            {info.kind === "error" && (
              <button type="button" className="btn btn-primary" onClick={() => setReload((n) => n + 1)}>
                Try again
              </button>
            )}
            {!guest && (
              <Link className="btn btn-quiet" to="/paddock">
                Go to {PADDOCK_NAME}
              </Link>
            )}
          </div>
        </section>
      </div>
    );

  const meeting = info.meeting;
  const live = info.kind === "member" ? info.meeting.live : info.live;
  const removed = info.kind === "member" && info.meeting.removed;
  const direct = info.kind === "member" && info.canJoin;
  const guestsOff = info.kind === "guest" && !info.meeting.guestsAllowed;
  const blocked = removed || guestsOff || (live.full && step.kind === "ready");
  const names = info.kind === "member" ? info.meeting.live.names ?? [] : [];
  const when = meetingTime(meeting.scheduledFor, meeting.durationMinutes, live.count > 0);
  const mediaProblem = media.problems.cam === "blocked" || media.problems.mic === "blocked" || media.problems.mic === "insecure";

  return (
    <div className="pd-green">
      <div className="pd-green-top">
        <BackButton signedIn={!guest} fallback={guest ? { to: "/", label: "Home" } : undefined} />
        <span className="pd-green-brand">
          <PaddockMark size={18} /> {PADDOCK_NAME}
        </span>
      </div>
      <div className="pd-green-grid">
        <section className="pd-green-media" aria-label="Check your camera and microphone">
          <SelfPreview media={media} name={displayName || "Guest"} />
          {mediaProblem && (
            <div className="pd-callout is-warn" role="status">
              <strong>Camera or microphone blocked.</strong>{" "}
              {problemText[media.problems.mic === "insecure" ? "insecure" : "blocked"]("camera and microphone")}
              <button type="button" className="btn btn-quiet" onClick={() => void media.start({ mic: true, cam: true })}>
                Try again
              </button>
            </div>
          )}
          {!mediaProblem && (media.problems.cam || media.problems.mic) && (
            <p className="pd-callout" role="status">
              {media.problems.cam ? problemText[media.problems.cam]("camera") : problemText[media.problems.mic!]("microphone")}
            </p>
          )}
          <details className="pd-check" open={window.matchMedia?.("(min-width: 900px)").matches}>
            <summary>Microphone, camera &amp; speaker</summary>
            <DevicePickers media={media} />
          </details>
        </section>

        <section className="pd-green-join panel" aria-labelledby="pd-green-title">
          <span className="pd-kicker">{step.kind === "waiting" ? "Asking to join" : "Ready to join?"}</span>
          <h1 id="pd-green-title" className="pd-green-title">
            {meeting.title}
          </h1>
          <p className="pd-green-meta">
            Hosted by {meeting.hostName}
            {when && <> · {when}</>}
          </p>
          <p className="pd-here">
            <PeopleIcon size={16} />
            {live.count === 0
              ? "No one is in the call yet."
              : names.length
                ? `${listNames(names, live.count)} ${live.count === 1 ? "is" : "are"} in the call.`
                : `${live.count} ${live.count === 1 ? "person is" : "people are"} in the call.`}
            {live.full && <strong> It's full ({MAX_PEOPLE} people).</strong>}
          </p>

          {otherCall && step.kind === "ready" && (
            <div className="pd-callout" role="status">
              You're in another call. Joining this one will leave it.{" "}
              <Link to={`/paddock/${otherCall.code}`}>Go back to that call</Link>
            </div>
          )}

          {guest && step.kind !== "waiting" && !guestsOff && (
            <label className="pd-field">
              <span className="ld-label">Your name</span>
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                maxLength={40}
                autoComplete="name"
                placeholder="e.g. Jordan Lee"
                aria-invalid={!!nameError}
                aria-describedby="pd-name-help"
                onKeyDown={(e) => e.key === "Enter" && void join()}
              />
              <small id="pd-name-help" className={nameError ? "pd-error-text" : undefined}>
                {nameError || "Everyone in the call sees this name. The host decides whether to let you in."}
              </small>
            </label>
          )}

          {step.kind === "waiting" ? (
            <div className="pd-waiting" role="status" aria-live="polite">
              <span className="pd-spinner" aria-hidden="true" />
              <div>
                <strong>Waiting for someone to let you in…</strong>
                <p>
                  {step.hostPresent
                    ? "The host has been told you're here. Keep this page open."
                    : "The host isn't in the call yet. You'll be let in once they join and say yes. Keep this page open."}
                </p>
              </div>
              <button type="button" className="btn btn-quiet" onClick={cancelWaiting}>
                Cancel
              </button>
            </div>
          ) : (
            <>
              {step.kind === "denied" && (
                <p className="form-error" role="alert">
                  The host didn't let you in. You can ask again if you think this was a mistake.
                </p>
              )}
              {step.kind === "problem" && (
                <p className="form-error" role="alert">
                  {step.message}
                </p>
              )}
              {removed ? (
                <p className="form-error" role="alert">
                  The host removed you from this meeting, so you can't join again.
                </p>
              ) : guestsOff ? (
                <div className="pd-callout">
                  This meeting is for Stayblz members only.{" "}
                  <Link to="/login" state={{ destination: `/paddock/${code}`, intent: "join this meeting" }}>
                    Sign in
                  </Link>{" "}
                  or create a free account, then open the link again.
                </div>
              ) : (
                <button type="button" className="btn btn-primary pd-join" disabled={blocked || step.kind === "joining"} onClick={() => void join()}>
                  {step.kind === "joining"
                    ? "Joining…"
                    : step.kind === "denied"
                      ? "Ask again"
                      : direct
                        ? otherCall
                          ? "Leave other call and join"
                          : "Join now"
                        : "Ask to join"}
                </button>
              )}
              {!direct && !removed && !guestsOff && step.kind !== "denied" && (
                <p className="pd-small">
                  {guest
                    ? "You're joining as a guest."
                    : "You're not on this meeting's invite list, so the host will be asked to let you in."}
                </p>
              )}
              {guest && !guestsOff && (
                <p className="pd-small">
                  Have a Stayblz account?{" "}
                  <Link to="/login" state={{ destination: `/paddock/${code}`, intent: "join this meeting" }}>
                    Sign in
                  </Link>
                </p>
              )}
            </>
          )}

          <details className="pd-about">
            <summary>How {PADDOCK_NAME} calls work</summary>
            <ul>
              <li>Free video calls for up to {MAX_PEOPLE} people, right in your browser.</li>
              <li>Video and sound go directly between the people in the call, not through Stayblz. Because of that, others in the call can see your internet (IP) address.</li>
              <li>Nothing is recorded. In-call chat disappears when the call ends.</li>
              <li>Very strict work or school networks can block direct calls.</li>
            </ul>
          </details>
        </section>
      </div>
    </div>
  );
}

function listNames(names: string[], count: number) {
  const shown = names.slice(0, 3);
  const rest = count - shown.length;
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`;
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}
