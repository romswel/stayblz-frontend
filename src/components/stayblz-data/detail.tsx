import { useEffect, useRef, useState, type ReactNode } from "react";
import Modal from "../Modal";
import { Icon } from "../community/ui";

/** Shared by the Stayblz Data tabs: the detail dialog shell and its load/retry state. */

export const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function useDetail<T>(load: () => Promise<T>) {
  const [state, setState] = useState<{ data: T | null; error: string }>({ data: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let live = true;
    setState({ data: null, error: "" });
    loadRef
      .current()
      .then((data) => live && setState({ data, error: "" }))
      .catch((e) => live && setState({ data: null, error: errorText(e, "This record couldn't be loaded.") }));
    return () => {
      live = false;
    };
  }, [attempt]);
  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

export function DetailShell({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal label={label} onClose={onClose} className="sd-modal">
      <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
        <Icon.Close />
      </button>
      <div className="sd-modal-body">{children}</div>
    </Modal>
  );
}

export function DetailState({ error, retry }: { error: string; retry: () => void }) {
  return error ? (
    <div className="cm-error" role="alert">
      {error}{" "}
      <button type="button" className="cm-link" onClick={retry}>
        Try again
      </button>
    </div>
  ) : (
    <p className="sd-muted" role="status">
      Loading…
    </p>
  );
}
