import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { canUse, roleLabel } from "../components/account/roles";
import "../components/account/account.css";

type Load<T> = { data: T | null; loading: boolean; error: string };
type StableRow = { id: string; name: string; created_at: string };
type AccountRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  statusReason: string;
  createdAt: string;
  mfaEnabled: boolean | null;
};
type EventRow = {
  id: string;
  accountId: string | null;
  actorId: string | null;
  event: string;
  createdAt: string;
};

const eventLabels: Record<string, string> = {
  "account.created": "Account created",
  "account.role_changed": "Role changed",
  "account.status_changed": "Status changed",
  "account.view_changed": "View changed",
  "auth.signed_in": "Signed in",
  "auth.password_changed": "Password changed",
  "auth.mfa_enabled": "2-step login turned on",
  "auth.mfa_disabled": "2-step login turned off",
  "auth.mfa_passed": "2-step code accepted",
  "auth.mfa_failed": "Wrong 2-step code",
};

/** Loads one admin list; keeps the last good data visible when a reload fails. */
function useAdminList<T>(path: string, pick: (body: Record<string, unknown>) => T, enabled: boolean) {
  const [state, setState] = useState<Load<T>>({ data: null, loading: enabled, error: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    api
      .get<Record<string, unknown>>(path, { signal: controller.signal })
      .then((body) => {
        if (!controller.signal.aborted) setState({ data: pick(body), loading: false, error: "" });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setState((s) => ({
            ...s,
            loading: false,
            error: reason instanceof Error ? reason.message : "This list could not be loaded.",
          }));
      });
    return () => controller.abort();
    // `pick` is a fixed mapper per call site, so it is not a dependency.
  }, [path, enabled, attempt]);
  return { ...state, reload: useCallback(() => setAttempt((n) => n + 1), []) };
}

function ListState({ loading, error, empty, retry }: { loading: boolean; error: string; empty: boolean; retry: () => void }) {
  if (error)
    return (
      <div className="form-error" role="alert">
        {error}{" "}
        <button type="button" className="btn btn-quiet" onClick={retry}>
          Try again
        </button>
      </div>
    );
  if (loading) return <p role="status">Loading…</p>;
  if (empty) return <p>Nothing here yet.</p>;
  return null;
}

export default function Administration() {
  const { user } = useAuth();
  const superadmin = canUse(user, "superadmin");
  const stables = useAdminList<StableRow[]>("/api/admin/stables", (b) => b.stables as StableRow[], true);
  const accounts = useAdminList<AccountRow[]>("/api/admin/accounts", (b) => b.accounts as AccountRow[], superadmin);
  const events = useAdminList<EventRow[]>("/api/admin/events", (b) => b.events as EventRow[], superadmin);
  const [pending, setPending] = useState("");
  const [actionError, setActionError] = useState("");

  async function setStatus(account: AccountRow, status: "active" | "suspended") {
    if (pending) return;
    let reason = "";
    if (status === "suspended") {
      const answer = window.prompt(
        `Suspend ${account.email}? They will be signed out and blocked until restored.\n\nReason (optional):`,
        "",
      );
      if (answer === null) return;
      reason = answer.slice(0, 300);
    }
    setPending(account.id);
    setActionError("");
    try {
      await api.post(`/api/admin/accounts/${account.id}/status`, { status, reason });
      accounts.reload();
      events.reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "The account could not be updated.");
    } finally {
      setPending("");
    }
  }

  const nameFor = (id: string | null) =>
    id ? (accounts.data?.find((a) => a.id === id)?.email ?? "Unknown account") : "Database owner";

  return (
    <>
      <header className="page-head">
        <div className="eyebrow">{superadmin ? "Superadmin" : "Admin"}</div>
        <h1>Administration</h1>
        <p className="sub">
          Platform tools. Private stable records and conversations still require membership; no admin role opens
          them.
        </p>
      </header>

      {superadmin && (
        <section className="panel team-card" aria-labelledby="admin-accounts">
          <h2 id="admin-accounts">Accounts</h2>
          <p>
            Every sign-in account and its role. Roles are changed only from the Supabase SQL editor, so a website
            session can never create an admin. Superadmin accounts can't be suspended here.
          </p>
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
          <ListState
            loading={accounts.loading && !accounts.data}
            error={accounts.error}
            empty={!!accounts.data && accounts.data.length === 0}
            retry={accounts.reload}
          />
          {accounts.data && accounts.data.length > 0 && (
            <div className="acct-table-wrap">
              <table className="acct-table">
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Role</th>
                    <th scope="col">2-step</th>
                    <th scope="col">Status</th>
                    <th scope="col">Joined</th>
                    <th scope="col">
                      <span className="acct-sr">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.data.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <strong>{account.name || "No name yet"}</strong>
                        <div className="acct-muted">{account.email}</div>
                      </td>
                      <td>{roleLabel(account.role)}</td>
                      <td>
                        {account.mfaEnabled === null ? (
                          <span className="acct-muted">Unknown</span>
                        ) : (
                          <span className={`acct-badge${account.mfaEnabled ? "" : account.role !== "member" ? " is-warn" : " is-off"}`}>
                            {account.mfaEnabled ? "On" : "Off"}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`acct-badge${account.status === "active" ? " is-off" : " is-warn"}`}>
                          {account.status === "active" ? "Active" : "Suspended"}
                        </span>
                        {account.statusReason && <div className="acct-muted">{account.statusReason}</div>}
                      </td>
                      <td>{new Date(account.createdAt).toLocaleDateString()}</td>
                      <td>
                        {account.role !== "superadmin" && account.id !== user?.id && (
                          <button
                            type="button"
                            className="btn btn-quiet"
                            disabled={!!pending}
                            onClick={() =>
                              void setStatus(account, account.status === "active" ? "suspended" : "active")
                            }
                          >
                            {pending === account.id
                              ? "Saving…"
                              : account.status === "active"
                                ? `Suspend ${account.email}`
                                : `Restore ${account.email}`}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {superadmin && (
        <section className="panel team-card" aria-labelledby="admin-activity">
          <h2 id="admin-activity">Account activity</h2>
          <p>The latest 100 security events. This log can't be edited or deleted.</p>
          <ListState
            loading={events.loading && !events.data}
            error={events.error}
            empty={!!events.data && events.data.length === 0}
            retry={events.reload}
          />
          {events.data && events.data.length > 0 && (
            <div className="acct-table-wrap">
              <table className="acct-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">What</th>
                    <th scope="col">Account</th>
                    <th scope="col">By</th>
                  </tr>
                </thead>
                <tbody>
                  {events.data.map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.createdAt).toLocaleString()}</td>
                      <td>{eventLabels[event.event] ?? event.event}</td>
                      <td>{nameFor(event.accountId)}</td>
                      <td>{event.actorId === event.accountId ? "Themselves" : nameFor(event.actorId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="panel team-card" aria-labelledby="admin-stables">
        <h2 id="admin-stables">Registered stables</h2>
        <ListState
          loading={stables.loading && !stables.data}
          error={stables.error}
          empty={!!stables.data && stables.data.length === 0}
          retry={stables.reload}
        />
        {stables.data && stables.data.length > 0 && (
          <ul className="team-list">
            {stables.data.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong>
                <span>{new Date(s.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
