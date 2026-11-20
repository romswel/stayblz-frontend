import { Link } from "react-router-dom";
import BriefNotice from "../ui/BriefNotice";

/**
 * "Development preview" heads-up: a small card that shows for a few seconds at most once a day on this device,
 * then gets out of the way (it used to be a banner on top of every page). The footer keeps a permanent
 * "Development preview" label. `variant` is kept for the callers; both look the same now.
 */
export default function DevNotice(_props: { variant?: "app" | "public" }) {
  return (
    <BriefNotice
      storageKey="stayblz.devNotice.shownAt"
      everyDays={1}
      title="Development preview."
      icon={
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-2.4z" />
        </svg>
      }
    >
      Stayblz is still being built, so expect bugs and changes. <Link to="/updates">What's new</Link>
    </BriefNotice>
  );
}
