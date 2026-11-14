import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AccountHeader from "./account/AccountNav";
import HorseEditor from "../components/community/HorseEditor";
import { HorseCard, Icon, Skeletons, Empty } from "../components/community/ui";
import {
  community,
  errorText,
  money,
  type Horse,
  type HorseDetail,
  type Person,
  type Settings,
  type Visibility,
} from "../components/community/api";
import "../components/account/account.css";

const AUDIENCE: { value: Visibility; label: string; hint: string }[] = [
  { value: "members", label: "Everyone on Stayblz", hint: "Any signed-in member can see your horses." },
  { value: "followers", label: "Followers only", hint: "Only members who follow you." },
  { value: "private", label: "Only me", hint: "Your horses stay private." },
];

/** Account → My horses: the member's own horse inventory, with privacy settings. */
export default function MyHorses() {
  const [params, setParams] = useSearchParams();
  const [horses, setHorses] = useState<Horse[] | null>(null);
  const [me, setMe] = useState<Person | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [filter, setFilter] = useState("");
  const editing = params.get("edit");
  const editTab = (params.get("tab") as "details" | "photos" | "records" | null) ?? "details";

  const load = useCallback(async () => {
    try {
      const mine = await community.me();
      setMe(mine.person);
      setSettings(mine.settings);
      if (mine.person) {
        const r = await community.personHorses(mine.person.id);
        setHorses(r.horses);
      } else setHorses([]);
      setError("");
    } catch (e) {
      setError(errorText(e, "Your horses couldn't be loaded."));
      setHorses((h) => h ?? []);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function saveSettings(changes: Partial<Settings>) {
    if (!settings) return;
    const before = settings;
    setSettings({ ...settings, ...changes });
    setSaving(true);
    setSaved("");
    try {
      const r = await community.saveSettings(changes);
      setSettings(r.settings);
      setSaved("Saved");
      window.setTimeout(() => setSaved(""), 2000);
    } catch (e) {
      setSettings(before);
      setError(errorText(e, "Your settings couldn't be saved."));
    } finally {
      setSaving(false);
    }
  }

  const openEditor = (id: string | null, tab = "details") => setParams(id ? { edit: id, tab } : { edit: "new" });
  const closeEditor = useCallback(() => setParams({}), [setParams]);
  const onChanged = useCallback((h: HorseDetail) => {
    setHorses((list) => {
      const card: Horse = { ...h, imageCount: h.images.length };
      if (!list) return [card];
      return list.some((x) => x.id === h.id) ? list.map((x) => (x.id === h.id ? card : x)) : [card, ...list];
    });
  }, []);
  const onRemoved = useCallback((id: string) => setHorses((list) => (list ?? []).filter((h) => h.id !== id)), []);

  const shown = (horses ?? []).filter((h) => !filter || h.status === filter);
  const totals = (horses ?? []).reduce(
    (t, h) => ({ starts: t.starts + h.stats.starts, wins: t.wins + h.stats.wins, earnings: t.earnings + (h.stats.earningsCents ?? 0) }),
    { starts: 0, wins: 0, earnings: 0 },
  );
  const statuses = [...new Set((horses ?? []).map((h) => h.status))];

  return (
    <div className="cm cm-my">
      <AccountHeader title="My horses" intro="Your horse inventory: profiles, photos and race records, shared the way you choose." />

      <section className="cm-summary gx-glass">
        <dl className="cm-summary-stats">
          <div><dt>Horses</dt><dd>{horses?.length ?? "—"}</dd></div>
          <div><dt>Starts</dt><dd>{horses ? totals.starts : "—"}</dd></div>
          <div><dt>Wins</dt><dd>{horses ? totals.wins : "—"}</dd></div>
          <div><dt>Earnings</dt><dd>{horses ? money(totals.earnings, true) : "—"}</dd></div>
          <div><dt>Followers</dt><dd>{me?.followers ?? "—"}</dd></div>
        </dl>
        <div className="cm-summary-actions">
          {me && (
            <Link className="cm-btn" to={`/community/people/${me.id}`}>
              View public profile <Icon.Arrow />
            </Link>
          )}
          <button type="button" className="cm-btn cm-btn-primary" onClick={() => openEditor(null)}>
            <Icon.Plus /> Add a horse
          </button>
        </div>
      </section>

      {error && <p className="cm-error" role="alert">{error}</p>}

      <div className="cm-my-layout">
        <section className="cm-my-main" aria-labelledby="cm-inventory-title">
          <header className="cm-section-head">
            <h2 id="cm-inventory-title">Inventory</h2>
            {statuses.length > 1 && (
              <div className="cm-seg" role="group" aria-label="Filter by status">
                <button type="button" aria-pressed={!filter} onClick={() => setFilter("")}>All</button>
                {statuses.map((s) => (
                  <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}>
                    {s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>
            )}
          </header>
          {horses === null ? (
            <Skeletons kind="card" count={3} />
          ) : !horses.length ? (
            <Empty icon={<Icon.Horse />} title="Add your first horse">
              <p>Give each horse its own profile with photos, pedigree, status and race history. You decide who sees them.</p>
              <button type="button" className="cm-btn cm-btn-primary" onClick={() => openEditor(null)}><Icon.Plus /> Add a horse</button>
            </Empty>
          ) : (
            <div className="cm-grid">
              {shown.map((h) => (
                <HorseCard key={h.id} horse={h} showOwnerTools onEdit={() => openEditor(h.id)} />
              ))}
            </div>
          )}
        </section>

        <aside className="cm-my-side" aria-label="Privacy">
          <section className="cm-card gx-glass">
            <div className="cm-card-head">
              <h2>Privacy</h2>
              <span className="cm-saved" role="status">{saving ? "Saving…" : saved}</span>
            </div>
            <fieldset className="cm-radio-group" disabled={!settings}>
              <legend>Who can see your horses</legend>
              {AUDIENCE.map((a) => (
                <label key={a.value} className={settings?.inventoryVisibility === a.value ? "is-on" : undefined}>
                  <input
                    type="radio"
                    name="inventory"
                    checked={settings?.inventoryVisibility === a.value}
                    onChange={() => saveSettings({ inventoryVisibility: a.value })}
                  />
                  <span>
                    <strong>{a.label}</strong>
                    <small>{a.hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="cm-hint">Each horse can also have its own setting in its Details.</p>
            <label className="cm-switch">
              <input type="checkbox" checked={settings?.showEarnings ?? true} disabled={!settings} onChange={(e) => saveSettings({ showEarnings: e.target.checked })} />
              <span className="cm-switch-track" aria-hidden="true" />
              <span>
                <strong>Show my earnings</strong>
                <small>Totals on your profile, horses and shared results.</small>
              </span>
            </label>
            <label className="cm-switch">
              <input type="checkbox" checked={settings?.listed ?? true} disabled={!settings} onChange={(e) => saveSettings({ listed: e.target.checked })} />
              <span className="cm-switch-track" aria-hidden="true" />
              <span>
                <strong>List me in Members</strong>
                <small>People can find you in the Feeds members directory.</small>
              </span>
            </label>
            <HeadlineField value={settings?.headline ?? ""} disabled={!settings} onSave={(headline) => saveSettings({ headline })} />
          </section>
        </aside>
      </div>

      {editing && (
        <HorseEditor
          key={editing}
          horseId={editing === "new" ? null : editing}
          startTab={editTab}
          onClose={closeEditor}
          onChanged={onChanged}
          onRemoved={onRemoved}
        />
      )}
    </div>
  );
}

function HeadlineField({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="cm-field">
      <span>Community headline</span>
      <input
        value={text}
        maxLength={120}
        disabled={disabled}
        placeholder="e.g. Owner & breeder · Ocala, FL"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== value && onSave(text.trim())}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      />
      <small className="cm-hint">Shown under your name in the Feed and Members.</small>
    </label>
  );
}
