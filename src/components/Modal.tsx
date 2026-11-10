import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  onClose: () => void;
  children: ReactNode;
  label: string;
  /** "alertdialog" for confirmations that need an answer. */
  role?: 'dialog' | 'alertdialog';
  /** Extra class for the dialog box, e.g. "modal-sm" or "modal-wide". */
  className?: string;
  /** Element (by id) that describes the dialog, for screen readers. */
  describedBy?: string;
}

export default function Modal({ onClose, children, label, role = 'dialog', className, describedBy }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    function onKey(e: KeyboardEvent) {
      // With dialogs on top of each other (menu → "Log out?"), only the top-most one handles keys.
      const dialogs = document.querySelectorAll('.modal');
      if (dialogs[dialogs.length - 1] !== dialogRef.current) return;
      if (e.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        e.preventDefault();
        dialogRef.current?.focus();
      } else if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const preferred = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? focusable()[0] ?? dialogRef.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal panel${className ? ` ${className}` : ''}`}
        ref={dialogRef}
        tabIndex={-1}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-describedby={describedBy}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
