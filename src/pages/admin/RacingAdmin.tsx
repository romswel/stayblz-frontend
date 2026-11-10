import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api";
import LookupField, { type Picked } from "../../components/racing/admin/LookupField";
import { breedLabels, dateLabel, shiftDate, surfaceLabels, todayISO } from "../../components/racing/format";
import type { RaceDay, Track, Workout } from "../../components/racing/types";
import "../../components/racing/racing.css";
import "../../components/updates/updates.css";

type DayRow = { id: string; date: string; status: "draft" | "published"; track: Track; races: number; official: number; runners: number };

function useList<T>(path: string) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: "", loading: true });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: "" }));
    api
      .get<T>(path, { signal: controller.signal })
      .then((data) => !controller.signal.aborted && setState({ data, error: "", loading: false }))
      .catch((reason) => !controller.signal.aborted && setState((s) => ({ ...s, loading: false, error: reason instanceof Error ? reason.message : "This list could not be loaded." })));
    return () => controller.abort();
  }, [path, attempt]);
  return { ...state, reload: useCallback(() => setAttempt((n) => n + 1), []) };
}

function ErrorLine({ error, retry }: { error: string; retry?: () => void }) {
  if (!error) return null;
  return (
    <p className="form-error" role="alert">
      {error}{" "}
      {retry && (
        <button type="button" className="btn btn-quiet" onClick={retry}>
          Try again
        </button>
      )}
    </p>
  );
}

