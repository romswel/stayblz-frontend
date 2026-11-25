import { useEffect, useState } from "react";
import { useConfirm } from "../ui/Confirm";
import { community, errorText, horseImageUrl, type HorseInvite } from "./api";
import { Icon } from "./ui";

/**
 * My horses → invitations to co-own a horse. Accepting adds the horse to My horses (the same horse the lead owner
 * edits, so updates show for both); declining tells the lead owner. Hidden while there are none.
 */
export default function HorseInvites({ onAccepted }: { onAccepted: () => void }) {
  const confirm = useConfirm();
  const [invites, setInvites] = useState<HorseInvite[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    community
      .horseInvites()
      .then((r) => live && setInvites(r.invites))
      .catch((e) => live && (setInvites([]), setError(errorText(e, "Your invitations couldn't be loaded."))));
    return () => {
      live = false;
    };
  }, []);

  async function answer(inv: HorseInvite, accept: boolean) {
    if (busy) return;
    if (!accept) {
      const sure = await confirm({
        title: `Decline ${inv.horse.name}?`,
        message: `${inv.invitedBy.name} is told you declined. They can invite you again later.`,
        confirmLabel: "Decline",
        cancelLabel: "Keep invitation",
        tone: "danger",
      });
      if (!sure) return;
    }
    setBusy(inv.horse.id);
    setError("");
    try {
      await community.answerInvite(inv.horse.id, accept);
      setInvites((list) => (list ?? []).filter((x) => x.horse.id !== inv.horse.id));
      if (accept) onAccepted();
    } catch (e) {
      setError(errorText(e, "That invitation couldn't be answered."));
    } finally {
      setBusy(null);
    }
  }

  if (!error && (!invites || !invites.length)) return null;
  return (
    <section id="invites" className="cm-card gx-glass cm-invites" aria-labelledby="cm-invites-title">
      <div className="cm-card-head">
        <h2 id="cm-invites-title">Co-ownership invitations</h2>
      </div>
      {error && <p className="cm-error" role="alert">{error}</p>}
      <ul className="cm-invite-list">
        {(invites ?? []).map((inv) => (
          <li key={inv.horse.id}>
            <span className="cm-ed-thumb" aria-hidden="true">
              {inv.horse.coverImageId ? <img src={horseImageUrl(inv.horse.coverImageId)} alt="" /> : <Icon.Horse />}
            </span>
            <span className="cm-invite-text">
              <strong>{inv.horse.name}</strong>
              <small>
                {inv.invitedBy.name} invited you to co-own this horse
                {inv.shareBps ? ` (${(inv.shareBps / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}% share)` : ""}.
              </small>
            </span>
            <span className="cm-invite-actions">
              <button type="button" className="cm-btn cm-btn-sm cm-btn-ghost" disabled={!!busy} onClick={() => void answer(inv, false)}>
                Decline
              </button>
              <button type="button" className="cm-btn cm-btn-sm cm-btn-primary" disabled={!!busy} onClick={() => void answer(inv, true)}>
                {busy === inv.horse.id ? "Joining…" : "Accept"}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
