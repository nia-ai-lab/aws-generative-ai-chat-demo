import { X } from 'lucide-react';
import type { PropsWithChildren } from 'react';

interface DialogProps extends PropsWithChildren {
  open: boolean;
  title: string;
  onClose: () => void;
}

export function Dialog({ open, title, onClose, children }: DialogProps) {
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
          <button className="icon-button" type="button" aria-label="閉じる" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
