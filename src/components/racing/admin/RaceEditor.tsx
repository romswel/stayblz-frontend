import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "../../../api";
import LookupField, { type Picked } from "./LookupField";
import { conditionLabels, raceTypeLabels, raceTitle, surfaceLabels } from "../format";
import type { Payout, Race, RaceDay, Runner } from "../types";
import { useConfirm } from "../../ui/Confirm";

type Save = (request: () => Promise<{ day: RaceDay | null }>, done: string) => Promise<boolean>;

export type RaceForm = {
  number: string;
  postTime: string;
  name: string;
  type: string;
  grade: string;
  distance: string;
  unit: string;
  surface: string;
  purse: string;
  currency: string;
  conditions: string;
};
export const raceForm = (race?: Race, nextNumber = 1): RaceForm => ({
  number: String(race?.number ?? nextNumber),
  postTime: race?.postTime ?? "",
  name: race?.name ?? "",
  type: race?.type ?? "maiden",
  grade: race?.grade ? String(race.grade) : "",
  distance: race?.distanceValue != null ? String(race.distanceValue) : "",
  unit: race?.distanceUnit ?? "furlongs",
  surface: race?.surface ?? "dirt",
  purse: race?.purse != null ? String(race.purse) : "",
  currency: race?.currency ?? "USD",
  conditions: race?.conditions ?? "",
});

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "rca-wide" : undefined}>
      {label}
      {children}
    </label>
  );
}

