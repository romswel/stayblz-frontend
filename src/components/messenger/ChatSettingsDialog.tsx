import { useEffect, useState } from "react";
import Modal from "../Modal";
import DialogHead from "../ui/DialogHead";
import { useConfirm } from "../ui/Confirm";
import { peopleApi } from "./chatApi";
import { fileSize } from "./format";
import { Avatar, DatabaseIcon, FolderIcon } from "./icons";
import type { ChatFolder, ChatProfile, Person } from "./types";

const QUOTA = 50 * 1024 * 1024;

/** Chat settings: privacy, folders, blocked people, storage, and how the free plan affects chat. */
export default function ChatSettingsDialog({
  name,
  folders,
  onNewFolder,
  onRenameFolder,
  onDeleteFolder,
  onAbout,
  onClose,
}: {
  name: string;
  folders: ChatFolder[];
  onNewFolder: () => void;
  onRenameFolder: (f: ChatFolder) => void;
  onDeleteFolder: (f: ChatFolder) => Promise<void>;
  onAbout: () => void;
  onClose: () => void;
}) {
  const confirm = useConfirm();
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [blocked, setBlocked] = useState<Person[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    Promise.all([peopleApi.profile(c.signal), peopleApi.blocks(c.signal)])
      .then(([p, b]) => {
        if (c.signal.aborted) return;
        setProfile(p?.profile ?? { discoverable: true, showActive: true, storageUsed: 0 });
        setBlocked(b?.blocked ?? []);
      })
      .catch((e) => !c.signal.aborted && setError(e instanceof Error ? e.message : "Settings could not be loaded."));
    return () => c.abort();
  }, []);

  async function save(change: Partial<Pick<ChatProfile, "discoverable" | "showActive">>) {
    if (!profile || saving) return;
    const before = profile;
    setProfile({ ...profile, ...change });
    setSaving(true);
    setError("");
    try {
      setProfile((await peopleApi.saveProfile(change)).profile);
    } catch (e) {
      setProfile(before);
      setError(e instanceof Error ? e.message : "That setting wasn't saved.");
    } finally {
      setSaving(false);
    }
  }
  async function unblock(p: Person) {
    const ok = await confirm({ title: `Unblock ${p.name}?`, message: "They'll be able to find you and message you again.", confirmLabel: "Unblock" });
    if (!ok) return;
    try {
      await peopleApi.block(p.id, false);
      setBlocked((old) => old?.filter((x) => x.id !== p.id) ?? old);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unblock didn't work.");
    }
  }
  async function removeFolder(f: ChatFolder) {
    const ok = await confirm({
      title: `Delete the "${f.name}" folder?`,
      message: "Its chats stay in your list; they just leave the folder.",
      confirmLabel: "Delete folder",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await onDeleteFolder(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The folder wasn't deleted.");
    }
  }

  const used = profile?.storageUsed ?? 0;
  return (
    <Modal label={`${name} settings`} onClose={onClose} className="modal-sm">
      <DialogHead kicker={name} title="Settings" onClose={onClose} />
      <div className="dlg mx-settings">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <h3 className="mx-details-h">Privacy</h3>
        {!profile && !error && <p className="mx-hint" role="status">Loading…</p>}
        {profile && (
          <>
            <label className="mx-toggle">
              <span>
                <strong>Let members find me by name</strong>
                <small>Off: only friends and people who know your email can start a chat with you.</small>
              </span>
              <input type="checkbox" role="switch" checked={profile.discoverable} disabled={saving} onChange={(e) => void save({ discoverable: e.target.checked })} />
            </label>
            <label className="mx-toggle">
              <span>
                <strong>Show when I'm active</strong>
                <small>Off: nobody sees "Active now" for you, and you won't see it for others.</small>
              </span>
              <input type="checkbox" role="switch" checked={profile.showActive} disabled={saving} onChange={(e) => void save({ showActive: e.target.checked })} />
            </label>
          </>
        )}

        <h3 className="mx-details-h">Folders</h3>
        {!folders.length && <p className="mx-hint">No folders yet. Folders sort your chats into tabs, like "Trainers" or "Syndicate".</p>}
        <ul className="mx-rows">
          {folders.map((f) => (
            <li key={f.id}>
              <FolderIcon />
              <span>{f.name}</span>
              <button type="button" className="mx-pill" onClick={() => onRenameFolder(f)}>
                Rename
              </button>
              <button type="button" className="mx-pill is-danger" onClick={() => void removeFolder(f)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-quiet mx-inline-btn" onClick={onNewFolder}>
          New folder
        </button>

        <h3 className="mx-details-h">Blocked people</h3>
        {blocked && !blocked.length && <p className="mx-hint">You haven't blocked anyone.</p>}
        <ul className="mx-rows">
          {(blocked ?? []).map((p) => (
            <li key={p.id}>
              <Avatar name={p.name} size="xs" />
              <span>{p.name}</span>
              <button type="button" className="mx-pill" onClick={() => void unblock(p)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>

        <h3 className="mx-details-h">Your files</h3>
        {profile && (
          <div className="mx-meter" aria-label={`${fileSize(used)} of 50 MB used`}>
            <div className="mx-meter-bar">
              <span style={{ width: `${Math.min(100, (used / QUOTA) * 100)}%` }} />
            </div>
            <p className="mx-hint">
              {fileSize(used)} of 50 MB used. Unsending a photo or file frees its space.
            </p>
          </div>
        )}
        <button type="button" className="mx-link mx-about-link" onClick={onAbout}>
          <DatabaseIcon /> How chat works on our free plan
        </button>
        <div className="dlg-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
