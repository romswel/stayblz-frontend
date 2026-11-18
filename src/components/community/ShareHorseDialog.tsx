import { useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { community, errorText, horseImageUrl, type Horse, type Visibility } from "./api";
import { Icon } from "./ui";
import { TopLayer } from "./HorseShare";

/**
 * My horses → Share: posts one horse to the Feed with an optional caption. The post shows the
 * horse's name, breed and current photos and videos. A private horse is shared only after the
 * owner agrees to make it visible to everyone; a followers-only horse is shared to followers.
 */
export default function ShareHorseDialog({
  horse,
  inventoryVisibility,
  onClose,
  onShared,
}: {
  horse: Horse;
  /** The owner's default, used when the horse follows it ("inherit"). */
  inventoryVisibility: Visibility;
  onClose: () => void;
  /** Called after the server saved the post; `madeVisible` when the horse was switched to Everyone. */
  onShared: (madeVisible: boolean) => void;
}) {
  const level: Visibility = !horse.visibility || horse.visibility === "inherit" ? inventoryVisibility : horse.visibility;
  const isPrivate = level === "private";
  const followersOnly = level === "followers";
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<"members" | "followers">(followersOnly ? "followers" : "members");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function share() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await community.shareHorse(horse.id, {
        body: body.trim(),
        visibility: followersOnly ? "followers" : audience,
        makeVisible: isPrivate || undefined,
      });
      setDone(true);
      onShared(isPrivate);
    } catch (e) {
      setError(errorText(e, "Your horse couldn't be shared. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <TopLayer>
    <Modal label={`Share ${horse.name} to the Feed`} className="gx-layer cm-share-dlg" onClose={onClose}>
      <DialogHead kicker="Share to Feed" title={horse.name} onClose={onClose} />
      {done ? (
        <div className="cm-share-done" role="status">
          <span className="cm-share-done-icon" aria-hidden="true"><Icon.Send /></span>
          <p><strong>{horse.name}</strong> is on the Feed.</p>
          <div className="cm-row-end">
            <button type="button" className="cm-btn cm-btn-ghost" onClick={onClose}>Close</button>
            <Link className="cm-btn cm-btn-primary" to="/community">View in Feed</Link>
          </div>
        </div>
      ) : (
        <div className="cm-share-form">
          <div className="cm-share-preview">
            {horse.coverImageId ? (
              <img src={horseImageUrl(horse.coverImageId)} alt="" />
            ) : (
              <span className="cm-horse-chip-icon" aria-hidden="true"><Icon.Horse /></span>
            )}
            <span>
              <strong>{horse.name}</strong>
              <small>{horse.breed || "Breed not added"}{horse.imageCount ? ` · ${horse.imageCount} photo${horse.imageCount === 1 ? "" : "s"} and videos` : ""}</small>
            </span>
          </div>

          {isPrivate && (
            <p className="cm-note" role="note">
              <Icon.Lock /> Only you can see this horse. Sharing it will make it visible to everyone on Stayblz.
            </p>
          )}

          <label className="cm-field">
            <span>Caption (optional)</span>
            <textarea
              value={body}
              maxLength={2000}
              rows={3}
              placeholder={`Say something about ${horse.name}…`}
              onChange={(e) => setBody(e.target.value)}
              data-autofocus
            />
          </label>

          <label className="cm-field">
            <span>Who can see this post</span>
            <select
              value={followersOnly ? "followers" : audience}
              disabled={followersOnly}
              onChange={(e) => setAudience(e.target.value as "members" | "followers")}
            >
              <option value="members">Everyone</option>
              <option value="followers">Followers</option>
            </select>
            {followersOnly && <small className="cm-hint">This horse is visible to your followers only, so the post is too.</small>}
          </label>

          {error && <p className="cm-error" role="alert">{error}</p>}

          <div className="cm-row-end">
            <button type="button" className="cm-btn cm-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="button" className="cm-btn cm-btn-primary" onClick={share} disabled={busy}>
              {busy ? "Sharing…" : isPrivate ? "Make visible to everyone & share" : "Share to Feed"}
            </button>
          </div>
        </div>
      )}
    </Modal>
    </TopLayer>
  );
}
