import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type {
  RacingRecord,
  SectionKey,
} from "../components/landing/useRacingOverview";
function recordPage(value: unknown): {
  records: RacingRecord[];
  nextOffset: number | null;
} {
  const data = value as { records?: unknown; nextOffset?: unknown };
  if (
    !data ||
    !Array.isArray(data.records) ||
    !data.records.every(
      (row) =>
        row &&
        typeof row.id === "string" &&
        typeof row.name === "string" &&
        Object.values(row).every(
          (value) =>
            typeof value === "string" ||
            (typeof value === "number" && Number.isFinite(value)),
        ),
    ) ||
    !(
      data.nextOffset === null ||
      (typeof data.nextOffset === "number" &&
        Number.isSafeInteger(data.nextOffset) &&
        data.nextOffset >= 0)
    )
  )
    throw new Error("The records response was invalid. Please try again.");
  return data as { records: RacingRecord[]; nextOffset: number | null };
}

export default function PublishedRacing({
  title,
  kinds,
}: {
  title: string;
  kinds: SectionKey[];
}) {
  const generation = useRef(0);
  const moreController = useRef<AbortController | null>(null);
  const [kind, setKind] = useState(kinds[0]);
  const [records, setRecords] = useState<RacingRecord[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  useEffect(() => {
    setKind(kinds[0]);
  }, [kinds[0]]);
  useEffect(() => {
    ++generation.current;
    moreController.current?.abort();
    setMore(false);
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setRecords([]);
    setNextOffset(null);
    api
      .get<unknown>(`/api/racing/published/${kind}`, {
        signal: controller.signal,
      })
      .then((response) => {
        const data = recordPage(response);
        if (!controller.signal.aborted) {
          setRecords(data.records);
          setNextOffset(data.nextOffset);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "Records could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      moreController.current?.abort();
    };
  }, [kind]);
  async function loadMore() {
    if (more || nextOffset === null) return;
    const current = generation.current;
    const controller = new AbortController();
    moreController.current = controller;
    setMore(true);
    setError("");
    try {
      const data = recordPage(
        await api.get<unknown>(
          `/api/racing/published/${kind}?offset=${nextOffset}`,
          { signal: controller.signal },
        ),
      );
      if (current !== generation.current || controller.signal.aborted) return;
      setRecords((old) => [
        ...old,
        ...data.records.filter(
          (row) => !old.some((item) => item.id === row.id),
        ),
      ]);
      setNextOffset(data.nextOffset);
    } catch (reason) {
      if (current === generation.current && !controller.signal.aborted)
        setError(
          reason instanceof Error
            ? reason.message
            : "More records could not be loaded.",
        );
    } finally {
      if (current === generation.current && !controller.signal.aborted)
        setMore(false);
    }
  }
  const fields = (
    [
      "name",
      "track",
      "date",
      "time",
      "race",
      "distance",
      "surface",
      "runners",
      "starts",
      "wins",
      "figure",
      "margin",
      "detail",
      "category",
      "summary",
      "body",
    ] as const
  ).filter((field) => records.some((row) => row[field] !== undefined));
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">Published racing records</div>
        <h1>{title}</h1>
      </header>
      {kinds.length > 1 && (
        <div className="tabs">
          {kinds.map((key) => (
            <button
              key={key}
              className={`tab${kind === key ? " active" : ""}`}
              aria-pressed={kind === key}
              onClick={() => setKind(key)}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="loading">Loading records…</div>
      ) : !records.length && !error ? (
        <div className="empty">No records published yet.</div>
      ) : (
        !!records.length && (
          <div className="panel table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {fields.map((field) => (
                    <th key={field}>
                      {field.charAt(0).toUpperCase() + field.slice(1)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id}>
                    {fields.map((field) => (
                      <td key={field}>{row[field] ?? "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {nextOffset !== null && (
        <button className="btn btn-primary" disabled={more} onClick={loadMore}>
          {more ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
