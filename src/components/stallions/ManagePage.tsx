import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useConfirm } from "../ui/Confirm";
import { stallionsApi } from "./api";
import { breedingLine, dateText, feeText } from "./options";
import { StallionPhoto } from "./StallionCard";
import StallionsNav from "./StallionsNav";
import type { MyStallion } from "./types";

/** Views per day for the last 30 days as a tiny line (no axes: the number beside it is the total). */
function Sparkline({ days }: { days: number[] }) {
  const max = Math.max(1, ...days);
  const points = days.map((v, i) => `${(i / Math.max(1, days.length - 1)) * 100},${28 - (v / max) * 26}`).join(" ");
  return (
    <svg className="st-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

const STATUS = { draft: "Draft", published: "In the directory", hidden: "Hidden by an admin" } as const;

export default function ManagePage() {
  const confirm = useConfirm();
  const [state, setState] = useState<{ loading: boolean; error: string; list: MyStallion[]; access: { allowed: boolean; plan?: string } | null }>({ loading: true, error: "", list: [], access: null });
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    stallionsApi
      .mine()
      .then((d) => live && setState({ loading: false, error: "", list: d.stallions, access: d.access }))
      .catch((e) => live && setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Your stallions couldn't be loaded." })));
    return () => {
      live = false;
    };
  }, [version]);

  async function publish(s: MyStallion, on: boolean) {
    if (!on && !(await confirm({ title: `Take ${s.name} off the directory?`, message: "His page goes back to a draft only you can see.", confirmLabel: "Unpublish" }))) return;
    setBusy(s.id);
    setNotice("");
    try {
      await stallionsApi.publish(s.id, on);
      setNotice(on ? `${s.name} is now in the directory.` : `${s.name} is a draft again.`);
      setVersion((v) => v + 1);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  }
  async function remove(s: MyStallion) {
    if (!(await confirm({ title: `Remove ${s.name}?`, message: "His page, photos, videos and documents are deleted. Requests you received stay in your list. This can't be undone.", confirmLabel: "Remove stallion", tone: "danger" }))) return;
    setBusy(s.id);
    try {
      await stallionsApi.remove(s.id);
      setState((st) => ({ ...st, list: st.list.filter((x) => x.id !== s.id) }));
      setNotice(`${s.name} was removed.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "He couldn't be removed.");
    } finally {
      setBusy(null);
    }
  }

  const { loading, error, list, access } = state;
  return (
    <div className="st-page">
      <StallionsNav
        signedIn
        title="My stallions"
        lead="Your stallions' pages, how many breeders look at them, and the requests they bring."
        actions={
          <Link to="/stallions/manage/new" className="btn btn-primary">
            List a stallion
          </Link>
        }
      />
      {access && !access.allowed && (
        <p className="st-alert is-warn" role="status">
          Listing stallions needs the Stallion Showcase plan. <Link to="/billing/plans">See plans</Link>
        </p>
      )}
      {notice && (
        <p className="st-alert is-ok" role="status">
          {notice}
        </p>
      )}
      {loading && !list.length ? (
        <p className="st-count-line" role="status">
          Loading your stallions…
        </p>
      ) : error && !list.length ? (
        <div className="st-empty gx-glass" role="alert">
          <h2>Your stallions couldn't be loaded.</h2>
          <p>{error}</p>
          <button type="button" className="btn btn-quiet" onClick={() => setVersion((v) => v + 1)}>
            Try again
          </button>
        </div>
      ) : !list.length ? (
        <div className="st-empty gx-glass st-start">
          <h2>List your first stallion</h2>
          <ol className="st-steps">
            <li>
              <strong>Tell breeders about him.</strong> Fee and terms, where he stands, his pedigree and race record. Pick his record from Stayblz racing data
              and we fill in what we know.
            </li>
            <li>
              <strong>Add photos and videos.</strong> Conformation shots, a walk and trot video, his contract as a PDF.
            </li>
            <li>
              <strong>Publish.</strong> Breeders find him by fee, region and pedigree, check their mares against him, and ask you about a season in Stayblz
              Chat.
            </li>
          </ol>
          <Link to="/stallions/manage/new" className="btn btn-primary">
            List a stallion
          </Link>
        </div>
      ) : (
        <ul className="st-mine">
          {list.map((s) => (
            <li key={s.id} className="st-mine-row gx-glass">
              <Link to={`/stallions/${s.id}`} className="st-mine-photo-link" aria-label={`Open ${s.name}'s page`}>
                <StallionPhoto stallion={s} className="st-mine-photo" />
              </Link>
              <div className="st-mine-main">
                <div className="st-mine-title">
                  <h2>
                    <Link to={`/stallions/${s.id}`}>{s.name}</Link>
                  </h2>
                  <span className={`st-tag is-${s.status === "published" ? "ok" : s.status === "hidden" ? "danger" : "muted"}`}>{STATUS[s.status]}</span>
                  {s.featured && <span className="st-tag is-featured">Featured until {dateText(s.featuredUntil)}</span>}
                </div>
                <p className="st-muted">
                  {breedingLine(s) || "Pedigree not added"} · {feeText(s)} · {s.location}
                </p>
                {s.status === "hidden" && s.hiddenReason && <p className="st-alert is-error">Reason: {s.hiddenReason}</p>}
                <dl className="st-mine-stats">
                  <div>
                    <dt>Views, 30 days</dt>
                    <dd>
                      {s.views30} <Sparkline days={s.daily} />
                    </dd>
                  </div>
                  <div>
                    <dt>Saved by</dt>
                    <dd>{s.saves}</dd>
                  </div>
                  <div>
                    <dt>Requests</dt>
                    <dd>
                      <Link to="/stallions/requests">
                        {s.requests}
                        {s.newRequests ? <span className="st-new"> {s.newRequests} new</span> : null}
                      </Link>
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="st-mine-actions">
                <Link to={`/stallions/manage/${s.id}`} className="btn btn-quiet">
                  Edit
                </Link>
                {s.status !== "hidden" && (
                  <button type="button" className="btn btn-quiet" disabled={busy === s.id} onClick={() => void publish(s, s.status !== "published")}>
                    {s.status === "published" ? "Unpublish" : "Publish"}
                  </button>
                )}
                <button type="button" className="btn btn-quiet st-danger-text" disabled={busy === s.id} onClick={() => void remove(s)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
