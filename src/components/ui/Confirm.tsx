import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import Modal from "../Modal";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  /** Button text for "yes". Say what happens: "Log out", "Delete post". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for anything that removes data or can't be undone. */
  tone?: "default" | "danger";
}

type Ask = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ask | null>(null);

/**
 * App-wide confirmation dialog. Use `const confirm = useConfirm()` then
 * `if (!(await confirm({ title: "Log out?", confirmLabel: "Log out" }))) return;`
 * Cancel is focused first, so pressing Enter by accident never confirms.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<(ConfirmOptions & { id: number }) | null>(null);
  const counter = useRef(0);
  const resolver = useRef<((answer: boolean) => void) | null>(null);
  const ask = useCallback<Ask>(
    (options) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setRequest({ ...options, id: ++counter.current });
      }),
    [],
  );
  const answer = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  };
  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {request && (
        <Modal
          // A new question gets a fresh dialog (focus goes to its Cancel button again).
          key={request.id}
          label={request.title}
          role="alertdialog"
          className="modal-sm"
          describedBy={request.message ? "dlg-confirm-text" : undefined}
          onClose={() => answer(false)}
        >
          <div className={`dlg dlg-confirm${request.tone === "danger" ? " is-danger" : ""}`}>
            <span className="dlg-confirm-icon" aria-hidden="true">
              {request.tone === "danger" ? "!" : "?"}
            </span>
            <h2 className="dlg-title">{request.title}</h2>
            {request.message && (
              <div className="dlg-text" id="dlg-confirm-text">
                {request.message}
              </div>
            )}
            <div className="dlg-actions">
              <button type="button" className="btn btn-quiet" data-autofocus onClick={() => answer(false)}>
                {request.cancelLabel ?? "Cancel"}
              </button>
              <button type="button" className={`btn ${request.tone === "danger" ? "btn-danger" : "btn-primary"}`} onClick={() => answer(true)}>
                {request.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Ask {
  const ask = useContext(ConfirmContext);
  // Outside the provider (tests, isolated renders) fall back to the browser's own prompt.
  return ask ?? (async (options) => window.confirm(options.title));
}
