import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth";
import { profileComplete } from "../../pages/Welcome";
import "./profile-nudge.css";

const key = (id: string) => `stayblz.profile-nudge.${id}`;

/** "Finish your profile" on the dashboard, for people who skipped it after verifying. Hidden for a week on "Later". */
export default function ProfileNudge() {
  const { user } = useAuth();
  const [hidden, setHidden] = useState(() => {
    try {
      return !!user && Date.now() - Number(localStorage.getItem(key(user.id)) ?? 0) < 7 * 86_400_000;
    } catch {
      return false;
    }
  });
  if (!user || hidden || profileComplete(user) || user.platformRole === "superadmin") return null;
  return (
    <aside className="pn gx-glass" aria-label="Finish your profile">
      <span className="pn-icon" aria-hidden="true">
        ✎
      </span>
      <p>
        <strong>Finish your profile</strong>
        <span>Add your country and your part in racing so people know who you are.</span>
      </p>
      <div className="pn-actions">
        <button
          type="button"
          className="pn-later"
          onClick={() => {
            try {
              localStorage.setItem(key(user.id), String(Date.now()));
            } catch {
              /* Shown again next visit. */
            }
            setHidden(true);
          }}
        >
          Later
        </button>
        <Link className="pn-go" to="/welcome">
          Finish profile
        </Link>
      </div>
    </aside>
  );
}
