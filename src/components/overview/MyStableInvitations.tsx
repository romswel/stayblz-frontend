import { useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { useWorkspace } from "../../workspace";
import { useConfirm } from "../ui/Confirm";

/** A stable invitation addressed to the signed-in account's email. */
interface Invitation {
  id: string;
  stableId: string;
  stableName: string;
  role: "member" | "manager";
  invitedBy: string | null;
  expiresAt: string;
}

// The layout remounts stable-scoped pages when the active stable changes, so
// the "you joined" confirmation is handed to the remounted page in memory.
let joinedHandoff: { id: string; name: string } | null = null;

function valid(value: unknown): value is Invitation[] {
  return (
    Array.isArray(value) &&
    value.every(
      (i) =>
        i &&
        typeof i.id === "string" &&
        typeof i.stableId === "string" &&
        typeof i.stableName === "string" &&
        (i.role === "member" || i.role === "manager"),
    )
  );
}

/**
 * Invitations sent to this account's email. Shown on the workspace overview
 * even before the person has a stable, so an invitee can join in one click
 * without needing the shared invitation code.
 */
export default function MyStableInvitations() {
  const { stables, reload, select } = useWorkspace();
  const confirm = useConfirm();
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [joined, setJoined] = useState<{ id: string; name: string } | null>(
    () => joinedHandoff,
  );
  // Read during render (pure), cleared once mounted.
  useEffect(() => {
    joinedHandoff = null;
  }, []);
  const [retry, setRetry] = useState(0);
  const pendingSelect = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    setLoadError("");
    api
      .get<{ invitations: unknown }>("/api/workspaces/my-invitations", {
        signal: controller.signal,
      })
      .then((d) => {
        if (controller.signal.aborted) return;
        if (!valid(d.invitations))
          throw Error("Your invitations could not be loaded.");
        setInvitations(d.invitations);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setInvitations(null);
        setLoadError(
          reason instanceof Error
            ? reason.message
            : "Your invitations could not be loaded.",
        );
      });
    return () => controller.abort();
  }, [retry]);

  // Switch to the stable just joined once the refreshed list contains it.
  useEffect(() => {
    const id = pendingSelect.current;
    if (id && stables.some((s) => s.id === id)) {
      pendingSelect.current = "";
      select(id);
    }
  }, [stables, select]);

  async function accept(invitation: Invitation) {
    if (busyId) return;
    setBusyId(invitation.id);
    setError("");
    setJoined(null);
    try {
      const d = await api.post<{ stableId: string }>(
        `/api/workspaces/my-invitations/${invitation.id}/accept`,
        {},
      );
      setInvitations((list) =>
        (list ?? []).filter((i) => i.id !== invitation.id),
      );
      pendingSelect.current = d.stableId || invitation.stableId;
      const done = { id: pendingSelect.current, name: invitation.stableName };
      setJoined(done);
      // Set before reloading: the reload itself may switch stables and remount.
      joinedHandoff = done;
      const list = await reload();
      if (!list.some((s) => s.id === done.id)) joinedHandoff = null;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The invitation could not be accepted.",
      );
      setRetry((n) => n + 1);
    } finally {
      setBusyId("");
    }
  }

  async function decline(invitation: Invitation) {
    if (busyId) return;
    const sure = await confirm({
      title: `Decline ${invitation.stableName}?`,
      message:
        "The invitation is removed. The stable can send you a new one later.",
      confirmLabel: "Decline invitation",
      cancelLabel: "Keep it",
      tone: "danger",
    });
    if (!sure) return;
    setBusyId(invitation.id);
    setError("");
    setJoined(null);
    try {
      await api.post(
        `/api/workspaces/my-invitations/${invitation.id}/decline`,
        {},
      );
      setInvitations((list) =>
        (list ?? []).filter((i) => i.id !== invitation.id),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The invitation could not be declined.",
      );
    } finally {
      setBusyId("");
    }
  }

  // Nothing to show: no invitations and nothing just happened.
  if (!loadError && !joined && !error && !invitations?.length) return null;

  return (
    <section
      className="sg-card sg-invites"
      aria-labelledby="sg-invites-title"
    >
      <div className="sg-invites-head">
        <span className="sg-kicker">Invitations</span>
        <h2 id="sg-invites-title">Stable invitations for you</h2>
      </div>
      {joined && (
        <p className="sg-joined" role="status">
          You joined <strong>{joined.name}</strong>.
          {stables.some((s) => s.id === joined.id)
            ? " It’s now your active stable."
            : " Loading your stable…"}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loadError ? (
        <div className="sg-invites-error">
          <p role="alert">{loadError}</p>
          <button
            className="ws-button"
            onClick={() => setRetry((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      ) : (
        invitations &&
        invitations.length > 0 && (
          <ul className="sg-invite-list">
            {invitations.map((i) => {
              const expires = Date.parse(i.expiresAt);
              return (
                <li key={i.id} className="sg-invite">
                  <div className="sg-invite-text">
                    <strong>{i.stableName}</strong>
                    <small>
                      {i.invitedBy ? `${i.invitedBy} invited you` : "Invited"}{" "}
                      as {i.role === "manager" ? "a manager" : "a member"}
                      {Number.isFinite(expires) &&
                        ` · expires ${new Date(expires).toLocaleDateString()}`}
                    </small>
                  </div>
                  <div className="sg-invite-actions">
                    <button
                      className="ws-button sg-primary"
                      disabled={!!busyId}
                      onClick={() => void accept(i)}
                    >
                      {busyId === i.id ? "Joining…" : "Accept & join"}
                    </button>
                    <button
                      className="ws-button"
                      disabled={!!busyId}
                      onClick={() => void decline(i)}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      )}
    </section>
  );
}
