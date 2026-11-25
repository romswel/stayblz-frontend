import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useConfirm } from "../ui/Confirm";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { TopLayer } from "../community/HorseShare";
import { STATUS_LABELS, horseImageUrl, money, ordinal, type HorseDetail, type HorseStatus } from "../community/api";
import { EarlierStarts, StartsTable, StatTiles, WorkoutTable } from "../../pages/racing/ProfilePages";
import EntryDialog from "./EntryDialog";
import type { StatsTarget } from "../stayblz-data/formfavUi";
import type { RaceWhere } from "../stayblz-data/formfavApi";
import { ManualHorseForm, initials } from "./AddVirtualHorseDialog";
import {
  KIND_LABELS,
  LOCKED_BY_RACE_DATA,
  SALE_LABELS,
  SOURCE_LABELS,
  dayLabel,
  dollars,
  type EntryInput,
  type EntryKind,
  type RacingLive,
  type SaleResult,
  type VirtualApi,
  type VirtualDetail,
  type VirtualEntry,
  type VirtualMode,
} from "./api";

// Race data pieces (Stayblz Data's FormFav code) load only for linked horses / when opened.
const RaceDataPanel = lazy(() => import("./RaceDataPanel"));
const LinkRacingHorseDialog = lazy(() => import("./LinkRacingHorseDialog"));
const RaceDialog = lazy(() => import("../stayblz-data/formfavDialogs").then((m) => ({ default: m.RaceDialog })));
const StatsDialog = lazy(() => import("../stayblz-data/formfavDialogs").then((m) => ({ default: m.StatsDialog })));
const loadingRaceData = <p className="vs-muted" aria-busy="true">Loading race data…</p>;

