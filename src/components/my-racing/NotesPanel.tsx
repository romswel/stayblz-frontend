import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";
interface Note {
  id: string;
  title: string;
  body: string;
  updated_at: string;
}
export default function NotesPanel() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [version, setVersion] = useState(0);
  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setLoadError("");
    api
      .get<{ notes: Note[] }>("/api/my-racing/notes", { signal: c.signal })
      .then((d) => {
        if (!c.signal.aborted) {
          if (!Array.isArray(d.notes))
            throw Error("Your notes could not be loaded.");
          setNotes(d.notes);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setLoadError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [version]);
  function clear() {
    setError("");
    setId(null);
    setTitle("");
    setBody("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const d = id
        ? await api.patch<{ note: Note }>(`/api/my-racing/notes/${id}`, {
            title,
            body,
          })
        : await api.post<{ note: Note }>("/api/my-racing/notes", {
            title,
            body,
          });
      setNotes((old) => [d.note, ...old.filter((n) => n.id !== d.note.id)]);
      clear();
      setNotice("Note saved to your account.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Your note could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteNote(note: Note) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/api/my-racing/notes/${note.id}/remove`);
      setNotes((old) => old.filter((n) => n.id !== note.id));
      if (id === note.id) clear();
      setRemove(null);
      setNotice("Note deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Note could not be deleted.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mr-notebook">
      <div className="mr-intro">
        <span className="ov-kicker">PRIVATE TO YOUR ACCOUNT</span>
        <h2>My notes</h2>
        <p>
          Save notes about horses, races, or anything you want to remember.
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loadError && (
        <p className="form-error" role="alert">
          {loadError}{" "}
          <button
            className="ws-button"
            onClick={() => setVersion((v) => v + 1)}
          >
            Retry notes
          </button>
        </p>
      )}
      {notice && (
        <p className="ws-notice" role="status">
          {notice}
        </p>
      )}
      <div className="mr-notes-grid">
        <form className="ov-paper mr-note-editor" onSubmit={save}>
          <h3>{id ? "Edit note" : "New note"}</h3>
          <label htmlFor="racing-note-title">Note title</label>
          <input
            id="racing-note-title"
            disabled={busy}
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title"
          />
          <label htmlFor="racing-note-body">Your note</label>
          <textarea
            id="racing-note-body"
            disabled={busy}
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Write your note"
          />
          <div className="mr-actions">
            <span>{body.length}/4,000</span>
            {id && (
              <button className="ws-button" type="button" onClick={clear} disabled={busy}>
                Cancel editing
              </button>
            )}
            <button className="ws-button" disabled={busy || !title.trim()}>
              {busy ? "Saving…" : "Save note"}
            </button>
          </div>
        </form>
        <div className="mr-notes-list">
          {loading ? (
            <p className="ov-paper ov-empty">Loading your notes…</p>
          ) : loadError && !notes.length ? (
            <p className="ov-paper ov-empty">
              Your notebook could not be loaded. Your draft is kept in the
              editor.
            </p>
          ) : !notes.length ? (
            <div className="ov-paper mr-empty">
              <h3>No notes yet.</h3>
              <p>
                Your saved notes will appear here. Only you can see them.
              </p>
            </div>
          ) : (
            notes.map((n) => (
              <article className="ov-paper mr-note" key={n.id}>
                <time>{new Date(n.updated_at).toLocaleDateString()}</time>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
                <div className="mr-actions">
                  <button
                    className="ws-button"
                    disabled={busy}
                    onClick={() => {
                      setId(n.id);
                      setTitle(n.title);
                      setBody(n.body);
                    }}
                  >
                    Edit {n.title}
                  </button>
                  <button
                    className="ws-button"
                    disabled={busy}
                    onClick={() => setRemove(remove === n.id ? null : n.id)}
                  >
                    Delete {n.title}
                  </button>
                </div>
                {remove === n.id && (
                  <div className="mr-delete-confirm">
                    <p>Delete this note permanently?</p>
                    <button
                      className="ws-button"
                      disabled={busy}
                      onClick={() => void deleteNote(n)}
                    >
                      Confirm delete
                    </button>
                    <button
                      className="ws-button"
                      onClick={() => setRemove(null)}
                    >
                      Keep note
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
          <p className="ov-footnote">Showing your most recent 100 notes.</p>
        </div>
      </div>
    </section>
  );
}
