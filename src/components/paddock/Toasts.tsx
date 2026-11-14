import type { CallView, PaddockCall } from "./engine/call";
import { CloseIcon } from "./icons";

export function Toasts({ view, call, onOpenChat, onOpenPeople }: { view: CallView; call: PaddockCall; onOpenChat: () => void; onOpenPeople: () => void }) {
  if (!view.toasts.length) return null;
  return (
    <div className="pd-toasts" aria-live="polite">
      {view.toasts.map((t) => (
        <div key={t.id} className={`pd-toast is-${t.kind}`} role={t.kind === "knock" ? "alert" : "status"}>
          {t.kind === "chat" ? (
            <button type="button" className="pd-toast-text is-button" onClick={onOpenChat}>
              {t.text.length > 120 ? `${t.text.slice(0, 117)}…` : t.text}
            </button>
          ) : (
            <span className="pd-toast-text">{t.text}</span>
          )}
          {t.kind === "knock" && t.knockId && view.canManage && (
            <span className="pd-toast-actions">
              <button type="button" className="btn btn-quiet" onClick={() => void call.admit(t.knockId!, false)}>
                Deny
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void call.admit(t.knockId!, true)}>
                Admit
              </button>
              {view.knocks.length > 1 && (
                <button type="button" className="pd-link" onClick={onOpenPeople}>
                  See all {view.knocks.length}
                </button>
              )}
            </span>
          )}
          <button type="button" className="pd-toast-close" aria-label="Dismiss" onClick={() => call.dismissToast(t.id)}>
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function FloatingReactions({ view }: { view: CallView }) {
  return (
    <div className="pd-floaters" aria-hidden="true">
      {view.reactions.map((r, i) => (
        <span key={r.id} className="pd-floater" style={{ ["--x" as string]: `${(i * 37) % 70}px` }}>
          <span className="pd-floater-emoji">{r.emoji}</span>
          <span className="pd-floater-name">{r.name}</span>
        </span>
      ))}
    </div>
  );
}
