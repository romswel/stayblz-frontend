import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api";
import {
  useWorkspace,
  useStableApi,
  type Stable,
  type Teammate,
} from "../workspace";
export default function Stables() {
  const {
    active,
    stables,
    loading,
    error: loadError,
    reload,
    select,
  } = useWorkspace();
  const stableApi = useStableApi();
  const activeId = useRef(active?.id);
  activeId.current = active?.id;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [token, setToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("invite") ?? "",
  );
  const [members, setMembers] = useState<Teammate[]>([]);
  const [invites, setInvites] = useState<
    { id: string; email: string; role: string; expires_at: string }[]
  >([]);
  const [inviteLink, setInviteLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);
  const canManage = active?.role === "owner" || active?.role === "manager";
  useEffect(() => {
    if (location.hash.includes("invite="))
      history.replaceState(null, "", location.pathname + location.search);
  }, []);
  useEffect(() => {
    setInviteLink("");
    setRole("member");
    setError("");
    setNotice("");
  }, [active?.id]);
  useEffect(() => {
    setMembers([]);
    setInvites([]);
    if (!active) return;
    const controller = new AbortController();
    void Promise.all([
      stableApi
        .get<{ members: Teammate[] }>("/api/workspaces/members", {
          signal: controller.signal,
        })
        .then((d) => {
          if (!controller.signal.aborted) setMembers(d.members);
        }),
      canManage
        ? stableApi
            .get<{ invitations: typeof invites }>(
              "/api/workspaces/invitations",
              { signal: controller.signal },
            )
            .then((d) => {
              if (!controller.signal.aborted) setInvites(d.invitations);
            })
        : Promise.resolve(),
    ]).catch((reason) => {
      if (!controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "Team could not be loaded.",
        );
    });
    return () => controller.abort();
  }, [active?.id, active?.role, stableApi, version]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The change could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const d = await api.post<{ stable: Stable }>("/api/workspaces", { name });
      const list = await reload();
      if (!list.some((s) => s.id === d.stable.id))
        throw Error("Stable created. Reload your stable list to continue.");
      setName("");
      setNotice("Stable created. Choose it from the stable selector.");
    });
  }
  async function accept(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      await api.post("/api/workspaces/accept-invitation", {
        token: token.trim(),
      });
      setToken("");
      await reload();
      setNotice("Invitation accepted. Choose your stable to continue.");
    });
  }
  async function invite(e: FormEvent) {
    e.preventDefault();
    const invitedStable = active?.id;
    await run(async () => {
      const d = await stableApi.post<{ token: string }>(
        "/api/workspaces/invitations",
        { email, role },
      );
      if (activeId.current !== invitedStable) return;
      setInviteLink(`${location.origin}/stables#invite=${d.token}`);
      setEmail("");
      setVersion((v) => v + 1);
      setNotice(
        "Invitation created. Share the link with that teammate; no email was sent.",
      );
    });
  }
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Your workspace</div>
        <h1>My stables & team</h1>
        <p className="sub">
          Own a stable, join a team, and keep private work with the right
          people.
        </p>
      </header>
      <button
        className="ws-button inventory-add"
        disabled={busy || loading}
        onClick={() =>
          void run(async () => {
            await reload();
            setVersion((v) => v + 1);
          })
        }
      >
        Refresh stables & team
      </button>
      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="ws-notice" role="status">
          {notice}
        </p>
      )}
      <div className="team-grid">
        <section className="panel team-card">
          <h2>Your stables</h2>
          {loading ? (
            <p>Loading…</p>
          ) : stables.length ? (
            <label>
              Active stable
              <select
                aria-label="Active stable"
                value={active?.id ?? ""}
                onChange={(e) => select(e.target.value)}
              >
                {stables.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.role}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p>No stables yet. Create one or accept an invitation.</p>
          )}
          <form onSubmit={create}>
            <label>
              New stable name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
              />
            </label>
            <button className="ws-button" disabled={busy || !name.trim()}>
              Create stable
            </button>
          </form>
        </section>
        <section className="panel team-card">
          <h2>Join a stable</h2>
          <p>
            Sign in with the email addressed by the invitation. Invitations
            expire after seven days.
          </p>
          <form onSubmit={accept}>
            <label>
              Invitation code
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                maxLength={64}
              />
            </label>
            <button className="ws-button" disabled={busy || !token.trim()}>
              Accept invitation
            </button>
          </form>
        </section>
      </div>
      {active && (
        <section className="panel team-card">
          <h2>{active.name} · Team</h2>
          <p>
            Your stable role: {active.role}. Owners and managers maintain horse
            records. All members can post updates and message their conversation
            participants.
          </p>
          <ul className="team-list">
            {members.map((m) => (
              <li key={m.id}>
                <div>
                  <strong>{m.displayName}</strong>
                  <small>{m.role}</small>
                </div>
                {active.role === "owner" && m.role !== "owner" && (
                  <select
                    aria-label={`Role for ${m.displayName}`}
                    value={m.role}
                    disabled={busy}
                    onChange={(e) => {
                      const nextRole = e.target.value;
                      void run(async () => {
                        await stableApi.patch(
                          `/api/workspaces/members/${m.id}`,
                          { role: nextRole },
                        );
                        await reload();
                        setVersion((v) => v + 1);
                      });
                    }}
                  >
                    <option value="member">Member</option>
                    <option value="manager">Manager</option>
                  </select>
                )}
                {canManage &&
                  m.role !== "owner" &&
                  (active.role === "owner" || m.role === "member") && (
                    <button
                      className="ws-button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await stableApi.post(
                            `/api/workspaces/members/${m.id}/remove`,
                          );
                          setVersion((v) => v + 1);
                          setNotice(
                            "Team member removed. Their stable access has ended.",
                          );
                        })
                      }
                    >
                      Remove {m.displayName}
                    </button>
                  )}
              </li>
            ))}
          </ul>
          {canManage && (
            <>
              <h3>Invite a teammate</h3>
              <form onSubmit={invite} className="team-invite">
                <label>
                  Teammate email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    required
                  />
                </label>
                <label>
                  Stable role
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="member">Member</option>
                    {active.role === "owner" && (
                      <option value="manager">Manager</option>
                    )}
                  </select>
                </label>
                <button className="ws-button" disabled={busy}>
                  Create invitation
                </button>
              </form>
              {inviteLink && (
                <label>
                  Invitation link · copy and share privately
                  <input
                    readOnly
                    value={inviteLink}
                    onFocus={(e) => e.target.select()}
                  />
                </label>
              )}
              <h3>Pending invitations</h3>
              {invites.length ? (
                <ul className="team-list">
                  {invites.map((i) => (
                    <li key={i.id}>
                      <div>
                        {i.email}
                        <small>
                          {i.role} · expires{" "}
                          {new Date(i.expires_at).toLocaleDateString()}
                        </small>
                      </div>
                      {(active.role === "owner" || i.role === "member") && (
                        <button
                          className="ws-button"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await stableApi.post(
                                `/api/workspaces/invitations/${i.id}/revoke`,
                              );
                              setVersion((v) => v + 1);
                            })
                          }
                        >
                          Revoke
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No pending invitations.</p>
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
