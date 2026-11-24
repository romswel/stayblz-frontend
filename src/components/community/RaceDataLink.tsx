import { lazy, Suspense, useState } from "react";
import { useConfirm } from "../ui/Confirm";

// Race-data search (Stayblz Data's FormFav code) loads only when the dialog opens.
const LinkRacingHorseDialog = lazy(() => import("../virtual/LinkRacingHorseDialog"));
import { community, type HorseDetail } from "./api";

const CODE_LABEL = { gallops: "Thoroughbreds", harness: "Harness" } as const;

/**
 * A horse profile's race-data card. Owner: link the horse to the racing horse it is (US/Canada race cards; one owner
 * per racing horse), turn its alerts on/off, unlink. Others: who linked it, so it reads as the owner's claim, not a
 * verified one.
 */
export default function RaceDataLink({ horse, onChange }: { horse: HorseDetail; onChange: (h: HorseDetail) => void }) {
  const confirm = useConfirm();
  const [linking, setLinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const link = horse.raceData ?? null;
  if (!horse.mine && !link) return null;

  async function unlink() {
    const ok = await confirm({
      title: `Unlink ${horse.name} from race data?`,
      message: "Its details and race records stay, but they stop updating and there are no more race alerts.",
      confirmLabel: "Unlink",
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const r = await community.unlinkRaceData(horse.id);
      onChange(r.horse);
      setNotice("Unlinked from race data.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "This horse couldn't be unlinked.");
    } finally {
      setBusy(false);
    }
  }

  async function alerts(on: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = await community.setRaceAlerts(horse.id, on);
      onChange({ ...horse, raceData: link && { ...link, alertsOn: r.alertsOn } });
      setNotice(r.alertsOn ? "Race alerts on." : "Race alerts off.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your alert setting couldn't be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="cm-card gx-glass cm-race-data" aria-labelledby="cm-race-data">
      <div className="cm-card-head">
        <h2 id="cm-race-data">Race data</h2>
        {link && <small className="cm-muted">Data: FormFav</small>}
      </div>
      {!link ? (
        <>
          <p className="cm-muted">
            Is {horse.name} racing in the US or Canada? Link it to its race-data horse: its details and race records then update
            from the race cards, and you get alerts when it's entered, scratched or has run.
          </p>
          <button type="button" className="cm-btn cm-btn-primary" onClick={() => setLinking(true)}>
            Link to a racing horse
          </button>
        </>
      ) : (
        <>
          <p>
            {horse.mine ? "Linked to " : "Race data linked by the owner: "}
            <strong>{link.name}</strong> · {CODE_LABEL[link.code] ?? link.code}
          </p>
          {horse.mine && (
            <>
              <p className="cm-muted">
                Breed, year foaled, sex, sire, dam and trainer update from race data, and each result is added to the performance
                history. Updates about every 30 minutes.
              </p>
              <label className="cm-check">
                <input type="checkbox" checked={link.alertsOn !== false} disabled={busy} onChange={(e) => void alerts(e.target.checked)} />
                <span>Alert me when it's entered, scratched, changes jockey or trainer, or has run</span>
              </label>
              <button type="button" className="cm-btn" disabled={busy} onClick={() => void unlink()}>
                Unlink race data
              </button>
            </>
          )}
        </>
      )}
      {notice && (
        <p className="cm-muted" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="cm-error" role="alert">
          {error}
        </p>
      )}
      <Suspense fallback={null}>
        {linking && (
          <LinkRacingHorseDialog
            horseName={horse.name}
            note="Pick the racing horse this is. Each racing horse can be linked by one owner only. Breed, year foaled, sex, sire, dam and trainer then come from race data."
            onClose={() => setLinking(false)}
            onPick={async (target) => {
              const r = await community.linkRaceData(horse.id, target);
              setLinking(false);
              onChange(r.horse);
              setNotice(`Linked to ${target.name}.`);
            }}
          />
        )}
      </Suspense>
    </section>
  );
}
