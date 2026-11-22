import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import { stallionsApi } from "./api";
import MareFields, { emptyMare } from "./MareFields";
import MatingReportView from "./MatingReportView";
import { feeText, regionLabel, takesRequests } from "./options";
import { StallionPhoto } from "./StallionCard";
import StallionsNav, { StallionsDisclaimer } from "./StallionsNav";
import type { MareDraft, Match, MatingReport, SavedMare, StallionProfile } from "./types";

const LEVEL = { danger: "Genetic risk", test: "Test first", warn: "Carrier", clear: "" } as const;

/**
 * The mating check. With ?stallion=<id>: the full check of that stallion with your mare. Without: your mare against
 * every listed stallion (closest relations and genetic risks first), then a full check of any of them.
 */
export default function MatingPage({ signedIn }: { signedIn: boolean }) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const stallionId = params.get("stallion") ?? "";
  const [stallion, setStallion] = useState<StallionProfile | null>(null);
  const [stallionError, setStallionError] = useState("");
  const [mares, setMares] = useState<SavedMare[] | null>(null);
  const [source, setSource] = useState<string>("typed");
  const [mare, setMare, clearMare, restored] = useDraft<MareDraft>(signedIn ? accountDraftKey(user?.id, "stallions.mating-mare") : null, emptyMare());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<MatingReport | null>(null);
  const [matches, setMatches] = useState<{ list: Match[]; total: number; mareName: string } | null>(null);
  const [sort, setSort] = useState("inbreeding");
  const [sameBreed, setSameBreed] = useState(true);
  const [saveNote, setSaveNote] = useState("");
  // "Full check" from the list runs the check as soon as that stallion has loaded.
  const autoRun = useRef(false);

  useEffect(() => {
    setReport(null);
    setStallion(null);
    setStallionError("");
    if (!stallionId) return;
    const c = new AbortController();
    stallionsApi
      .profile(stallionId, { signal: c.signal })
      .then((s) => {
        if (c.signal.aborted) return;
        setStallion(s);
        if (autoRun.current) {
          autoRun.current = false;
          void run();
        }
      })
      .catch((e) => !c.signal.aborted && setStallionError(e instanceof Error ? e.message : "This stallion couldn't be loaded."));
    return () => c.abort();
  }, [stallionId]);

  useEffect(() => {
    if (!signedIn) return;
    stallionsApi
      .mares()
      .then((list) => {
        setMares(list);
        if (list.length && !mare.name && !Object.keys(mare.pedigree).length) setSource(list[0].id);
      })
      .catch(() => setMares([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const body = () => (source !== "typed" ? { mareId: source } : { mare });
  const ready = source !== "typed" || !!(mare.pedigree.s || mare.pedigree.d);

  async function run() {
    if (!ready) {
      setError("Add at least her sire or dam.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (stallionId) {
        setReport(await stallionsApi.mating(stallionId, body()));
        setMatches(null);
      } else {
        const r = await stallionsApi.matches({ ...body(), sort, sameBreed });
        setMatches({ list: r.matches, total: r.total, mareName: r.mare.name });
        setReport(null);
      }
      window.setTimeout(() => document.getElementById("st-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The check couldn't be run. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Re-sort / re-filter the list straight away once it's shown.
  useEffect(() => {
    if (matches && !stallionId) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, sameBreed]);

  async function saveMare() {
    setSaveNote("");
    try {
      const saved = await stallionsApi.addMare(mare);
      setMares((m) => [...(m ?? []), saved].sort((a, b) => a.name.localeCompare(b.name)));
      setSource(saved.id);
      clearMare();
      setSaveNote(`${saved.name} is saved under My mares.`);
    } catch (e) {
      setSaveNote(e instanceof Error ? e.message : "She couldn't be saved.");
    }
  }

  return (
    <div className="st-page">
      <StallionsNav
        signedIn={signedIn}
        title="Mating check"
        lead="See what a foal from your mare and a stallion would carry: shared ancestors, inbreeding, genetic test results, and how the cross has run."
      />

      <section className="st-panel gx-glass st-mating-setup">
        <div className="st-step">
          <h2>1. The stallion</h2>
          {stallionId ? (
            stallion ? (
              <div className="st-picked">
                <StallionPhoto stallion={stallion} className="st-picked-photo" />
                <div>
                  <strong>
                    <Link to={`/stallions/${stallion.id}`}>{stallion.name}</Link>
                  </strong>
                  <small>
                    {feeText(stallion)} · {regionLabel(stallion.region)}
                  </small>
                </div>
                <button type="button" className="st-link" onClick={() => setParams({}, { replace: true })}>
                  Check every stallion instead
                </button>
              </div>
            ) : stallionError ? (
              <p className="st-alert is-error" role="alert">
                {stallionError}{" "}
                <button type="button" className="st-link" onClick={() => setParams({}, { replace: true })}>
                  Check every stallion instead
                </button>
              </p>
            ) : (
              <p className="st-muted">Loading the stallion…</p>
            )
          ) : (
            <p className="st-muted">
              Every listed stallion. <Link to="/stallions">Pick one in the directory</Link> for a full check, or run this and choose from the list.
            </p>
          )}
        </div>

        <div className="st-step">
          <h2>2. Your mare</h2>
          {signedIn && mares && mares.length > 0 && (
            <label className="st-field">
              <span>Mare</span>
              <select value={source} onChange={(e) => setSource(e.target.value)}>
                {mares.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.pedigree.s ? ` (by ${m.pedigree.s})` : ""}
                  </option>
                ))}
                <option value="typed">Type in another mare</option>
              </select>
            </label>
          )}
          {source === "typed" && (
            <>
              {restored && (
                <p className="st-muted">
                  We kept what you typed.{" "}
                  <button type="button" className="st-link" onClick={clearMare}>
                    Start again
                  </button>
                </p>
              )}
              <MareFields value={mare} onChange={setMare} disabled={busy} idPrefix="mating-mare" />
              {signedIn ? (
                <p className="st-muted">
                  <button type="button" className="st-link" disabled={!mare.name.trim()} onClick={() => void saveMare()}>
                    Save her to My mares
                  </button>{" "}
                  to check her again later.
                </p>
              ) : (
                <p className="st-muted">
                  <Link to="/signup">Create a free account</Link> to save your mares and ask owners about a breeding.
                </p>
              )}
              {saveNote && <p className="st-muted" role="status">{saveNote}</p>}
            </>
          )}
        </div>

        {error && (
          <p className="st-alert is-error" role="alert">
            {error}
          </p>
        )}
        <div className="st-actions">
          <button type="button" className="btn btn-primary" disabled={busy || (!!stallionId && !stallion)} onClick={() => void run()}>
            {busy ? "Checking…" : stallionId ? "Check this mating" : "Check her against every stallion"}
          </button>
        </div>
      </section>

      <div id="st-result" />
      {report && (
        <section className="st-panel gx-glass" aria-label="Mating check results">
          <h2 className="st-panel-title">
            {report.stallion.name} × {report.mare.name}
          </h2>
          <MatingReportView report={report} />
          {stallion && takesRequests(stallion) && (
            <div className="st-actions">
              <Link to={`/stallions/${stallion.id}?ask=1`} className="btn btn-primary">
                Ask about breeding to {stallion.name}
              </Link>
            </div>
          )}
        </section>
      )}

      {matches && (
        <section className="st-panel gx-glass" aria-label="Every stallion for this mare">
          <div className="st-panel-head">
            <h2 className="st-panel-title">
              {matches.mareName} with {matches.total} {matches.total === 1 ? "stallion" : "stallions"}
            </h2>
            <div className="st-inline-controls">
              <label className="st-field st-inline">
                <span>Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="inbreeding">Least related first</option>
                  <option value="cross">Most runners from the cross</option>
                  <option value="fee">Fee: low to high</option>
                </select>
              </label>
              <label className="st-check">
                <input type="checkbox" checked={sameBreed} onChange={(e) => setSameBreed(e.target.checked)} />
                Same breed only
              </label>
            </div>
          </div>
          {!matches.list.length ? (
            <p className="st-muted">No stallions to check{sameBreed ? " in her breed" : ""} yet.</p>
          ) : (
            <div className="st-table-wrap">
              <table className="st-table st-matches">
                <thead>
                  <tr>
                    <th scope="col">Stallion</th>
                    <th scope="col" className="is-num">Inbreeding</th>
                    <th scope="col">Shared ancestors</th>
                    <th scope="col">Genetics</th>
                    <th scope="col" className="is-num" title="Runners from this stallion out of mares by her sire, in Stayblz racing data">This cross ran</th>
                    <th scope="col">Fee</th>
                    <th scope="col"><span className="st-sr">Full check</span></th>
                  </tr>
                </thead>
                <tbody>
                  {matches.list.map((m) => (
                    <tr key={m.stallion.id}>
                      <th scope="row">
                        <Link to={`/stallions/${m.stallion.id}`}>{m.stallion.name}</Link>
                        <small>{m.stallion.sire ? ` by ${m.stallion.sire}` : ""}</small>
                      </th>
                      <td className="is-num">{m.inbreeding.toFixed(m.inbreeding > 0 && m.inbreeding < 1 ? 2 : 1)}%</td>
                      <td>{m.shared.length ? m.shared.map((a) => `${a.name} ${a.notation}`).join(", ") + (m.sharedCount > 3 ? ` +${m.sharedCount - 3}` : "") : "None"}</td>
                      <td>
                        {m.genetics ? (
                          <span className={`st-tag is-${m.genetics.level === "danger" ? "danger" : "warn"}`} title={m.genetics.tests.join(", ")}>
                            {LEVEL[m.genetics.level]}: {m.genetics.tests.join(", ")}
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="is-num">{m.cross ? `${m.cross.runners} (${m.cross.winners} won)` : "–"}</td>
                      <td>{feeText(m.stallion)}</td>
                      <td>
                        <button type="button" className="st-link" onClick={() => {
                            autoRun.current = true;
                            setParams({ stallion: m.stallion.id });
                          }}>
                          Full check
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <StallionsDisclaimer />
    </div>
  );
}
