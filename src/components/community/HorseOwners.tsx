import { useEffect, useState } from "react";
import { useConfirm } from "../ui/Confirm";
import {
  SEX_LABELS,
  STATUS_LABELS,
  SURFACE_LABELS,
  community,
  errorText,
  money,
  ordinal,
  type HorseChange,
  type HorseDetail,
  type HorseOwner,
  type HorseSex,
  type HorseStatus,
  type RaceRecord,
} from "./api";
import { Avatar, Icon } from "./ui";

/**
 * Owners of a horse (horse editor → Owners). The lead owner (who added the horse) invites members to co-own it,
 * sets optional shares (only owners see them) and chooses whether co-owners' edits need approval. Every owner edits
 * the same horse, so changes and race-data updates show for all of them; changes waiting for approval are listed
 * here to accept or decline.
 */
export default function HorseOwners({
  horse,
  onChange,
  onLeft,
}: {
  horse: HorseDetail;
  onChange: (h: HorseDetail) => void;
  onLeft: (id: string) => void;
}) {
  const confirm = useConfirm();
  const lead = horse.role === "lead";
  const [owners, setOwners] = useState<HorseOwner[] | null>(null);
  const [approval, setApproval] = useState(!!horse.requireApproval);
  const [changes, setChanges] = useState<HorseChange[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([community.owners(horse.id), community.changes(horse.id)])
      .then(([o, c]) => {
        if (!live) return;
        setOwners(o.owners);
        setApproval(o.requireApproval);
        setChanges(c.changes);
      })
      .catch((e) => live && setError(errorText(e, "The owners couldn't be loaded.")));
    return () => {
      live = false;
    };
  }, [horse.id]);

  const coOwnerCount = (list: HorseOwner[]) => list.filter((o) => !o.lead && o.status === "accepted").length;
  const updateOwners = (list: HorseOwner[]) => {
    setOwners(list);
    onChange({ ...horse, coOwners: coOwnerCount(list), owners: list });
  };

  async function run(key: string, job: () => Promise<void>, fallback: string) {
    if (busy) return;
    setBusy(key);
    setError("");
    try {
      await job();
    } catch (e) {
      setError(errorText(e, fallback));
    } finally {
      setBusy(null);
    }
  }

  async function remove(o: HorseOwner) {
    const self = o.me;
    const sure = await confirm({
      title: self ? `Leave ${horse.name}?` : o.status === "pending" ? `Cancel the invite to ${o.name}?` : `Remove ${o.name} as a co-owner?`,
      message: self
        ? "The horse leaves your My horses list. The lead owner can invite you again."
        : o.status === "pending"
          ? "They won't be able to accept it any more."
          : "They can no longer edit this horse or get its updates.",
      confirmLabel: self ? "Leave horse" : o.status === "pending" ? "Cancel invite" : "Remove",
      cancelLabel: "Keep",
      tone: "danger",
    });
    if (!sure) return;
    await run(
      `remove-${o.id}`,
      async () => {
        const r = await community.removeOwner(horse.id, o.id);
        if (self) return onLeft(horse.id);
        if (r.owners) updateOwners(r.owners);
      },
      "That couldn't be done.",
    );
  }

  const toggleApproval = (on: boolean) =>
    run(
      "approval",
      async () => {
        const r = await community.setApproval(horse.id, on);
        setApproval(r.requireApproval);
        onChange({ ...horse, requireApproval: r.requireApproval });
      },
      "The setting couldn't be saved.",
    );

  const answer = (c: HorseChange, accept: boolean) =>
    run(
      `change-${c.id}`,
      async () => {
        const r = await community.answerChange(c.id, accept);
        const left = (changes ?? []).filter((x) => x.id !== c.id);
        setChanges(left);
        onChange({ ...(r.horse ?? horse), pendingChanges: left.length });
      },
      "That change couldn't be answered.",
    );

  const total = (owners ?? []).reduce((sum, o) => sum + (o.shareBps ?? 0), 0);

  return (
    <div className="cm-ed-panel cm-owners">
      <p className="cm-muted">
        Own this horse with someone else? Invite them as a co-owner. Every owner sees the same horse, so photos, races and
        race-data updates show for all of you at once.
      </p>
      {error && <p className="cm-error" role="alert">{error}</p>}

      <fieldset className="cm-fs">
        <legend className="cm-fs-head">
          <span className="cm-fs-n">01</span>
          <span className="cm-fs-title">Owners</span>
          {owners && total > 0 && <span className="cm-fs-hint">{pct(total)} assigned · only owners see shares</span>}
        </legend>
        {!owners ? (
          <div className="cm-ed-loading" role="status"><span className="cm-spinner" /> Loading owners…</div>
        ) : (
          <ul className="cm-owner-list">
            {owners.map((o) => (
              <li key={o.id} className={o.status === "pending" ? "is-pending" : undefined}>
                <Avatar id={o.id} name={o.name} size={36} />
                <span className="cm-owner-name">
                  <strong>{o.name}{o.me && <span className="cm-muted"> (you)</span>}</strong>
                  <small>{o.lead ? "Lead owner" : o.status === "pending" ? "Invited · waiting for an answer" : "Co-owner"}</small>
                </span>
                {lead ? (
                  <ShareInput
                    value={o.shareBps ?? null}
                    label={`${o.name}'s share`}
                    disabled={!!busy}
                    onSave={(bps) =>
                      run(`share-${o.id}`, async () => updateOwners((await community.setOwnerShare(horse.id, o.id, bps)).owners), "The share couldn't be saved.")
                    }
                  />
                ) : (
                  o.shareBps != null && <span className="cm-tag is-muted">{pct(o.shareBps)}</span>
                )}
                {!o.lead && (lead || o.me) && (
                  <button
                    type="button"
                    className="cm-icon-btn cm-danger"
                    aria-label={o.me ? "Leave this horse" : o.status === "pending" ? `Cancel the invite to ${o.name}` : `Remove ${o.name}`}
                    title={o.me ? "Leave" : "Remove"}
                    disabled={!!busy}
                    onClick={() => void remove(o)}
                  >
                    {o.me ? <Icon.Arrow /> : <Icon.Trash />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {lead && owners && (
          <InviteOwner
            exclude={owners.map((o) => o.id)}
            busy={busy === "invite"}
            onInvite={(id, bps) =>
              run("invite", async () => updateOwners((await community.inviteOwner(horse.id, id, bps)).owners), "The invitation couldn't be sent.")
            }
          />
        )}
      </fieldset>

      <fieldset className="cm-fs">
        <legend className="cm-fs-head">
          <span className="cm-fs-n">02</span>
          <span className="cm-fs-title">Co-owners' edits</span>
        </legend>
        {lead ? (
          <label className="cm-switch">
            <input type="checkbox" checked={approval} disabled={busy === "approval"} onChange={(e) => void toggleApproval(e.target.checked)} />
            <span className="cm-switch-track" aria-hidden="true" />
            <span>
              <strong>Changes need approval</strong>
              <small>
                {approval
                  ? "A co-owner's changes to details and races wait until another owner accepts them."
                  : "Off: co-owners' changes show straight away, and the other owners get an alert."}
              </small>
            </span>
          </label>
        ) : (
          <p className="cm-muted">
            {approval
              ? "Your changes to details and races are sent to the other owners to accept before they show."
              : "Your changes show straight away, and the other owners get an alert."}{" "}
            Only the lead owner can remove the horse, link race data or change who can see it.
          </p>
        )}
      </fieldset>

      <fieldset className="cm-fs">
        <legend className="cm-fs-head">
          <span className="cm-fs-n">03</span>
          <span className="cm-fs-title">Waiting for approval</span>
          {changes && changes.length > 0 && <span className="cm-fs-hint">{changes.length}</span>}
        </legend>
        {!changes ? null : changes.length === 0 ? (
          <p className="cm-muted">Nothing is waiting.</p>
        ) : (
          <ul className="cm-change-list">
            {changes.map((c) => (
              <li key={c.id}>
                <div className="cm-change-head">
                  <strong>{KIND_LABEL[c.kind]}</strong>
                  <small>
                    {c.mine ? "You" : c.proposedBy.name} · {new Date(c.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </small>
                </div>
                <ChangeBody change={c} />
                <div className="cm-change-actions">
                  {c.mine ? (
                    <button type="button" className="cm-btn cm-btn-sm cm-btn-ghost" disabled={!!busy} onClick={() => void answer(c, false)}>
                      Withdraw
                    </button>
                  ) : (
                    <>
                      <button type="button" className="cm-btn cm-btn-sm cm-btn-ghost" disabled={!!busy} onClick={() => void answer(c, false)}>
                        Decline
                      </button>
                      <button type="button" className="cm-btn cm-btn-sm cm-btn-primary" disabled={!!busy} onClick={() => void answer(c, true)}>
                        Accept
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </div>
  );
}

const pct = (bps: number) => `${(bps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;

const KIND_LABEL: Record<HorseChange["kind"], string> = {
  details: "Details",
  record_add: "New race",
  record_update: "Race change",
  record_remove: "Remove a race",
};

const FIELD_LABEL: Record<string, string> = {
  name: "Name",
  breed: "Breed",
  sex: "Sex",
  foaledYear: "Year foaled",
  color: "Colour",
  sire: "Sire",
  dam: "Dam",
  status: "Status",
  trainer: "Trainer",
  location: "Location",
  description: "About",
};

function fieldText(field: string, v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (field === "sex") return SEX_LABELS[v as HorseSex] || String(v);
  if (field === "status") return STATUS_LABELS[v as HorseStatus] ?? String(v);
  const s = String(v);
  return s.length > 140 ? s.slice(0, 139) + "…" : s;
}

const raceLine = (r: Omit<RaceRecord, "id">) =>
  [
    r.raceDate,
    r.raceName || r.track,
    r.raceName ? r.track : "",
    r.surface ? SURFACE_LABELS[r.surface] : "",
    r.finish ? `${ordinal(r.finish)}${r.fieldSize ? ` of ${r.fieldSize}` : ""}` : "",
    r.earningsCents ? money(r.earningsCents) : "",
  ]
    .filter(Boolean)
    .join(" · ");

function ChangeBody({ change: c }: { change: HorseChange }) {
  if (c.kind === "details")
    return (
      <dl className="cm-change-diff">
        {(c.fields ?? []).map((f) => (
          <div key={f.field}>
            <dt>{FIELD_LABEL[f.field] ?? f.field}</dt>
            <dd>
              <s>{fieldText(f.field, f.from)}</s> <Icon.Right /> <b>{fieldText(f.field, f.to)}</b>
            </dd>
          </div>
        ))}
      </dl>
    );
  if (c.kind === "record_add") return <p className="cm-change-race">{c.proposed ? raceLine(c.proposed) : "A new race"}</p>;
  if (c.kind === "record_remove") return <p className="cm-change-race"><s>{c.record ? raceLine(c.record) : "A race"}</s></p>;
  return (
    <div className="cm-change-race">
      {c.record && <p><s>{raceLine(c.record)}</s></p>}
      {c.proposed && <p><b>{raceLine(c.proposed)}</b></p>}
    </div>
  );
}

/** Share in percent, saved when the field loses focus (empty = no share). */
function ShareInput({ value, label, disabled, onSave }: { value: number | null; label: string; disabled: boolean; onSave: (bps: number | null) => void }) {
  const [text, setText] = useState(value == null ? "" : String(value / 100));
  useEffect(() => setText(value == null ? "" : String(value / 100)), [value]);
  const commit = () => {
    const n = text.trim() === "" ? null : Math.round(Number(text) * 100);
    if (n !== null && (!Number.isFinite(n) || n < 1 || n > 10000)) return setText(value == null ? "" : String(value / 100));
    if (n !== value) onSave(n);
  };
  return (
    <span className="cm-input-addon cm-owner-share">
      <input
        inputMode="decimal"
        value={text}
        disabled={disabled}
        placeholder="—"
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
      />
      <b>%</b>
    </span>
  );
}

/** Find a member by name and invite them to co-own the horse. */
function InviteOwner({ exclude, busy, onInvite }: { exclude: string[]; busy: boolean; onInvite: (id: string, bps: number | null) => Promise<void> }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; headline: string }[] | null>(null);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [share, setShare] = useState("");

  useEffect(() => {
    const text = q.trim();
    if (picked || text.length < 2) return setFound(null);
    const c = new AbortController();
    const timer = window.setTimeout(() => {
      community
        .search(text, c.signal)
        .then((r) => !c.signal.aborted && setFound(r.people.filter((p) => !p.me)))
        .catch(() => !c.signal.aborted && setFound([]));
    }, 250);
    return () => {
      window.clearTimeout(timer);
      c.abort();
    };
  }, [q, picked]);

  const taken = new Set(exclude);
  const shareBps = share.trim() === "" ? null : Math.round(Number(share) * 100);
  const shareOk = shareBps === null || (Number.isFinite(shareBps) && shareBps >= 1 && shareBps <= 10000);

  async function invite() {
    if (!picked || !shareOk) return;
    await onInvite(picked.id, shareBps);
    setPicked(null);
    setQ("");
    setShare("");
  }

  return (
    <div className="cm-owner-invite">
      <span className="cm-owner-invite-title">Invite a co-owner</span>
      {picked ? (
        <div className="cm-owner-picked">
          <Avatar id={picked.id} name={picked.name} size={28} />
          <strong>{picked.name}</strong>
          <button type="button" className="cm-icon-btn" aria-label={`Choose someone else instead of ${picked.name}`} onClick={() => setPicked(null)}>
            <Icon.Close />
          </button>
        </div>
      ) : (
        <label className="cm-field">
          <span className="cm-sr">Member's name</span>
          <input type="search" value={q} autoComplete="off" placeholder="Search members by name" onChange={(e) => setQ(e.target.value)} />
        </label>
      )}
      {!picked && found && (
        <ul className="cm-owner-results" aria-label="Members">
          {found.length === 0 && <li className="cm-muted">No members found by that name.</li>}
          {found.map((p) => (
            <li key={p.id}>
              <button type="button" disabled={taken.has(p.id)} onClick={() => setPicked({ id: p.id, name: p.name })}>
                <Avatar id={p.id} name={p.name} size={28} />
                <span>
                  <strong>{p.name}</strong>
                  <small>{taken.has(p.id) ? "Already an owner or invited" : p.headline}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked && (
        <div className="cm-owner-invite-row">
          <label className="cm-field">
            <span>Their share (optional)</span>
            <span className="cm-input-addon cm-owner-share">
              <input inputMode="decimal" value={share} placeholder="50" onChange={(e) => setShare(e.target.value)} />
              <b>%</b>
            </span>
          </label>
          <button type="button" className="cm-btn cm-btn-primary" disabled={busy || !shareOk} onClick={() => void invite()}>
            {busy ? "Sending…" : <><Icon.Users /> Send invite</>}
          </button>
        </div>
      )}
      {picked && <p className="cm-muted">{picked.name} gets an alert and can accept or decline in My horses.</p>}
    </div>
  );
}
