import type { ReactNode } from "react";

export const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

/**
 * The one header every Stayblz pop-up uses: optional kicker, title, and a round close button
 * in the same corner. Keeps dialogs consistent (Updates pop-up, cart, menus, confirmations).
 */
export default function DialogHead({
  kicker,
  title,
  onClose,
  closeLabel = "Close",
  titleId,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  titleId?: string;
}) {
  return (
    <div className="dlg-head">
      <div className="dlg-head-text">
        {kicker && <span className="dlg-kicker">{kicker}</span>}
        <h2 className="dlg-title" id={titleId}>
          {title}
        </h2>
      </div>
      {onClose && (
        <button type="button" className="dlg-close" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
