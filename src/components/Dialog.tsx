import { useEffect, type PropsWithChildren, type ReactNode } from 'react';

interface DialogProps extends PropsWithChildren {
  open: boolean;
  title: string;
  onClose: () => void;
  headerActions: ReactNode;
}

export function Dialog({ open, title, onClose, headerActions, children }: DialogProps) {
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <div className="dialog-header-actions">{headerActions}</div>
        </header>
        {children}
      </section>
    </div>
  );
}