function DaysTab({ tracks }: { tracks: Track[] }) {
  const navigate = useNavigate();
  const [from, setFrom] = useState(shiftDate(todayISO(), -30));
  const [to, setTo] = useState(shiftDate(todayISO(), 60));
  const days = useList<{ days: DayRow[] }>(`/api/admin/racing/days?from=${from}&to=${to}`);
  const [trackId, setTrackId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = await api.post<{ day: RaceDay }>("/api/admin/racing/days", { trackId, date });
      navigate(`/admin/racing/days/${body.day.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The race day could not be created.");
      setBusy(false);
    }
  }
  return (
    <div className="rca-layout">
      <section aria-labelledby="days-title">
        <div className="rca-list-head">
          <h2 id="days-title">Race days</h2>
          <label>
            From
            <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </label>
        </div>
        <ErrorLine error={days.error} retry={days.reload} />
        {days.loading && !days.data && <p role="status">Loading race days…</p>}
        {days.data && !(days.data.days ?? []).length && (
          <div className="up-empty">
            <h2>No race days in these dates</h2>
            <p>Create one to start a card.</p>
          </div>
        )}
        <ul className="up-admin-list">
          {(days.data?.days ?? []).map((day) => (
            <li key={day.id} className={`up-admin-row status-${day.status}`}>
              <div className="up-admin-main">
                <span className={`up-status status-${day.status}`}>{day.status === "published" ? "Published" : "Draft"}</span>
                <Link className="up-admin-title" to={`/admin/racing/days/${day.id}`}>
                  {day.track.name} · {dateLabel(day.date, "short")}
                </Link>
                <small>
                  {day.races} races · {day.runners} runners · {day.official} official
                </small>
              </div>
              <div className="up-admin-actions">
                {day.status === "published" && (
                  <Link className="btn btn-quiet" to={`/racing/days/${day.id}`}>
                    View
                  </Link>
                )}
                <Link className="btn btn-quiet" to={`/admin/racing/days/${day.id}`}>
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <aside className="rca-side">
        <form className="panel rca-panel" onSubmit={create} aria-labelledby="new-day-title" noValidate>
          <h2 id="new-day-title">New race day</h2>
          {tracks.length === 0 ? (
            <p className="rc-muted">Add a track first (Tracks tab).</p>
          ) : (
            <>
              <label>
                Track
                <select value={trackId} onChange={(e) => setTrackId(e.target.value)} required>
                  <option value="">Choose a track</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <ErrorLine error={error} />
              <button className="btn btn-primary" disabled={busy || !trackId || !date}>
                {busy ? "Creating…" : "Create and open"}
              </button>
            </>
          )}
        </form>
      </aside>
    </div>
  );
}

const emptyTrack = { id: "", code: "", name: "", country: "", region: "", breed: "thoroughbred" };
function TracksTab({ tracks, reload }: { tracks: Track[]; reload: () => void }) {
  const [form, setForm] = useState(emptyTrack);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const { id, ...body } = form;
      if (id) await api.put(`/api/admin/racing/tracks/${id}`, body);
      else await api.post("/api/admin/racing/tracks", body);
      setNotice(id ? "Track saved." : "Track added.");
      setForm(emptyTrack);
      reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The track could not be saved.");
    }
  }
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  return (
    <div className="rca-layout">
      <section aria-labelledby="tracks-title">
        <h2 id="tracks-title">Tracks</h2>
        {!tracks.length ? (
          <div className="up-empty">
            <h2>No tracks yet</h2>
            <p>Add the tracks you'll publish cards for.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data rca-table">
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Name</th>
                  <th scope="col">Country</th>
                  <th scope="col">Region</th>
                  <th scope="col">Racing</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((t) => (
                  <tr key={t.id}>
                    <td>{t.code}</td>
                    <td>{t.name}</td>
                    <td>{t.country || "—"}</td>
                    <td>{t.region || "—"}</td>
                    <td>{breedLabels[t.breed]}</td>
                    <td>
                      <button type="button" className="btn btn-quiet" onClick={() => setForm({ ...t })}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <aside className="rca-side">
        <form className="panel rca-panel" onSubmit={submit} aria-labelledby="track-form-title" noValidate>
          <h2 id="track-form-title">{form.id ? "Edit track" : "Add a track"}</h2>
          <label>
            Code
            <input value={form.code} maxLength={6} placeholder="SA" onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </label>
          <label>
            Name
            <input value={form.name} maxLength={80} onChange={set("name")} />
          </label>
          <label>
            Country (2 letters)
            <input value={form.country} maxLength={2} placeholder="US" onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })} />
          </label>
          <label>
            Region
            <input value={form.region} maxLength={60} onChange={set("region")} />
          </label>
          <label>
            Racing
            <select value={form.breed} onChange={set("breed")}>
              {Object.entries(breedLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <ErrorLine error={error} />
          {notice && <p role="status">{notice}</p>}
          <div className="rca-actions">
            <button className="btn btn-primary">{form.id ? "Save track" : "Add track"}</button>
            {form.id && (
              <button type="button" className="btn btn-quiet" onClick={() => setForm(emptyTrack)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
}

type WorkForm = { id: string; horse: Picked; trackId: string; date: string; distance: string; unit: string; surface: string; time: string; rank: string; rankOf: string; note: string; status: "draft" | "published" };
const emptyWork = (): WorkForm => ({ id: "", horse: null, trackId: "", date: todayISO(), distance: "", unit: "furlongs", surface: "dirt", time: "", rank: "", rankOf: "", note: "", status: "published" });
function WorkoutsTab({ tracks }: { tracks: Track[] }) {
  const list = useList<{ workouts: Workout[] }>(`/api/admin/racing/workouts?from=${shiftDate(todayISO(), -30)}&to=${todayISO()}`);
  const [form, setForm] = useState<WorkForm>(emptyWork);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    const { id, horse, ...rest } = form;
    try {
      const body = { ...rest, horseId: horse?.id ?? "" };
      if (id) await api.put(`/api/admin/racing/workouts/${id}`, body);
      else await api.post("/api/admin/racing/workouts", body);
      setNotice(form.status === "published" ? "Workout published." : "Workout saved as a draft.");
      setForm({ ...emptyWork(), trackId: form.trackId, date: form.date });
      list.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The workout could not be saved.");
    }
  }
  const set = (key: keyof WorkForm) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  return (
    <div className="rca-layout">
      <section aria-labelledby="works-title">
        <h2 id="works-title">Workouts (last 30 days)</h2>
        <ErrorLine error={list.error} retry={list.reload} />
        {list.data && !(list.data.workouts ?? []).length && (
          <div className="up-empty">
            <h2>No workouts yet</h2>
          </div>
        )}
        {(list.data?.workouts?.length ?? 0) > 0 && (
          <div className="table-wrap">
            <table className="data rca-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Horse</th>
                  <th scope="col">Track</th>
                  <th scope="col">Dist</th>
                  <th scope="col">Time</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data!.workouts.map((w) => (
                  <tr key={w.id}>
                    <td>{dateLabel(w.date, "short")}</td>
                    <td>{w.horse.name}</td>
                    <td>{w.track.code}</td>
                    <td>{w.distance}</td>
                    <td>{w.time}</td>
                    <td>
                      <span className={`up-status status-${w.status}`}>{w.status === "published" ? "Published" : "Draft"}</span>
                    </td>
                    <td className="rca-row-actions">
                      <button
                        type="button"
                        className="btn btn-quiet"
                        onClick={() =>
                          setForm({
                            id: w.id,
                            horse: w.horse,
                            trackId: w.track.id,
                            date: w.date,
                            distance: String(w.distanceValue),
                            unit: w.distanceUnit,
                            surface: w.surface,
                            time: w.time,
                            rank: w.rank ? String(w.rank) : "",
                            rankOf: w.rankOf ? String(w.rankOf) : "",
                            note: w.note,
                            status: w.status ?? "draft",
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-quiet up-danger"
                        aria-label={`Delete workout for ${w.horse.name}`}
                        onClick={async () => {
                          try {
                            await api.delete(`/api/admin/racing/workouts/${w.id}`);
                            list.reload();
                          } catch (reason) {
                            setError(reason instanceof Error ? reason.message : "The workout could not be deleted.");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <aside className="rca-side">
        <form className="panel rca-panel" onSubmit={submit} aria-labelledby="work-form-title" noValidate>
          <h2 id="work-form-title">{form.id ? "Edit workout" : "Add a workout"}</h2>
          <LookupField kind="horse" label="Horse" required value={form.horse} onChange={(horse) => setForm({ ...form, horse })} />
          <label>
            Track
            <select value={form.trackId} onChange={set("trackId")}>
              <option value="">Choose a track</option>
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date
            <input type="date" value={form.date} onChange={set("date")} />
          </label>
          <div className="rca-grid">
            <label>
              Distance
              <input value={form.distance} placeholder="4" onChange={set("distance")} />
            </label>
            <label>
              Unit
              <select value={form.unit} onChange={set("unit")}>
                <option value="furlongs">Furlongs</option>
                <option value="miles">Miles</option>
                <option value="yards">Yards</option>
                <option value="meters">Meters</option>
              </select>
            </label>
            <label>
              Surface
              <select value={form.surface} onChange={set("surface")}>
                {Object.entries(surfaceLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Time
              <input value={form.time} placeholder="48.20" onChange={set("time")} />
            </label>
            <label>
              Rank
              <input inputMode="numeric" value={form.rank} onChange={set("rank")} />
            </label>
            <label>
              Of
              <input inputMode="numeric" value={form.rankOf} onChange={set("rankOf")} />
            </label>
            <label>
              Note
              <input value={form.note} maxLength={20} placeholder="B, H, g" onChange={set("note")} />
            </label>
            <label>
              Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as WorkForm["status"] })}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>
          <ErrorLine error={error} />
          {notice && <p role="status">{notice}</p>}
          <div className="rca-actions">
            <button className="btn btn-primary">{form.id ? "Save workout" : "Add workout"}</button>
            {form.id && (
              <button type="button" className="btn btn-quiet" onClick={() => setForm(emptyWork())}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </aside>
    </div>
  );
}

/** Publishing tool home: race days, tracks and workouts. Admins only (the API checks again). */
export default function RacingAdmin() {
  const [search, setSearch] = useSearchParams();
  const tab = (["days", "tracks", "workouts"] as const).find((t) => t === search.get("tab")) ?? "days";
  const tracks = useList<{ tracks: Track[] }>("/api/admin/racing/tracks");
  return (
    <div className="up-admin rca-page">
      <header className="up-hero">
        <div>
          <div className="eyebrow">Administration</div>
          <h1>Publish racing</h1>
          <p className="sub">
            Build race cards, enter results and workouts, then publish. Drafts are only visible to admins. Only enter data
            from a real, permitted source.
          </p>
        </div>
      </header>
      <div className="up-chips rca-tabs" role="group" aria-label="Publishing sections">
        {(
          [
            ["days", "Race days"],
            ["tracks", `Tracks (${tracks.data?.tracks.length ?? 0})`],
            ["workouts", "Workouts"],
          ] as const
        ).map(([key, label]) => (
          <button key={key} type="button" className="up-chip" aria-pressed={tab === key} onClick={() => setSearch({ tab: key }, { replace: true })}>
            {label}
          </button>
        ))}
      </div>
      <ErrorLine error={tracks.error} retry={tracks.reload} />
      {tab === "days" && <DaysTab tracks={tracks.data?.tracks ?? []} />}
      {tab === "tracks" && <TracksTab tracks={tracks.data?.tracks ?? []} reload={tracks.reload} />}
      {tab === "workouts" && <WorkoutsTab tracks={tracks.data?.tracks ?? []} />}
    </div>
  );
}
