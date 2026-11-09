import { useState } from "react";
import { api } from "../../api";
import { useAuth } from "../../auth";
import type { User } from "../../types";
import { availableViews, roleLabel } from "./roles";

const help: Record<string, string> = {
  superadmin: "Everything, including accounts and the activity log.",
  admin: "Administration tools, without account moderation.",
  member: "Exactly what a customer sees. Staff tools are hidden and blocked.",
};

/** Staff only: switch which side of Stayblz you use, without a second login. */
export default function ViewAsSettings() {
  const { user, acceptUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const views = availableViews(user);
  if (views.length < 2) return null;

  async function choose(role: string) {
    if (busy || role === user?.role) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.post<{ user: User }>("/api/auth/view-as", { role });
      acceptUser(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The view could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel account-profile acct-section" aria-labelledby="view-as-title">
      <h2 id="view-as-title">View as</h2>
      <p>
        Your account is <strong>{roleLabel(user?.platformRole)}</strong>. Choose a side to use the site as
        that role. You can always switch back here.
      </p>
      <fieldset className="acct-views" disabled={busy}>
        <legend>Use Stayblz as</legend>
        {views.map((role) => (
          <label key={role}>
            <input
              type="radio"
              name="view-as"
              value={role}
              checked={user?.role === role}
              onChange={() => void choose(role)}
            />
            {roleLabel(role)}
          </label>
        ))}
      </fieldset>
      <p className="acct-muted">{help[user?.role ?? "member"]}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
