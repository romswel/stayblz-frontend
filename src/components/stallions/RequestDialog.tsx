import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth";
import { createRequestId } from "../../requestId";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { accountDraftKey, useDraft } from "../ui/useDraft";
import { stallionsApi } from "./api";
import MareFields, { emptyMare } from "./MareFields";
import { MARE_STATUS, METHODS, labelOf } from "./options";
import type { MareDraft, SavedMare, StallionProfile } from "./types";

const thisYear = new Date().getFullYear();
// The season to ask for: his listed season, never one in the past, never past what the list offers (this year + 2).
const seasonFor = (listed: number) => Math.min(thisYear + 2, Math.max(listed, thisYear));

/**
 * "Ask about a breeding": the breeder's message and their mare's details go to the owner's Stayblz Chat with a card
 * for this stallion, and the request is tracked under Requests on both sides.
 */
export default function RequestDialog({ stallion, onClose }: { stallion: StallionProfile; onClose: () => void }) {
  const { user } = useAuth();
  const draftKey = accountDraftKey(user?.id, `stallions.request.${stallion.id}`);
  const first = user?.displayName?.split(" ")[0] ?? "";
  const initial = {
    message: `Hello${stallion.ownerName ? ` ${stallion.ownerName.split(" ")[0]}` : ""}, I'd like to ask about breeding my mare to ${stallion.name} for the ${seasonFor(stallion.seasonYear)} season. Could you send me the contract and what you need from me?${first ? `\n\nThanks,\n${first}` : ""}`,
    mare: emptyMare(),
    status: "",
    season: seasonFor(stallion.seasonYear),
    method: stallion.methods.length === 1 ? stallion.methods[0] : "",
  };
  const [form, setForm, clearDraft, restored] = useDraft(draftKey, initial);
  const [mares, setMares] = useState<SavedMare[]>([]);
  const [source, setSource] = useState("typed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ conversationId: string } | null>(null);
  const clientId = useRef(createRequestId());

  useEffect(() => {
    stallionsApi
      .mares()
      .then((list) => {
        setMares(list);
        if (list.length && !form.mare.name) setSource(list[0].id);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mare: MareDraft = source === "typed" ? form.mare : (mares.find((m) => m.id === source) ?? form.mare);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!mare.name.trim()) return setError("Add your mare's name.");
    if (!form.message.trim()) return setError("Write a short message to the owner.");
    if (stallion.methods.length > 1 && !form.method) return setError("Choose how you'd like to breed.");
    setBusy(true);
    setError("");
    try {
      const r = await stallionsApi.request(stallion.id, {
        message: form.message.trim(),
        clientId: clientId.current,
        seasonYear: form.season,
        method: form.method,
        mare: { name: mare.name, breed: mare.breed, foaled: mare.foaled, registration: mare.registration, pedigree: mare.pedigree, status: form.status },
      });
      clearDraft();
      setSent({ conversationId: r.conversationId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your request couldn't be sent. Please try again.");
      // Trying again reuses the id, so a request that did arrive is never sent twice.
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <Modal onClose={onClose} label="Request sent" className="gx-layer">
        <DialogHead kicker="Stayblz Stallions" title="Request sent" onClose={onClose} />
        <div className="dlg">
          <p className="dlg-text">
            Your request about {stallion.name} is in {stallion.ownerName || "the owner"}'s Stayblz Chat inbox, with your mare's details. Their replies come
            to your chat, and you can follow the request under Requests.
          </p>
          <div className="dlg-actions">
            <Link to="/stallions/requests?side=sent" className="btn btn-quiet" onClick={onClose}>
              My requests
            </Link>
            <Link to={`/messages/${sent.conversationId}`} className="btn btn-primary">
              Open the chat
            </Link>
          </div>
        </div>
      </Modal>
    );

  return (
    <Modal onClose={onClose} label={`Ask about breeding to ${stallion.name}`} className="gx-layer modal-wide">
      <DialogHead kicker="Ask about a breeding" title={stallion.name} onClose={onClose} />
      <form className="dlg st-request" onSubmit={submit} noValidate>
        {restored && (
          <p className="st-muted">
            We kept what you typed.{" "}
            <button type="button" className="st-link" onClick={clearDraft}>
              Start again
            </button>
          </p>
        )}
        <fieldset className="st-fieldset">
          <legend>Your mare</legend>
          {mares.length > 0 && (
            <label className="st-field">
              <span>Mare</span>
              <select value={source} onChange={(e) => setSource(e.target.value)} disabled={busy}>
                {mares.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
                <option value="typed">Another mare</option>
              </select>
            </label>
          )}
          {source === "typed" && <MareFields value={form.mare} onChange={(m) => setForm((f) => ({ ...f, mare: m }))} disabled={busy} idPrefix="request-mare" showGenetics={false} />}
          <div className="st-grid-3">
            <label className="st-field">
              <span>Her status</span>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} disabled={busy}>
                {MARE_STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>Season</span>
              <select value={form.season} onChange={(e) => setForm((f) => ({ ...f, season: Number(e.target.value) }))} disabled={busy}>
                {[thisYear, thisYear + 1, thisYear + 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="st-field">
              <span>Breeding method</span>
              <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} disabled={busy || stallion.methods.length === 1}>
                {stallion.methods.length > 1 && <option value="">Choose…</option>}
                {stallion.methods.map((m) => (
                  <option key={m} value={m}>
                    {labelOf(METHODS, m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
        <label className="st-field">
          <span>Message to the owner</span>
          <textarea rows={5} maxLength={1000} value={form.message} disabled={busy} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
          <small className="st-muted">{1000 - form.message.length} characters left</small>
        </label>
        <p className="st-muted">
          The owner sees your name, this message and your mare's details. Bookings, contracts and payments are agreed between you and the owner, not by
          Stayblz.
        </p>
        {error && (
          <p className="st-alert is-error" role="alert">
            {error}
          </p>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Sending…" : "Send request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
