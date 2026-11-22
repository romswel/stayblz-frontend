import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { canUse } from "../account/roles";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { useConfirm } from "../ui/Confirm";
import { stallionMediaUrl, stallionsApi } from "./api";
import FeatureStallion from "./FeatureStallion";
import Gallery from "./Gallery";
import OffspringPanel, { OwnRecord } from "./OffspringPanel";
import PedigreeChart from "./PedigreeChart";
import RequestDialog from "./RequestDialog";
import { AvailabilityTag } from "./StallionCard";
import StallionsNav, { StallionsDisclaimer, useCompare } from "./StallionsNav";
import {
  FEE_TERMS,
  FOALED_COUNTRIES,
  METHODS,
  ageOf,
  amount,
  breedLabel,
  breedingLine,
  dateText,
  feeText,
  geneticResult,
  GENETIC_TESTS,
  hands,
  labelOf,
  money,
  regionLabel,
  sireLine,
  takesRequests,
} from "./options";
import type { StallionProfile } from "./types";

/** A page view counts once per stallion per half hour in this tab (refreshing doesn't pad the owner's numbers). */
const counted = new Map<string, number>();
function countThisView(id: string) {
  const last = counted.get(id) ?? 0;
  if (Date.now() - last < 30 * 60_000) return false;
  counted.set(id, Date.now());
  return true;
}

