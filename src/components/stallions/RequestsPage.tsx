import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { stallionsApi } from "./api";
import { MARE_STATUS, METHODS, REQUEST_STATUS, dateText, labelOf } from "./options";
import { StallionPhoto } from "./StallionCard";
import StallionsNav from "./StallionsNav";
import type { BreedingRequest } from "./types";

const tone = (status: string) => REQUEST_STATUS.find((s) => s.value === status)?.tone ?? "muted";

/**
 * Breeding requests. Received: requests about your stallions, with a status you set (the breeder sees it) and a
 * private note. Sent: requests you made and where they stand. Conversations themselves are in Stayblz Chat.
 */
export default function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const side = params.get("side") === "sent" ? "sent" : "received";
  const [filter, setFilter] = useState("");
  const [state, setState] = useState<{ loading: boolean; error: string; list: BreedingRequest[] }>({ loading: true, error: "", list: [] });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ loading: true, error: "", list: [] });
    setFilter("");
    stallionsApi
      .requests(side)
      .then((list) => live && setState({ loading: false, error: "", list }))
      .catch((e) => live && setState({ loading: false, error: e instanceof Error ? e.message : "Requests couldn't be loaded.", list: [] }));
    return () => {
      live = false;
    };
  }, [side, version]);

  const patch = (id: string, change: Partial<BreedingRequest>) => setState((s) => ({ ...s, list: s.list.map((r) => (r.id === id ? { ...r, ...change } : r)) }));
  const shown = filter ? state.list.filter((r) => r.status === filter) : state.list;
  const counts = Object.fromEntries(REQUEST_STATUS.map((s) => [s.value, state.list.filter((r) => r.status === s.value).length]));

  return (
    <div className="st-page">
      <StallionsNav signedIn title="Breeding requests" lead="Every request about your stallions, and every request you sent. Talk it through in Stayblz Chat; keep track here." />
      <div className="st-toolbar">
        <div className="st-seg" role="group" aria-label="Which requests">
          <button type="button" aria-pressed={side === "received"} onClick={() => setParams({}, { replace: true })}>
            About my stallions
          </button>
          <button type="button" aria-pressed={side === "sent"} onClick={() => setParams({ side: "sent" }, { replace: true })}>
            I sent
          </button>
        </div>
        {state.list.length > 0 && (
          <label className="st-field st-inline">
            <span>Show</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All ({state.list.length})</option>
              {REQUEST_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {side === "sent" ? s.sender : s.label} ({counts[s.value]})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {state.loading ? (
        <p className="st-count-line" role="status">
          Loading requests…
        </p>
      ) : state.error ? (
        <div className="st-empty gx-glass" role="alert">
          <h2>Requests couldn't be loaded.</h2>
          <p>{state.error}</p>
          <button type="button" className="btn btn-quiet" onClick={() => setVersion((v) => v + 1)}>
            Try again
          </button>
        </div>
      ) : !shown.length ? (
        <div className="st-empty gx-glass">
          {side === "received" ? (
            <>
              <h2>{filter ? "No requests with this status." : "No requests yet."}</h2>
              <p>When breeders ask about your stallions, their requests and mares show here.</p>
              <Link to="/stallions/manage" className="btn btn-quiet">
                My stallions
              </Link>
            </>
          ) : (
            <>
              <h2>{filter ? "No requests with this status." : "You haven't sent any requests."}</h2>
              <p>Find a stallion and use “Ask about a breeding”.</p>
              <Link to="/stallions" className="btn btn-primary">
                Browse stallions
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className="st-requests">
          {shown.map((r) => (
            <RequestRow key={r.id} r={r} side={side} onChange={(c) => patch(r.id, c)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestRow({ r, side, onChange }: { r: BreedingRequest; side: "received" | "sent"; onChange: (c: Partial<BreedingRequest>) => void }) {
  const [note, setNote] = useState(r.ownerNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const status = REQUEST_STATUS.find((s) => s.value === r.status);

  async function save(change: { status?: string; ownerNote?: string }) {
    setSaving(true);
    setError("");
    try {
      const saved = await stallionsApi.updateRequest(r.id, change);
      onChange({ status: saved.status, ownerNote: saved.ownerNote });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save.");
    } finally {
      setSaving(false);
    }
  }
  const mare = r.mare;
  return (
    <li className="st-request gx-glass">
      <div className="st-request-head">
        <StallionPhoto stallion={{ cover: r.cover, name: r.stallionName }} className="st-request-photo" />
        <div>
          <h2>
            {r.stallionId ? <Link to={`/stallions/${r.stallionId}`}>{r.stallionName}</Link> : r.stallionName}
            {!r.stallionId && <small> (no longer listed)</small>}
          </h2>
          <p className="st-muted">
            {side === "received" ? `From ${r.senderName}` : `To ${r.ownerName ?? "the owner"}`} · {dateText(r.createdAt)}
            {r.seasonYear ? ` · ${r.seasonYear} season` : ""}
            {r.method ? ` · ${labelOf(METHODS, r.method)}` : ""}
          </p>
        </div>
        <span className={`st-tag is-${tone(r.status)}`}>{side === "sent" ? status?.sender : status?.label}</span>
      </div>
      <dl className="st-request-mare">
        <div>
          <dt>Mare</dt>
          <dd>
            <strong>{mare.name || "Not named"}</strong>
            {mare.foaled ? ` (${mare.foaled})` : ""}
          </dd>
        </div>
        {(mare.sire || mare.dam) && (
          <div>
            <dt>Pedigree</dt>
            <dd>
              {[mare.sire && `by ${mare.sire}`, mare.dam && `out of ${mare.dam}`, mare.damSire && `(by ${mare.damSire})`].filter(Boolean).join(" ")}
            </dd>
          </div>
        )}
        {mare.status && (
          <div>
            <dt>Status</dt>
            <dd>{labelOf(MARE_STATUS, mare.status)}</dd>
          </div>
        )}
        {mare.registration && (
          <div>
            <dt>Registration</dt>
            <dd>{mare.registration}</dd>
          </div>
        )}
      </dl>
      {r.message && <blockquote className="st-request-message">{r.message}</blockquote>}
      <div className="st-request-actions">
        {r.conversationId && (
          <Link to={`/messages/${r.conversationId}`} className="btn btn-quiet">
            Open the chat
          </Link>
        )}
        {side === "received" && r.stallionId && (
          <Link to={`/stallions/mating?stallion=${r.stallionId}`} className="btn btn-quiet">
            Check the mating
          </Link>
        )}
        {side === "received" && (
          <label className="st-field st-inline">
            <span>Status</span>
            <select value={r.status} disabled={saving} onChange={(e) => void save({ status: e.target.value })}>
              {REQUEST_STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {side === "received" && (
        <div className="st-request-note">
          <label className="st-field">
            <span>
              Private note <em>Only you see this</em>
            </span>
            <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {note !== (r.ownerNote ?? "") && (
            <button type="button" className="btn btn-quiet" disabled={saving} onClick={() => void save({ ownerNote: note })}>
              {saving ? "Saving…" : "Save note"}
            </button>
          )}
        </div>
      )}
      {side === "received" && <p className="st-muted">The breeder sees the status (as “{status?.sender}”), never your note.</p>}
      {error && (
        <p className="st-alert is-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