const SECTIONS = [
  { key: "performance", label: "Performance" },
  { key: "races", label: "Races" },
  { key: "workouts", label: "Workouts" },
  { key: "sales", label: "Sales entries" },
  { key: "notes", label: "Notes" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];
const SECTION_KIND: Record<Exclude<Section, "performance">, EntryKind> = { races: "race", workouts: "workout", sales: "sale", notes: "note" };

export default function VirtualHorseDetail({
  client,
  mode,
  id,
  onBack,
  onChanged,
  backLabel = "← All tracked horses",
}: {
  client: VirtualApi;
  mode: VirtualMode;
  id: string;
  onBack: () => void;
  onChanged: () => void;
  backLabel?: string;
}) {
  const confirm = useConfirm();
  const [data, setData] = useState<VirtualDetail | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const [section, setSection] = useState<Section>("performance");
  const [dialog, setDialog] = useState<{ kind: EntryKind; entry?: VirtualEntry } | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const [linking, setLinking] = useState(false);
  const [alertsBusy, setAlertsBusy] = useState(false);
  const [race, setRace] = useState<RaceWhere | null>(null);
  const [stats, setStats] = useState<StatsTarget | null>(null);

  useEffect(() => {
    const c = new AbortController();
    setError("");
    client
      .get(id, c.signal)
      .then((d) => !c.signal.aborted && setData(d))
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "This horse couldn't be loaded."));
    return () => c.abort();
  }, [client, id, version]);

  if (error)
    return (
      <div className="vs-detail">
        <button type="button" className="vs-back" onClick={onBack}>{backLabel}</button>
        <p className="form-error" role="alert">{error}</p>
        <button type="button" className="vs-btn" onClick={() => setVersion((v) => v + 1)}>Try again</button>
      </div>
    );
  if (!data)
    return (
      <div className="vs-detail" aria-busy="true">
        <button type="button" className="vs-back" onClick={onBack}>{backLabel}</button>
        <p className="vs-muted">Loading horse…</p>
      </div>
    );

  const { horse, entries } = data;
  const community = data.live && "community" in data.live ? data.live.community : null;
  const racing = data.live && "racing" in data.live ? data.live.racing : null;
  const byKind = (k: EntryKind) => entries.filter((e) => e.kind === k);
  const team = mode === "stable";

  async function saveEntry(input: EntryInput) {
    const editingEntry = dialog?.entry;
    if (editingEntry) {
      const r = await client.updateEntry(editingEntry.id, input);
      setData((d) => d && { ...d, entries: sortEntries(d.entries.map((e) => (e.id === r.entry.id ? r.entry : e))) });
      setNotice("Entry updated.");
    } else {
      const r = await client.addEntry(horse.id, input);
      setData((d) => d && { ...d, entries: sortEntries([r.entry, ...d.entries]) });
      setNotice(`${KIND_LABELS[r.entry.kind]} saved.`);
    }
    setDialog(null);
    onChanged();
  }

  async function removeEntry(entry: VirtualEntry) {
    const ok = await confirm({ title: `Remove this ${KIND_LABELS[entry.kind].toLowerCase()}?`, message: "It will be removed for everyone who can see this list.", confirmLabel: "Remove", tone: "danger" });
    if (!ok) return;
    setActionError("");
    try {
      await client.removeEntry(entry.id);
      setData((d) => d && { ...d, entries: d.entries.filter((e) => e.id !== entry.id) });
      setNotice("Entry removed.");
      onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "This entry couldn't be removed.");
    }
  }

  async function removeHorse() {
    const ok = await confirm({
      title: `Remove ${horse.name} from Virtual Stayblz?`,
      message: team ? "Its logged workouts, races, sales entries and notes are removed for the whole team." : "Its logged workouts, races, sales entries and notes are removed too.",
      confirmLabel: "Remove horse",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(true);
    setActionError("");
    try {
      await client.remove(horse.id);
      onChanged();
      onBack();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "This horse couldn't be removed.");
      setBusy(false);
    }
  }

  async function saveHorse(input: Parameters<VirtualApi["update"]>[1]) {
    setBusy(true);
    setActionError("");
    try {
      const r = await client.update(horse.id, input);
      setData((d) => d && { ...d, horse: { ...d.horse, ...r.horse } });
      setEditing(false);
      setNotice("Saved.");
      onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Your changes couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    const ok = await confirm({
      title: `Unlink ${horse.name} from race data?`,
      message: "Its details and logged races stay, but they stop updating and there are no more race alerts for it.",
      confirmLabel: "Unlink",
    });
    if (!ok) return;
    setBusy(true);
    setActionError("");
    try {
      await client.unlink(horse.id);
      setNotice("Unlinked from race data.");
      setVersion((v) => v + 1);
      onChanged();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "This horse couldn't be unlinked.");
    } finally {
      setBusy(false);
    }
  }

  async function setAlerts(on: boolean) {
    setAlertsBusy(true);
    setActionError("");
    try {
      const r = await client.setAlerts(horse.id, on);
      setData((d) => (d && d.raceData ? { ...d, raceData: { ...d.raceData, alertsOn: r.alertsOn } } : d));
      setNotice(r.alertsOn ? "Race alerts on for you." : "Race alerts off for you.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Your alert setting couldn't be saved.");
    } finally {
      setAlertsBusy(false);
    }
  }

  const raceData = data.raceData ?? null;
  const linked = !!horse.formfav;
  const age = horse.foaledYear ? new Date().getFullYear() - horse.foaledYear : null;
  const facts = [horse.breed, horse.sex && cap(horse.sex), age !== null ? `${age} yrs (${horse.foaledYear})` : "", horse.color].filter(Boolean);
  const cover = community?.coverImageId;
  const sourceLink = horse.communityHorseId && community ? `/community/horses/${horse.communityHorseId}` : horse.racingHorseId && racing ? `/racing/horses/${horse.racingHorseId}` : null;

  return (
    <div className="vs-detail">
      <button type="button" className="vs-back" onClick={onBack}>{backLabel}</button>

      <header className="vs-detail-head">
        <span className="vs-avatar is-lg" aria-hidden="true">
          {cover ? <img src={horseImageUrl(cover)} alt="" /> : initials(horse.name)}
        </span>
        <div className="vs-detail-title">
          <span className={`vs-badge is-${horse.source}`}>{SOURCE_LABELS[horse.source]}</span>
          {horse.source === "manual" && horse.formfav && (
            <span className="vs-badge is-formfav">Linked: {horse.formfav.name}</span>
          )}
          <h2>{horse.name}</h2>
          <p>{facts.join(" · ") || "Details not added yet"}</p>
          <dl className="vs-facts">
            {horse.sire || horse.dam ? (<div><dt>Pedigree</dt><dd>{horse.sire || "?"} – {horse.dam || "?"}</dd></div>) : null}
            {horse.trainer && <div><dt>Trainer</dt><dd>{horse.trainer}</dd></div>}
            {horse.ownerName && <div><dt>Owner</dt><dd>{horse.ownerName}</dd></div>}
            {horse.location && <div><dt>Location</dt><dd>{horse.location}</dd></div>}
            {team && horse.addedByName && <div><dt>Added by</dt><dd>{horse.addedByName}</dd></div>}
          </dl>
        </div>
        <div className="vs-detail-actions">
          {sourceLink && <Link className="vs-btn" to={sourceLink}>View profile</Link>}
          {horse.source === "manual" && horse.canRemove && (
            <button type="button" className="vs-btn" onClick={() => setEditing(true)}>Edit details</button>
          )}
          {horse.source === "manual" && horse.canRemove && !linked && (
            <button type="button" className="vs-btn" onClick={() => setLinking(true)}>Link to a racing horse</button>
          )}
          {horse.source === "manual" && horse.canRemove && linked && (
            <button type="button" className="vs-btn" disabled={busy} onClick={() => void unlink()}>Unlink race data</button>
          )}
          {horse.canRemove && (
            <button type="button" className="vs-btn is-danger" disabled={busy} onClick={() => void removeHorse()}>Remove</button>
          )}
        </div>
      </header>

      {data.liveUnavailable && (
        <p className="vs-notice" role="status">
          {horse.source === "community"
            ? "This horse's live profile isn't available to you right now (the owner may have made it private or removed it). The details saved when it was added and all logged entries are still here."
            : "There's no published racing data for this horse yet. Logged entries are still here."}
        </p>
      )}
      {notice && <p className="vs-ok" role="status">{notice}</p>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      <nav className="vs-sections" aria-label={`${horse.name} sections`}>
        {SECTIONS.map((s) => {
          const n = s.key === "performance" ? 0 : byKind(SECTION_KIND[s.key]).length;
          return (
            <button key={s.key} type="button" className="vs-section-btn" aria-pressed={section === s.key} onClick={() => setSection(s.key)}>
              {s.label}
              {n > 0 && <span className="vs-count">{n}</span>}
            </button>
          );
        })}
      </nav>

      <div className="vs-section">
        {section === "performance" && (
          <>
            {raceData && (
              <Suspense fallback={loadingRaceData}>
                <RaceDataPanel data={raceData} runs={false} onRace={setRace} onAlerts={(on) => void setAlerts(on)} alertsBusy={alertsBusy} />
              </Suspense>
            )}
            <Performance community={community} racing={racing} entries={entries} />
          </>
        )}

        {section === "races" && (
          <>
            {community && <CommunityRecords horse={community} />}
            {raceData && (
              <Suspense fallback={loadingRaceData}>
                <RaceDataPanel data={raceData} onRace={setRace} onAlerts={(on) => void setAlerts(on)} alertsBusy={alertsBusy} />
              </Suspense>
            )}
            {racing && (
              <section className="vs-live">
                <h3>Official starts <small>from racing data</small></h3>
                <StartsTable starts={racing.starts} show="horse" />
                {!!racing.history?.length && <EarlierStarts history={racing.history} />}
              </section>
            )}
            <EntryList title={team ? "Team race log" : "Your race log"} kind="race" entries={byKind("race")} team={team} onAdd={() => setDialog({ kind: "race" })} onEdit={(e) => setDialog({ kind: e.kind, entry: e })} onRemove={removeEntry} />
          </>
        )}

        {section === "workouts" && (
          <>
            {racing && (
              <section className="vs-live">
                <h3>Published workouts <small>from racing data</small></h3>
                {racing.workouts.length ? <WorkoutTable workouts={racing.workouts} showHorse={false} /> : <p className="vs-muted">No published workouts yet.</p>}
              </section>
            )}
            <EntryList title={team ? "Team workout log" : "Your workout log"} kind="workout" entries={byKind("workout")} team={team} onAdd={() => setDialog({ kind: "workout" })} onEdit={(e) => setDialog({ kind: e.kind, entry: e })} onRemove={removeEntry} />
          </>
        )}

        {section === "sales" && (
          <>
            {community?.status === "for_sale" && (
              <p className="vs-notice">The owner has marked this horse <strong>for sale</strong> on Stayblz.</p>
            )}
            <EntryList title="Sales entries" kind="sale" entries={byKind("sale")} team={team} onAdd={() => setDialog({ kind: "sale" })} onEdit={(e) => setDialog({ kind: e.kind, entry: e })} onRemove={removeEntry} />
          </>
        )}

        {section === "notes" && (
          <>
            <HorseNotes key={horse.updatedAt} notes={horse.notes} onSave={(notes) => saveHorse({ notes })} busy={busy} team={team} />
            <EntryList title="Dated notes" kind="note" entries={byKind("note")} team={team} onAdd={() => setDialog({ kind: "note" })} onEdit={(e) => setDialog({ kind: e.kind, entry: e })} onRemove={removeEntry} />
          </>
        )}
      </div>

      {dialog && (
        <EntryDialog horseName={horse.name} kind={dialog.kind} entry={dialog.entry} onClose={() => setDialog(null)} onSave={saveEntry} />
      )}
      <Suspense fallback={null}>
        {linking && (
          <LinkRacingHorseDialog
            horseName={horse.name}
            note={`Its details and race log then update from race data, and ${team ? "everyone in the stable gets" : "you get"} alerts when it's entered, scratched or has run. ${LOCKED_BY_RACE_DATA}`}
            onClose={() => setLinking(false)}
            onPick={async (target) => {
              await client.link(horse.id, target);
              setLinking(false);
              setNotice(`Linked to ${target.name}.`);
              setVersion((v) => v + 1);
              onChanged();
            }}
          />
        )}
        {race && (
          <RaceDialog
            where={race}
            onClose={() => setRace(null)}
            onStats={(t) => {
              setRace(null);
              setStats(t);
            }}
          />
        )}
        {stats && <StatsDialog target={stats} onClose={() => setStats(null)} />}
      </Suspense>
      {editing && (
        <TopLayer>
          <Modal label={`Edit ${horse.name}`} className="gx-layer vs-dialog" onClose={() => setEditing(false)}>
            <DialogHead kicker="Virtual Stayblz" title="Edit details" onClose={() => setEditing(false)} />
            <ManualHorseForm initial={horse} busy={busy} submitLabel="Save" locked={linked} onSubmit={(input) => void saveHorse(input)} />
          </Modal>
        </TopLayer>
      )}
    </div>
  );
}

const PLURALS: Record<EntryKind, string> = { workout: "workouts", race: "races", sale: "sales entries", note: "dated notes" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sortEntries = (list: VirtualEntry[]) =>
  [...list].sort((a, b) => (a.entryDate === b.entryDate ? b.createdAt.localeCompare(a.createdAt) : b.entryDate.localeCompare(a.entryDate)));

function Performance({ community, racing, entries }: { community: HorseDetail | null; racing: RacingLive | null; entries: VirtualEntry[] }) {
  const races = entries.filter((e) => e.kind === "race" && e.finish);
  const logged = {
    starts: races.length,
    wins: races.filter((e) => e.finish === 1).length,
    places: races.filter((e) => e.finish === 2).length,
    shows: races.filter((e) => e.finish === 3).length,
    earnings: races.reduce((sum, e) => sum + (e.amountCents ?? 0), 0),
  };
  const lastSale = entries.find((e) => e.kind === "sale");
  const lastWork = entries.find((e) => e.kind === "workout");
  const recent = entries.slice(0, 5);
  return (
    <>
      {community && (
        <section className="vs-live">
          <h3>On Stayblz <small>kept up to date by the owner</small></h3>
          <dl className="vs-stats">
            <div><dt>Status</dt><dd>{STATUS_LABELS[community.status as HorseStatus] ?? community.status}</dd></div>
            <div><dt>Starts</dt><dd>{community.stats.starts}</dd></div>
            <div><dt>W-P-S</dt><dd>{community.stats.wins}-{community.stats.places}-{community.stats.shows}</dd></div>
            <div><dt>Win rate</dt><dd>{community.stats.starts ? `${Math.round((community.stats.wins / community.stats.starts) * 100)}%` : "—"}</dd></div>
            <div><dt>Earnings</dt><dd>{money(community.stats.earningsCents, true)}</dd></div>
          </dl>
        </section>
      )}
      {racing && (
        <section className="vs-live">
          <h3>Record in racing data</h3>
          <StatTiles stats={racing.stats} />
        </section>
      )}
      <section className="vs-block">
        <h3>From your log</h3>
        <dl className="vs-stats">
          <div><dt>Logged starts</dt><dd>{logged.starts}</dd></div>
          <div><dt>W-P-S</dt><dd>{logged.wins}-{logged.places}-{logged.shows}</dd></div>
          <div><dt>Logged earnings</dt><dd>{logged.earnings ? dollars(logged.earnings) : "—"}</dd></div>
          <div><dt>Last workout</dt><dd>{lastWork ? dayLabel(lastWork.entryDate) : "—"}</dd></div>
          <div><dt>Latest sale</dt><dd>{lastSale ? `${SALE_LABELS[lastSale.result as SaleResult] ?? lastSale.result}${lastSale.amountCents != null ? ` · ${dollars(lastSale.amountCents)}` : ""}` : "—"}</dd></div>
        </dl>
      </section>
      <section className="vs-block">
        <h3>Recent activity</h3>
        {recent.length ? (
          <ul className="vs-timeline">
            {recent.map((e) => (
              <li key={e.id}>
                <span className={`vs-kind is-${e.kind}`}>{KIND_LABELS[e.kind]}</span>
                <span>
                  <strong>{summary(e)}</strong>
                  <small>{dayLabel(e.entryDate)}{e.author ? ` · ${e.author.name}` : ""}</small>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="vs-muted">Nothing logged yet. Use the Races, Workouts, Sales entries or Notes tabs to start tracking.</p>
        )}
      </section>
    </>
  );
}

function CommunityRecords({ horse }: { horse: HorseDetail }) {
  return (
    <section className="vs-live">
      <h3>Race records <small>added by the owner</small></h3>
      {horse.records.length ? (
        <div className="table-wrap vs-table-wrap">
          <table className="data vs-table">
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Track</th><th scope="col">Race</th><th scope="col">Distance</th><th scope="col">Fin</th><th scope="col">Earned</th></tr>
            </thead>
            <tbody>
              {horse.records.map((r) => (
                <tr key={r.id}>
                  <td>{dayLabel(r.raceDate)}</td>
                  <td>{r.track}</td>
                  <td>{r.raceName || "—"}</td>
                  <td>{[r.distance, r.surface].filter(Boolean).join(" ") || "—"}</td>
                  <td>{r.finish ? `${ordinal(r.finish)}${r.fieldSize ? `/${r.fieldSize}` : ""}` : "—"}</td>
                  <td>{money(r.earningsCents, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="vs-muted">The owner hasn't added race records yet.</p>
      )}
    </section>
  );
}

function summary(e: VirtualEntry) {
  if (e.kind === "race")
    return [e.title || "Race", e.track, e.finish ? `${ordinal(e.finish)}${e.fieldSize ? ` of ${e.fieldSize}` : ""}` : ""].filter(Boolean).join(" · ");
  if (e.kind === "workout") return [e.track || "Workout", e.distance, e.timeText, e.result].filter(Boolean).join(" · ");
  if (e.kind === "sale")
    return [e.title, e.hipNumber && `Hip ${e.hipNumber}`, SALE_LABELS[e.result as SaleResult] ?? e.result, e.amountCents != null ? dollars(e.amountCents) : ""]
      .filter(Boolean)
      .join(" · ");
  return e.title || e.notes.slice(0, 80);
}

function EntryList({
  title,
  kind,
  entries,
  team,
  onAdd,
  onEdit,
  onRemove,
}: {
  title: string;
  kind: EntryKind;
  entries: VirtualEntry[];
  team: boolean;
  onAdd: () => void;
  onEdit: (e: VirtualEntry) => void;
  onRemove: (e: VirtualEntry) => void;
}) {
  return (
    <section className="vs-block">
      <div className="vs-block-head">
        <h3>{title}</h3>
        <button type="button" className="vs-btn vs-btn-primary" onClick={onAdd}>+ Log {KIND_LABELS[kind].toLowerCase()}</button>
      </div>
      {entries.length ? (
        <ul className="vs-entries">
          {entries.map((e) => (
            <li key={e.id} className="vs-entry">
              <div className="vs-entry-main">
                <span className="vs-entry-date">{dayLabel(e.entryDate)}</span>
                <strong>{summary(e)}</strong>
                {e.fromRaceData && <span className="vs-badge is-formfav">Race data</span>}
                {kind === "race" && (e.distance || e.surface || e.amountCents != null) && (
                  <small>{[e.distance, e.surface, e.amountCents != null ? `Earned ${dollars(e.amountCents)}` : ""].filter(Boolean).join(" · ")}</small>
                )}
                {kind === "workout" && e.surface && <small>{e.surface}{e.title ? ` · ${e.title}` : ""}</small>}
                {kind === "sale" && e.track && <small>{e.track}</small>}
                {e.notes && (kind !== "note" || e.title) && <p>{e.notes}</p>}
                {team && e.author && <small className="vs-author">Logged by {e.author.name}</small>}
              </div>
              {e.canEdit && (
                <div className="vs-entry-actions">
                  <button type="button" className="vs-link" onClick={() => onEdit(e)} aria-label={`Edit ${summary(e)}`}>Edit</button>
                  {(e.canRemove ?? e.canEdit) && (
                    <button type="button" className="vs-link is-danger" onClick={() => onRemove(e)} aria-label={`Remove ${summary(e)}`}>Remove</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="vs-muted">No {PLURALS[kind]} logged yet.</p>
      )}
    </section>
  );
}

function HorseNotes({ notes, onSave, busy, team }: { notes: string; onSave: (notes: string) => void; busy: boolean; team: boolean }) {
  const [text, setText] = useState(notes);
  return (
    <section className="vs-block">
      <h3>{team ? "Team notes" : "Your notes"}</h3>
      <label className="vs-field">
        <span className="vs-sr">Notes about this horse</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} rows={4} placeholder="Why you're watching this horse, what to look out for…" />
      </label>
      <div className="vs-form-actions">
        <button type="button" className="vs-btn vs-btn-primary" disabled={busy || text === notes} onClick={() => onSave(text)}>
          {busy ? "Saving…" : "Save notes"}
        </button>
      </div>
    </section>
  );
}
