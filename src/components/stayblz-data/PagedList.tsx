import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Empty, Skeletons } from "../community/ui";
import type { Page } from "./api";
import { errorText } from "./detail";

/** Loads the first page, then the next one whenever the end of the list scrolls near (with a button as a fallback). */
export default function PagedList<T, P extends Page<T> = Page<T>>({
  load,
  idOf,
  render,
  noun,
  empty,
  emptyHint = "Try another track or search.",
  onPage,
  className,
}: {
  load: (offset: number, signal: AbortSignal) => Promise<P>;
  idOf: (item: T) => string;
  render: (item: T) => ReactNode;
  noun: string;
  empty: string;
  emptyHint?: ReactNode;
  /** Every page as it arrives (for anything else the list's answer carries). */
  onPage?: (page: P) => void;
  className?: string;
}) {
  const [items, setItems] = useState<T[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const fetchPage = useCallback(
    async (offset: number) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      const ctrl = new AbortController();
      controller.current = ctrl;
      try {
        const page = await loadRef.current(offset, ctrl.signal);
        if (ctrl.signal.aborted) return;
        onPageRef.current?.(page);
        setItems((prev) => {
          const base = offset === 0 ? [] : (prev ?? []);
          const seen = new Set(base.map(idOf));
          return [...base, ...page.records.filter((r) => !seen.has(idOf(r)))];
        });
        setNext(page.nextOffset);
        setTotal(page.total);
        setError("");
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setError(errorText(e, `The ${noun} couldn't be loaded.`));
        setItems((prev) => prev ?? []);
      } finally {
        if (controller.current === ctrl) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [idOf, noun],
  );

  useEffect(() => {
    void fetchPage(0);
    return () => {
      controller.current?.abort();
      controller.current = null;
      busy.current = false;
    };
    // The list is remounted (by key) when the tab, track or search changes.
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || next === null || error) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void fetchPage(next), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, error, fetchPage, items]);

  if (items === null) return <Skeletons kind="card" count={6} />;
  if (!items.length)
    return error ? (
      <div className="cm-error" role="alert">
        {error}{" "}
        <button type="button" className="cm-link" onClick={() => void fetchPage(0)}>
          Try again
        </button>
      </div>
    ) : (
      <Empty title={empty}>
        <p>{emptyHint}</p>
      </Empty>
    );

  return (
    <section className="sd-list" aria-label={noun}>
      <p className="sd-count" role="status">
        Showing {items.length} of {total} {noun}
      </p>
      <div className={`cm-grid sd-grid${className ? ` ${className}` : ""}`}>
        {items.map((item) => (
          <div key={idOf(item)}>{render(item)}</div>
        ))}
      </div>
      {error && (
        <p className="cm-error" role="alert">
          {error}
        </p>
      )}
      {next !== null && (
        <div ref={sentinel} className="sd-more">
          <button type="button" className="cm-btn cm-more" disabled={loading} onClick={() => void fetchPage(next)}>
            {loading ? "Loading…" : error ? "Try again" : `Load more ${noun}`}
          </button>
        </div>
      )}
    </section>
  );
}