const formatBytes = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** One stallion's page: pictures, fee and terms, pedigree, record, offspring in Stayblz data, genetics, and Ask. */
export default function StallionPage({ signedIn }: { signedIn: boolean }) {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const compare = useCompare();
  const [state, setState] = useState<{ loading: boolean; error: string; missing: boolean; s: StallionProfile | null }>({ loading: true, error: "", missing: false, s: null });
  const [version, setVersion] = useState(0);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const isAdmin = canUse(user, "admin");
  const [hiding, setHiding] = useState<{ reason: string } | null>(null);

  useEffect(() => {
    const c = new AbortController();
    setState((st) => ({ ...st, loading: true, error: "" }));
    stallionsApi
      .profile(id, { view: version === 0 && countThisView(id), signal: c.signal })
      .then((s) => !c.signal.aborted && setState({ loading: false, error: "", missing: false, s }))
      .catch((e) => {
        if (c.signal.aborted) return;
        const status = (e as { status?: number }).status;
        setState((st) => ({ ...st, loading: false, missing: status === 404, error: e instanceof Error ? e.message : "This stallion couldn't be loaded." }));
      });
    return () => c.abort();
  }, [id, version]);

  const s = state.s;
  // Opened with ?ask=1 (e.g. after logging in): straight to the request.
  useEffect(() => {
    if (s && params.get("ask") === "1" && signedIn && takesRequests(s)) setAsking(true);
  }, [s, params, signedIn]);

  if (state.loading && !s)
    return (
      <div className="st-page">
        <p className="st-count-line" role="status">
          Loading…
        </p>
        <div className="st-profile-skeleton gx-glass" aria-hidden="true" />
      </div>
    );
  if (!s)
    return (
      <div className="st-page">
        <div className="st-empty gx-glass" role="alert">
          <h2>{state.missing ? "This stallion isn't listed any more." : "This stallion couldn't be loaded."}</h2>
          <p>{state.missing ? "The owner may have taken his page down." : state.error}</p>
          <div className="st-actions">
            {!state.missing && (
              <button type="button" className="btn btn-quiet" onClick={() => setVersion((v) => v + 1)}>
                Try again
              </button>
            )}
            <Link to="/stallions" className="btn btn-primary">
              Browse stallions
            </Link>
          </div>
        </div>
      </div>
    );

  const age = ageOf(s.foaled);
  const line = sireLine(s.pedigree);
  const record = s.raceRecord;
  const shareUrl = `${window.location.origin}/stallions/${s.id}`;
  const update = (next: StallionProfile) => setState((st) => ({ ...st, s: next }));

  async function share() {
    const data = { title: `${s!.name} | Stayblz Stallions`, text: `${s!.name}${breedingLine(s!) ? `, ${breedingLine(s!)}` : ""}. ${feeText(s!)}.`, url: shareUrl };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(shareUrl);
        setNotice("Link copied. Paste it anywhere to share his page.");
      }
    } catch {
      /* the share sheet was closed */
    }
  }
  async function toggleSave() {
    const on = !s!.saved;
    update({ ...s!, saved: on, saves: Math.max(0, s!.saves + (on ? 1 : -1)) });
    try {
      const r = await stallionsApi.save(s!.id, on);
      update({ ...s!, saved: r.saved, saves: r.saves });
    } catch (e) {
      update(s!);
      setNotice(e instanceof Error ? e.message : "That didn't save.");
    }
  }
  async function setPublished(publish: boolean) {
    if (!publish && !(await confirm({ title: `Take ${s!.name} off the directory?`, message: "His page goes back to a draft only you can see. You can publish him again any time.", confirmLabel: "Unpublish" }))) return;
    setBusy(true);
    try {
      update(await stallionsApi.publish(s!.id, publish));
      setNotice(publish ? `${s!.name} is now in the directory.` : `${s!.name} is a draft again.`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!(await confirm({ title: `Remove ${s!.name}?`, message: s!.mine ? "His page, photos, videos and documents are deleted. Requests you received stay in your list. This can't be undone." : `This removes ${s!.ownerName}'s stallion for everyone. This can't be undone.`, confirmLabel: "Remove stallion", tone: "danger" }))) return;
    setBusy(true);
    try {
      await stallionsApi.remove(s!.id);
      navigate(s!.mine ? "/stallions/manage" : "/stallions", { replace: true });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "He couldn't be removed.");
      setBusy(false);
    }
  }
  async function moderate(hidden: boolean, reason = "") {
    setBusy(true);
    try {
      update(await stallionsApi.moderate(s!.id, hidden, reason));
      setHiding(null);
      setNotice(hidden ? "Hidden from the directory." : "Unhidden. The owner can publish him again.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  const facts: [string, string][] = [
    ["Breed", breedLabel(s.breed)],
    ["Foaled", s.foaled ? `${s.foaled}${age !== null ? ` (${age} years old)` : ""}${s.country ? `, ${labelOf(FOALED_COUNTRIES, s.country)}` : ""}` : ""],
    ["Colour", s.color],
    ["Height", hands(s.heightIn)],
    ["Registry", [s.registry, s.registration].filter(Boolean).join(" · ")],
    ["At stud since", s.firstSeason ? String(s.firstSeason) : ""],
  ].filter(([, v]) => v) as [string, string][];
  const genetics = GENETIC_TESTS.filter((t) => s.genetics[t.key] !== undefined);
  const canAsk = takesRequests(s);

  const askButton = !signedIn ? (
    <Link to="/login" state={{ destination: `/stallions/${s.id}?ask=1` }} className="btn btn-primary">
      Log in to ask about a breeding
    </Link>
  ) : canAsk ? (
    <button type="button" className="btn btn-primary" onClick={() => setAsking(true)}>
      Ask about a breeding
    </button>
  ) : null;

  return (
    <div className="st-page st-profile">
      <StallionsNav
        signedIn={signedIn}
        kicker={`Stayblz Stallions · ${breedLabel(s.breed)}`}
        title={
          <>
            {s.name}
            {s.featured && <span className="st-tag is-featured st-title-tag">Featured</span>}
          </>
        }
        lead={breedingLine(s) || undefined}
        actions={
          <>
            {signedIn ? (
              <button type="button" className={`btn btn-quiet st-save${s.saved ? " is-on" : ""}`} aria-pressed={s.saved} onClick={() => void toggleSave()} disabled={s.status !== "published"}>
                {s.saved ? "Saved" : "Save"} · {s.saves}
              </button>
            ) : null}
            <button type="button" className="btn btn-quiet" aria-pressed={compare.ids.includes(s.id)} onClick={() => compare.toggle(s.id)} disabled={compare.full && !compare.ids.includes(s.id)}>
              {compare.ids.includes(s.id) ? "In compare" : "Compare"}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => void share()}>
              Share
            </button>
            {askButton}
          </>
        }
      />

      {s.status !== "published" && (
        <p className={`st-alert ${s.status === "hidden" ? "is-error" : "is-warn"}`} role="status">
          {s.status === "hidden"
            ? `A Stayblz admin hid this stallion${s.hiddenReason ? `: ${s.hiddenReason}` : "."} Only you${isAdmin ? " and admins" : ""} can see this page.`
            : "This is a draft: only you can see it. Publish him to show him in the directory."}
        </p>
      )}
      {notice && (
        <p className="st-alert is-ok" role="status">
          {notice}{" "}
          <button type="button" className="st-link" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </p>
      )}

      {(s.mine || isAdmin) && (
        <section className="st-owner-bar gx-glass" aria-label="Manage this stallion">
          {s.mine && s.owner && (
            <dl className="st-owner-stats">
              <div>
                <dt>Page views (30 days)</dt>
                <dd>{s.owner.views30}</dd>
              </div>
              <div>
                <dt>Saved by</dt>
                <dd>{s.saves}</dd>
              </div>
              <div>
                <dt>Breeding requests</dt>
                <dd>
                  <Link to="/stallions/requests">
                    {s.owner.requests}
                    {s.owner.newRequests ? ` (${s.owner.newRequests} new)` : ""}
                  </Link>
                </dd>
              </div>
            </dl>
          )}
          <div className="st-owner-actions">
            {s.mine && (
              <Link to={`/stallions/manage/${s.id}`} className="btn btn-quiet">
                Edit
              </Link>
            )}
            {s.mine && s.status !== "hidden" && (
              <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => void setPublished(s.status !== "published")}>
                {s.status === "published" ? "Unpublish" : "Publish"}
              </button>
            )}
            {isAdmin && !s.mine && (
              <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => (s.status === "hidden" ? void moderate(false) : setHiding({ reason: "" }))}>
                {s.status === "hidden" ? "Unhide" : "Hide"}
              </button>
            )}
            <button type="button" className="btn btn-quiet st-danger-text" disabled={busy} onClick={() => void remove()}>
              Remove
            </button>
          </div>
          {s.mine && s.status === "published" && <FeatureStallion stallionId={s.id} name={s.name} featuredUntil={s.featuredUntil} onFeatured={() => setVersion((v) => v + 1)} />}
        </section>
      )}

      <div className="st-profile-top">
        <Gallery media={s.media} name={s.name} />
        <aside className="st-fee-card gx-glass" aria-label="Fee and booking">
          <span className="st-label">{s.seasonYear} fee</span>
          <strong className="st-fee">{feeText(s)}</strong>
          {s.fee !== null && <span className="st-fee-terms">{labelOf(FEE_TERMS, s.feeTerms)}</span>}
          {s.bookingFee !== null && <span className="st-muted">Booking fee {money(s.bookingFee, s.feeCurrency)} (part of the fee unless the owner says otherwise)</span>}
          {s.feeNote && <p className="st-fee-note">{s.feeNote}</p>}
          <AvailabilityTag value={s.availability} />
          <dl className="st-mini-facts">
            <div>
              <dt>Stands at</dt>
              <dd>{[s.farm, s.location].filter(Boolean).join(", ")}</dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd>
                <Link to={`/stallions?region=${encodeURIComponent(s.region)}`}>{regionLabel(s.region)}</Link>
              </dd>
            </div>
            <div>
              <dt>Breeding</dt>
              <dd>{s.methods.map((m) => labelOf(METHODS, m)).join(", ")}</dd>
            </div>
            {s.shippingNote && (
              <div>
                <dt>Shipping</dt>
                <dd>{s.shippingNote}</dd>
              </div>
            )}
            {s.programs && (
              <div>
                <dt>Breeders' programs</dt>
                <dd>{s.programs}</dd>
              </div>
            )}
          </dl>
          {askButton}
          {!s.mine && s.status === "published" && !canAsk && <p className="st-muted">The owner isn't taking requests for him right now.</p>}
          <Link to={`/stallions/mating?stallion=${s.id}`} className="btn btn-quiet">
            Check your mare with him
          </Link>
          <p className="st-muted st-owner-line">Listed by {s.ownerName}</p>
        </aside>
      </div>

      <div className="st-columns">
        <section className="st-panel gx-glass">
          <h2 className="st-panel-title">About {s.name}</h2>
          {s.description ? <div className="st-description">{s.description.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div> : <p className="st-muted">The owner hasn't written about him yet.</p>}
          {facts.length > 0 && (
            <dl className="st-facts">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="st-panel gx-glass">
          <h2 className="st-panel-title">Race record</h2>
          {record.starts !== undefined ? (
            <p className="st-record">
              <span className="st-tag is-muted">From the owner</span> {record.starts} starts, {record.wins ?? 0} wins, {record.places ?? 0} seconds, {record.shows ?? 0} thirds
              {record.earnings ? `, earned ${money(record.earnings, record.currency ?? "USD")}` : ""}.
            </p>
          ) : (
            <p className="st-muted">The owner hasn't added his race record.</p>
          )}
          {s.highlights.length > 0 && (
            <ul className="st-highlights">
              {s.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
          {s.racing && <OwnRecord racing={s.racing} />}
          {s.fertilityRate !== null && (
            <p className="st-record">
              <span className="st-tag is-muted">From the owner</span> Live foal rate {s.fertilityRate}%{s.fertilityNote ? `: ${s.fertilityNote}` : ""}
            </p>
          )}
        </section>
      </div>

      <section className="st-panel gx-glass">
        <div className="st-panel-head">
          <h2 className="st-panel-title">Pedigree</h2>
          {line.length > 1 && <p className="st-muted">Sire line: {line.join(" › ")}</p>}
        </div>
        <PedigreeChart pedigree={s.pedigree} depth={4} label={`${s.name}'s pedigree`} />
        <p className="st-muted">As the owner entered it.</p>
      </section>

      <section className="st-panel gx-glass">
        <h2 className="st-panel-title">His offspring in Stayblz racing data</h2>
        <OffspringPanel offspring={s.offspring} name={s.name} />
      </section>

      {(genetics.length > 0 || s.documents.length > 0) && (
        <div className="st-columns">
          {genetics.length > 0 && (
            <section className="st-panel gx-glass">
              <h2 className="st-panel-title">Genetic tests</h2>
              <ul className="st-genetic-results">
                {genetics.map((t) => (
                  <li key={t.key} title={t.name}>
                    <strong>{t.label}</strong> <span className={`st-tag is-${s.genetics[t.key] === 0 ? "ok" : "warn"}`}>{geneticResult(t.key, s.genetics[t.key])}</span>
                    <small>{t.name}</small>
                  </li>
                ))}
              </ul>
              <p className="st-muted">As the owner states them. Ask for the lab report before you book.</p>
            </section>
          )}
          {s.documents.length > 0 && (
            <section className="st-panel gx-glass">
              <h2 className="st-panel-title">Documents</h2>
              <ul className="st-docs">
                {s.documents.map((d) => (
                  <li key={d.id}>
                    <a href={stallionMediaUrl(d.id)} download>
                      {d.name}
                    </a>{" "}
                    <small>PDF · {formatBytes(d.size)}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <p className="st-muted st-updated">
        Page updated {dateText(s.updatedAt)}
        {s.offspring?.earnings?.length ? ` · offspring earnings ${s.offspring.earnings.map((e) => amount(e.amount, e.currency)).join(" + ")}` : ""}
      </p>
      <StallionsDisclaimer />

      {hiding && (
        <Modal onClose={() => setHiding(null)} label={`Hide ${s.name}`} className="gx-layer modal-sm">
          <DialogHead kicker="Moderation" title={`Hide ${s.name}?`} onClose={() => setHiding(null)} />
          <form
            className="dlg"
            onSubmit={(e) => {
              e.preventDefault();
              if (hiding.reason.trim().length >= 3) void moderate(true, hiding.reason.trim());
            }}
          >
            <p className="dlg-text">He leaves the directory at once. The owner sees your reason and can't publish him again until an admin unhides him.</p>
            <label className="st-field">
              <span>Reason (the owner sees this)</span>
              <input value={hiding.reason} maxLength={300} autoFocus onChange={(e) => setHiding({ reason: e.target.value })} />
            </label>
            <div className="dlg-actions">
              <button type="button" className="btn btn-quiet" onClick={() => setHiding(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger" disabled={busy || hiding.reason.trim().length < 3}>
                Hide stallion
              </button>
            </div>
          </form>
        </Modal>
      )}
      {asking && (
        <RequestDialog
          stallion={s}
          onClose={() => {
            setAsking(false);
            if (params.get("ask")) {
              params.delete("ask");
              setParams(params, { replace: true });
            }
          }}
        />
      )}
    </div>
  );
}
