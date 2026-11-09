import { useState } from "react";
import { Link } from "react-router-dom";
import "./status.css";

const KEY = "stayblz.devNotice.hidden";
const hiddenThisVisit = () => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Site-wide "development preview" notice. Hiding it lasts until the browser is closed,
 * so every new visit is reminded. The footer keeps a permanent "Development preview" label.
 */
export default function DevNotice({ variant = "app" }: { variant?: "app" | "public" }) {
  const [hidden, setHidden] = useState(hiddenThisVisit);
  if (hidden) return null;
  return (
    <div className={`dev-notice is-${variant}`} role="note" aria-label="Development preview">
      <strong>Development preview</strong>
      <span>
        Stayblz is still being built. Expect bugs, missing data and changes. See what's new in the{" "}
        <Link to="/updates">Updates</Link>.
      </span>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem(KEY, "1");
          } catch {
            /* still hides for this page view */
          }
          setHidden(true);
        }}
      >
        Hide
      </button>
    </div>
  );
}
