import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon, Skeletons } from "../components/community/ui";
import "../components/stayblz-data/stayblz-data.css";

const FormFav = lazy(() => import("../components/stayblz-data/FormFav"));

type Tab = "meeting" | "horses" | "stats";

/**
 * /stayblz-data (Explore → Stayblz Data): FormFav racing for the United States and Canada — Meeting (meetings, race
 * form, predictions, results), Horses (A–Z) and Stats (jockeys and trainers A–Z). components/stayblz-data/FormFav.tsx.
 * The Equibase Races / Horses tabs are hidden (components/stayblz-data/EquibaseTabs.tsx).
 */
export default function StayblzData() {
  const [params, setParams] = useSearchParams();
  // Older links: ?tab=formfav&ff=stats → Stats; ?tab=races / formfav → Meeting.
  const raw = params.get("tab");
  const tab: Tab = raw === "horses" ? "horses" : raw === "stats" || params.get("ff") === "stats" ? "stats" : "meeting";

  const show = (next: Tab) => {
    const p = new URLSearchParams(params);
    p.delete("ff");
    if (next === "meeting") p.delete("tab");
    else p.set("tab", next);
    setParams(p);
  };

  return (
    <div className="cm sd">
      <header className="cm-hero gx-glass">
        <div className="cm-hero-main">
          <span className="cm-kicker">
            <span className="cm-pulse" aria-hidden="true" /> Explore
          </span>
          <h1>
            Stayblz Data<span>.</span>
          </h1>
          <p>
            Racing in the United States and Canada: meetings, race form, results and model predictions, every horse A–Z, and jockey
            and trainer stats. Source: FormFav.
          </p>
        </div>
        <nav className="cm-seg cm-hero-tabs" aria-label="Stayblz Data sections">
          <button type="button" aria-pressed={tab === "meeting"} onClick={() => show("meeting")}>
            <Icon.Flag /> Meeting
          </button>
          <button type="button" aria-pressed={tab === "horses"} onClick={() => show("horses")}>
            <Icon.Horse /> Horses
          </button>
          <button type="button" aria-pressed={tab === "stats"} onClick={() => show("stats")}>
            <Icon.Search /> Stats
          </button>
        </nav>
      </header>

      <Suspense fallback={<Skeletons kind="card" count={6} />}>
        <FormFav view={tab === "meeting" ? "meetings" : tab} />
      </Suspense>
    </div>
  );
}
