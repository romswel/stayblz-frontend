import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useTheme } from "../../theme";
import { useUpdates } from "../../components/updates/UpdatesContext";
import type { User } from "../../types";
import AccountHeader from "./AccountNav";

export default function AccountPreferences() {
  const { user, acceptUser } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const { popupOn, setPopup } = useUpdates();
  const [marketing, setMarketing] = useState(!!user?.preferences?.marketingOptIn);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function saveMarketing(next: boolean) {
    setMarketing(next);
    setError("");
    setNotice("");
    try {
      const result = await api.patch<{ user?: User }>("/api/auth/preferences", { marketingOptIn: next });
      if (result?.user?.id) acceptUser(result.user);
      setNotice("Saved.");
    } catch (reason) {
      setMarketing(!next);
      setError(reason instanceof Error ? reason.message : "This setting could not be saved.");
    }
  }

  return (
    <>
      <AccountHeader title="Preferences" intro="How Stayblz looks and what it tells you about." />
      <div className="acct-sections">
      <section className="panel account-profile acct-section" aria-labelledby="look-title">
        <h2 id="look-title">Appearance</h2>
        <label className="acct-toggle">
          <input type="checkbox" checked={theme === "dark"} onChange={toggleTheme} />
          <span>
            Dark mode
            <small>Saved on this device. You can also switch by tapping the Stayblz logo.</small>
          </span>
        </label>
      </section>
      <section className="panel account-profile acct-section" aria-labelledby="updates-title">
        <h2 id="updates-title">Updates</h2>
        <label className="acct-toggle">
          <input type="checkbox" checked={popupOn} onChange={(e) => void setPopup(e.target.checked)} />
          <span>
            Show a pop-up when there's a new post in Updates
            <small>
              Every post stays on the <Link to="/updates">Updates</Link> page.
            </small>
          </span>
        </label>
        <label className="acct-toggle">
          <input type="checkbox" checked={marketing} onChange={(e) => void saveMarketing(e.target.checked)} />
          <span>
            Email me Stayblz news and updates
            <small>
              We don't send newsletters yet; this records your choice for when we do. Account emails (confirmation,
              password reset) are always sent.
            </small>
          </span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
      </section>
      </div>
    </>
  );
}
