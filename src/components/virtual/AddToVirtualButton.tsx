import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api";
import { useWorkspace } from "../../workspace";
import { useVirtualApis, virtualHorsePath, type VirtualApi, type VirtualMode } from "./api";
import type { IndexCode } from "../stayblz-data/formfavApi";
import "./virtual.css";

type Target =
  | { communityHorseId: string; racingHorseId?: undefined; formfav?: undefined }
  | { racingHorseId: string; communityHorseId?: undefined; formfav?: undefined }
  /** A race-data horse (Stayblz Data → Horses): added to the list's Racing horses tab. */
  | { formfav: { name: string; code: IndexCode }; communityHorseId?: undefined; racingHorseId?: undefined };
type RowState = { status: "loading" | "ready" | "saving" | "error"; added: boolean; id: string | null; error: string };

const fresh: RowState = { status: "loading", added: false, id: null, error: "" };

/**
 * "Track in Virtual Stayblz": opens a small panel to add this horse to your private list and/or the active
 * stable's shared list. Each row shows whether the horse is already there (with a link to open it), and only
 * says "Added" once the server has saved it.
 */
export default function AddToVirtualButton({ target, name, compact = false }: { target: Target; name: string; compact?: boolean }) {
  const apis = useVirtualApis();
  const { active } = useWorkspace();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const targetKey = target.communityHorseId ?? target.racingHorseId ?? (target.formfav ? `${target.formfav.code}|${target.formfav.name}` : "");
  const rows: { mode: VirtualMode; label: string; hint: string; client: VirtualApi }[] = [
    { mode: "personal", label: "My Virtual Stayblz", hint: "Only you can see it", client: apis.personal },
    ...(active
      ? [{ mode: "stable" as const, label: `Team · ${active.name}`, hint: "Shared with your stable", client: apis.stable }]
      : []),
  ];
  const [state, setState] = useState<Record<string, RowState>>({});
  const generation = useRef(0);

  // Each time the panel opens (or the horse / active stable changes while it's open), check both lists afresh;
  // the generation guard drops answers from an earlier check or an add that finished after a switch.
  useEffect(() => {
    const g = ++generation.current;
    setState({});
    if (!open) return;
    const c = new AbortController();
    for (const row of rows) {
      row.client
        .state(target, c.signal)
        .then((r) => {
          if (g === generation.current && !c.signal.aborted)
            setState((s) => ({ ...s, [row.mode]: { status: "ready", added: r.added, id: r.id, error: "" } }));
        })
        .catch((e) => {
          if (g === generation.current && !c.signal.aborted)
            setState((s) => ({ ...s, [row.mode]: { ...fresh, status: "error", error: e instanceof Error ? e.message : "Couldn't check this list." } }));
        });
    }
    return () => c.abort();
  }, [open, targetKey, active?.id]);

  async function add(mode: VirtualMode, client: VirtualApi) {
    const g = generation.current;
    setState((s) => ({ ...s, [mode]: { ...(s[mode] ?? fresh), status: "saving", error: "" } }));
    try {
      const r = await client.add(
        target.communityHorseId
          ? { source: "community", communityHorseId: target.communityHorseId }
          : target.formfav
            ? { source: "formfav", formfavName: target.formfav.name, formfavCode: target.formfav.code }
            : { source: "racing", racingHorseId: target.racingHorseId! },
      );
      if (g === generation.current) setState((s) => ({ ...s, [mode]: { status: "ready", added: true, id: r.horse.id, error: "" } }));
    } catch (e) {
      if (g !== generation.current) return;
      if (e instanceof ApiError && e.code === "already_added") {
        const r = await client.state(target).catch(() => null);
        setState((s) => ({ ...s, [mode]: { status: "ready", added: true, id: r?.id ?? null, error: "" } }));
        return;
      }
      setState((s) => ({
        ...s,
        [mode]: { ...(s[mode] ?? fresh), status: "ready", error: e instanceof Error ? e.message : "This horse couldn't be added." },
      }));
    }
  }

  return (
    <div className={`vs-add${compact ? " is-compact" : ""}`}>
      <button
        type="button"
        className="vs-btn vs-add-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        aria-label="Track in Virtual Stayblz"
      >
        <EyeIcon /> {compact ? "Track" : "Track in Virtual Stayblz"}
      </button>
      {open && (
        <div className="vs-add-panel" id={panelId} role="group" aria-label={`Track ${name} in Virtual Stayblz`}>
          {rows.map((row) => {
            const s = state[row.mode] ?? fresh;
            return (
              <div className="vs-add-row" key={row.mode}>
                <span className="vs-add-text">
                  <strong>{row.label}</strong>
                  <small>{row.hint}</small>
                </span>
                {s.status === "loading" ? (
                  <span className="vs-muted" aria-live="polite">Checking…</span>
                ) : s.status === "error" ? (
                  <span className="vs-error-inline" role="alert">{s.error}</span>
                ) : s.added ? (
                  <span className="vs-add-done">
                    <span aria-live="polite">Added ✓</span>
                    {s.id && <Link to={virtualHorsePath(row.mode, s.id, !!target.formfav)}>Open</Link>}
                  </span>
                ) : (
                  <button type="button" className="vs-btn vs-btn-primary" disabled={s.status === "saving"} onClick={() => void add(row.mode, row.client)}>
                    {s.status === "saving" ? "Adding…" : "Add"}
                  </button>
                )}
                {s.error && s.status === "ready" && <p className="vs-error-inline" role="alert">{s.error}</p>}
              </div>
            );
          })}
          {!active && <p className="vs-muted vs-add-foot">Join or create a stable to share horses with your team.</p>}
        </div>
      )}
    </div>
  );
}

export const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