export function RaceFields({ value, onChange }: { value: RaceForm; onChange: (value: RaceForm) => void }) {
  const set = (key: keyof RaceForm) => (e: { target: { value: string } }) => onChange({ ...value, [key]: e.target.value });
  return (
    <div className="rca-grid">
      <Field label="Race number">
        <input inputMode="numeric" value={value.number} onChange={set("number")} required />
      </Field>
      <Field label="Post time (24h)">
        <input placeholder="13:05" value={value.postTime} onChange={set("postTime")} />
      </Field>
      <Field label="Race name">
        <input value={value.name} maxLength={100} onChange={set("name")} />
      </Field>
      <Field label="Type">
        <select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value, grade: e.target.value === "stakes" ? value.grade : "" })}>
          {Object.entries(raceTypeLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      {value.type === "stakes" && (
        <Field label="Grade">
          <select value={value.grade} onChange={set("grade")}>
            <option value="">Ungraded</option>
            <option value="1">Grade 1</option>
            <option value="2">Grade 2</option>
            <option value="3">Grade 3</option>
          </select>
        </Field>
      )}
      <Field label="Distance">
        <input placeholder="6 or 1 1/16" value={value.distance} onChange={set("distance")} />
      </Field>
      <Field label="Unit">
        <select value={value.unit} onChange={set("unit")}>
          <option value="furlongs">Furlongs</option>
          <option value="miles">Miles</option>
          <option value="yards">Yards</option>
          <option value="meters">Meters</option>
        </select>
      </Field>
      <Field label="Surface">
        <select value={value.surface} onChange={set("surface")}>
          {Object.entries(surfaceLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Purse">
        <input inputMode="numeric" placeholder="50000" value={value.purse} onChange={set("purse")} />
      </Field>
      <Field label="Currency">
        <input maxLength={3} value={value.currency} onChange={(e) => onChange({ ...value, currency: e.target.value.toUpperCase() })} />
      </Field>
      <Field label="Conditions" wide>
        <textarea rows={2} maxLength={500} value={value.conditions} onChange={set("conditions")} />
      </Field>
    </div>
  );
}

type RunnerForm = {
  program: string;
  post: string;
  horse: Picked;
  jockey: Picked;
  trainer: Picked;
  owner: Picked;
  weight: string;
  morningLine: string;
  medication: string;
  equipment: string;
  scratched: boolean;
  scratchReason: string;
};
const runnerForm = (runner?: Runner, nextProgram = ""): RunnerForm => ({
  program: runner?.program ?? nextProgram,
  post: runner?.post != null ? String(runner.post) : nextProgram,
  horse: runner ? { id: runner.horse.id, name: runner.horse.name } : null,
  jockey: runner?.jockey ? { id: runner.jockey.id, name: runner.jockey.name } : null,
  trainer: runner?.trainer ? { id: runner.trainer.id, name: runner.trainer.name } : null,
  owner: runner?.owner ? { id: runner.owner.id, name: runner.owner.name } : null,
  weight: runner?.weight != null ? String(runner.weight) : "",
  morningLine: runner?.morningLine ?? "",
  medication: runner?.medication ?? "",
  equipment: runner?.equipment ?? "",
  scratched: runner?.scratched ?? false,
  scratchReason: runner?.scratchReason ?? "",
});
const runnerBody = (f: RunnerForm) => ({
  program: f.program,
  post: f.post,
  horseId: f.horse?.id ?? "",
  jockeyId: f.jockey?.id ?? null,
  trainerId: f.trainer?.id ?? null,
  ownerId: f.owner?.id ?? null,
  weight: f.weight,
  morningLine: f.morningLine,
  medication: f.medication,
  equipment: f.equipment,
  scratched: f.scratched,
  scratchReason: f.scratchReason,
});

function RunnerFields({ value, onChange, harness }: { value: RunnerForm; onChange: (value: RunnerForm) => void; harness: boolean }) {
  const set = (key: keyof RunnerForm) => (e: { target: { value: string } }) => onChange({ ...value, [key]: e.target.value });
  return (
    <div className="rca-grid">
      <Field label="Program #">
        <input value={value.program} maxLength={3} onChange={set("program")} />
      </Field>
      <Field label="Post">
        <input inputMode="numeric" value={value.post} onChange={set("post")} />
      </Field>
      <LookupField kind="horse" label="Horse" required value={value.horse} onChange={(horse) => onChange({ ...value, horse })} />
      <LookupField
        kind={harness ? "driver" : "jockey"}
        label={harness ? "Driver" : "Jockey"}
        value={value.jockey}
        onChange={(jockey) => onChange({ ...value, jockey })}
      />
      <LookupField kind="trainer" label="Trainer" value={value.trainer} onChange={(trainer) => onChange({ ...value, trainer })} />
      <LookupField kind="owner" label="Owner" value={value.owner} onChange={(owner) => onChange({ ...value, owner })} />
      <Field label="Weight (lb)">
        <input inputMode="numeric" value={value.weight} onChange={set("weight")} />
      </Field>
      <Field label="Morning line">
        <input placeholder="5-2" value={value.morningLine} onChange={set("morningLine")} />
      </Field>
      <Field label="Medication">
        <input maxLength={10} placeholder="L" value={value.medication} onChange={set("medication")} />
      </Field>
      <Field label="Equipment">
        <input maxLength={20} placeholder="b" value={value.equipment} onChange={set("equipment")} />
      </Field>
      <label className="acct-toggle rca-check">
        <input type="checkbox" checked={value.scratched} onChange={(e) => onChange({ ...value, scratched: e.target.checked })} />
        <span>Scratched</span>
      </label>
      {value.scratched && (
        <Field label="Scratch reason">
          <input maxLength={80} value={value.scratchReason} onChange={set("scratchReason")} />
        </Field>
      )}
    </div>
  );
}

type ResultLine = { id: string; finish: string; lengths: string; odds: string; earnings: string; comment: string };
function ResultsForm({ race, save }: { race: Race; save: Save }) {
  const runners = (race.runners ?? []).filter((r) => !r.scratched);
  const [status, setStatus] = useState<Race["status"]>(race.status === "scheduled" ? "official" : race.status);
  const [winningTime, setWinningTime] = useState(race.winningTime);
  const [condition, setCondition] = useState(race.condition);
  const [footnotes, setFootnotes] = useState(race.footnotes);
  const [payouts, setPayouts] = useState<{ pool: string; combination: string; amount: string }[]>(
    race.payouts.length ? race.payouts.map((p: Payout) => ({ ...p, amount: String(p.amount) })) : [{ pool: "Win", combination: "", amount: "" }],
  );
  const [lines, setLines] = useState<ResultLine[]>(() =>
    runners.map((r) => ({
      id: r.id,
      finish: r.finish != null ? String(r.finish) : "",
      lengths: r.lengths != null ? String(r.lengths) : "",
      odds: r.odds != null ? String(r.odds) : "",
      earnings: r.earnings != null ? String(r.earnings) : "",
      comment: r.comment ?? "",
    })),
  );
  const setLine = (index: number, patch: Partial<ResultLine>) => setLines((all) => all.map((line, n) => (n === index ? { ...line, ...patch } : line)));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void save(
      () =>
        api.put<{ day: RaceDay }>(`/api/admin/racing/races/${race.id}/results`, {
          status,
          winningTime,
          condition,
          footnotes,
          payouts: payouts.filter((p) => p.pool.trim() && p.amount.trim()),
          runners: lines,
        }),
      status === "official" ? "Results saved. The race is official." : "Results saved.",
    );
  };
  if (!runners.length) return <p className="rc-muted">Add runners before entering results.</p>;
  return (
    <form className="rca-results" onSubmit={submit} noValidate>
      <div className="table-wrap">
        <table className="data rca-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Horse</th>
              <th scope="col">Finish</th>
              <th scope="col">Beaten lengths</th>
              <th scope="col">Odds (to 1)</th>
              <th scope="col">Earnings</th>
              <th scope="col">Comment</th>
            </tr>
          </thead>
          <tbody>
            {runners.map((runner, index) => (
              <tr key={runner.id}>
                <td>{runner.program}</td>
                <td>{runner.horse.name}</td>
                <td>
                  <input aria-label={`Finish for ${runner.horse.name}`} inputMode="numeric" value={lines[index]?.finish ?? ""} onChange={(e) => setLine(index, { finish: e.target.value })} />
                </td>
                <td>
                  <input aria-label={`Beaten lengths for ${runner.horse.name}`} inputMode="decimal" value={lines[index]?.lengths ?? ""} onChange={(e) => setLine(index, { lengths: e.target.value })} />
                </td>
                <td>
                  <input aria-label={`Odds for ${runner.horse.name}`} inputMode="decimal" value={lines[index]?.odds ?? ""} onChange={(e) => setLine(index, { odds: e.target.value })} />
                </td>
                <td>
                  <input aria-label={`Earnings for ${runner.horse.name}`} inputMode="numeric" value={lines[index]?.earnings ?? ""} onChange={(e) => setLine(index, { earnings: e.target.value })} />
                </td>
                <td>
                  <input aria-label={`Comment for ${runner.horse.name}`} maxLength={200} value={lines[index]?.comment ?? ""} onChange={(e) => setLine(index, { comment: e.target.value })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rca-grid">
        <Field label="Race status">
          <select value={status} onChange={(e) => setStatus(e.target.value as Race["status"])}>
            <option value="official">Official</option>
            <option value="scheduled">Not official yet</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Winning time">
          <input placeholder="1:10.45" value={winningTime} maxLength={20} onChange={(e) => setWinningTime(e.target.value)} />
        </Field>
        <Field label="Track condition">
          <select value={condition} onChange={(e) => setCondition(e.target.value)}>
            {Object.entries(conditionLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <fieldset className="rca-payouts">
        <legend>Payouts</legend>
        {payouts.map((line, index) => (
          <div key={index} className="rca-payout">
            <input aria-label={`Pool ${index + 1}`} placeholder="Win / Exacta" value={line.pool} onChange={(e) => setPayouts((all) => all.map((p, n) => (n === index ? { ...p, pool: e.target.value } : p)))} />
            <input aria-label={`Combination ${index + 1}`} placeholder="4-7" value={line.combination} onChange={(e) => setPayouts((all) => all.map((p, n) => (n === index ? { ...p, combination: e.target.value } : p)))} />
            <input aria-label={`Amount ${index + 1}`} inputMode="decimal" placeholder="10.40" value={line.amount} onChange={(e) => setPayouts((all) => all.map((p, n) => (n === index ? { ...p, amount: e.target.value } : p)))} />
            <button type="button" className="btn btn-quiet" aria-label={`Remove payout ${index + 1}`} onClick={() => setPayouts((all) => all.filter((_, n) => n !== index))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-quiet" onClick={() => setPayouts((all) => [...all, { pool: "", combination: "", amount: "" }])}>
          Add payout
        </button>
      </fieldset>
      <Field label="Chart footnotes" wide>
        <textarea rows={2} maxLength={2000} value={footnotes} onChange={(e) => setFootnotes(e.target.value)} />
      </Field>
      <button className="btn btn-primary">Save results</button>
    </form>
  );
}

/** Everything for one race in the publishing tool. */
export default function RaceEditor({ race, harness, save }: { race: Race; harness: boolean; save: Save }) {
  const confirm = useConfirm();
  const [tab, setTab] = useState<"runners" | "details" | "results">("runners");
  const [details, setDetails] = useState(() => raceForm(race));
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RunnerForm>(() => runnerForm());
  const runners = race.runners ?? [];
  const nextProgram = String(runners.reduce((max, r) => Math.max(max, parseInt(r.program, 10) || 0), 0) + 1);
  const [adding, setAdding] = useState<RunnerForm>(() => runnerForm(undefined, nextProgram));
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <section className={`panel rca-race status-${race.status}`} aria-label={raceTitle(race)}>
      <header className="rca-race-head">
        <h3>
          {raceTitle(race)}
          <span className={`rc-status rc-status-${race.status}`}>
            {race.status === "official" ? "Official" : race.status === "cancelled" ? "Cancelled" : "Entries"}
          </span>
        </h3>
        <div className="up-chips" role="group" aria-label={`Race ${race.number} sections`}>
          {(["runners", "details", "results"] as const).map((key) => (
            <button key={key} type="button" className="up-chip" aria-pressed={tab === key} onClick={() => setTab(key)}>
              {key === "runners" ? `Runners (${runners.length})` : key === "details" ? "Race details" : "Results"}
            </button>
          ))}
        </div>
      </header>

      {tab === "details" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(() => api.put<{ day: RaceDay }>(`/api/admin/racing/races/${race.id}`, details), `Race ${details.number} saved.`);
          }}
          noValidate
        >
          <RaceFields value={details} onChange={setDetails} />
          <div className="rca-actions">
            <button className="btn btn-primary">Save race</button>
            {!confirmDelete ? (
              <button type="button" className="btn btn-quiet up-danger" onClick={() => setConfirmDelete(true)}>
                Delete race
              </button>
            ) : (
              <span className="up-confirm">
                Delete race {race.number} and its {runners.length} runners?
                <button
                  type="button"
                  className="btn btn-quiet up-danger"
                  onClick={() => void save(() => api.delete<{ day: RaceDay }>(`/api/admin/racing/races/${race.id}`), "Race deleted.")}
                >
                  Yes, delete
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </span>
            )}
          </div>
        </form>
      )}

      {tab === "runners" && (
        <>
          {runners.length > 0 && (
            <div className="table-wrap">
              <table className="data rca-table">
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">PP</th>
                    <th scope="col">Horse</th>
                    <th scope="col">{harness ? "Driver" : "Jockey"}</th>
                    <th scope="col">Trainer</th>
                    <th scope="col">M/L</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runners.map((runner) => (
                    <tr key={runner.id} className={runner.scratched ? "is-scratched" : undefined}>
                      <td>{runner.program}</td>
                      <td>{runner.post ?? "—"}</td>
                      <td>
                        {runner.horse.name}
                        {runner.scratched && <small className="rc-scratch"> Scratched</small>}
                      </td>
                      <td>{runner.jockey?.name ?? "—"}</td>
                      <td>{runner.trainer?.name ?? "—"}</td>
                      <td>{runner.morningLine || "—"}</td>
                      <td className="rca-row-actions">
                        <button
                          type="button"
                          className="btn btn-quiet"
                          onClick={() => {
                            setEditing(runner.id);
                            setEditForm(runnerForm(runner));
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-quiet up-danger"
                          aria-label={`Remove ${runner.horse.name}`}
                          onClick={async () => {
                            const sure = await confirm({
                              title: `Remove ${runner.horse.name}?`,
                              message: "The runner is taken off this race. To keep them listed as a non-runner, scratch them instead.",
                              confirmLabel: "Remove runner",
                              tone: "danger",
                            });
                            if (sure) void save(() => api.delete<{ day: RaceDay }>(`/api/admin/racing/runners/${runner.id}`), `${runner.horse.name} removed.`);
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {editing && (
            <form
              className="rca-subform"
              aria-label="Edit runner"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await save(() => api.put<{ day: RaceDay }>(`/api/admin/racing/runners/${editing}`, runnerBody(editForm)), "Runner saved."))
                  setEditing(null);
              }}
              noValidate
            >
              <h4>Edit runner</h4>
              <RunnerFields value={editForm} onChange={setEditForm} harness={harness} />
              <div className="rca-actions">
                <button className="btn btn-primary">Save runner</button>
                <button type="button" className="btn btn-quiet" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          <form
            className="rca-subform"
            aria-label={`Add a runner to race ${race.number}`}
            onSubmit={async (e) => {
              e.preventDefault();
              if (await save(() => api.post<{ day: RaceDay }>(`/api/admin/racing/races/${race.id}/runners`, runnerBody(adding)), "Runner added.")) {
                const next = String((parseInt(adding.program, 10) || 0) + 1);
                setAdding(runnerForm(undefined, next));
              }
            }}
            noValidate
          >
            <h4>Add a runner</h4>
            <RunnerFields value={adding} onChange={setAdding} harness={harness} />
            <button className="btn btn-primary">Add runner</button>
          </form>
        </>
      )}

      {tab === "results" && <ResultsForm key={race.id + race.status + runners.length} race={race} save={save} />}
    </section>
  );
}
