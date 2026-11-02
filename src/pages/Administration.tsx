import { useEffect, useState } from "react";
import { api } from "../api";
export default function Administration() {
  const [stables, setStables] = useState<
    { id: string; name: string; created_at: string }[]
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const c = new AbortController();
    api
      .get<{ stables: typeof stables }>("/api/admin/stables", {
        signal: c.signal,
      })
      .then((d) => {
        if (!c.signal.aborted) setStables(d.stables);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, []);
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Superadmin only</div>
        <h1>Administration</h1>
        <p className="sub">
          Platform stable directory. Private conversations still require
          membership and participation.
        </p>
      </header>
      <section className="panel team-card">
        <h2>Registered stables</h2>
        {error && <p role="alert">{error}</p>}
        {loading ? (
          <p>Loading…</p>
        ) : (
          <ul className="team-list">
            {stables.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong>
                <span>{new Date(s.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
        <p>
          Legacy records are preserved in the superadmin-only legacy API. They
          have not been assigned to customer stables.
        </p>
      </section>
    </>
  );
}
