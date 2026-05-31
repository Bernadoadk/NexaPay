import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Button from '@/components/ui/Button';
import { AlertCircleIcon, TrashIcon, XIcon } from '@/components/ui/Icon';

type ConfirmTone = 'danger' | 'warning';

export interface ConfirmDialogOptions {
  title: string;
  description: string;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface ConfirmDialogProps extends Required<Pick<ConfirmDialogOptions, 'title' | 'description'>> {
  eyebrow?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: ConfirmTone;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  title,
  description,
  eyebrow,
  confirmLabel,
  cancelLabel,
  tone,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const Icon = tone === 'danger' ? TrashIcon : AlertCircleIcon;
  const toneClasses = tone === 'danger'
    ? 'bg-danger-soft text-danger border-danger/20'
    : 'bg-warn-soft text-warn border-warn/25';

  useEffect(() => {
    confirmRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full sm:max-w-[440px] bg-surface border border-border shadow-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-2xl border grid place-items-center flex-shrink-0 ${toneClasses}`}>
              <Icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              {eyebrow && (
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted mb-1">
                  {eyebrow}
                </div>
              )}
              <h2 id="confirm-dialog-title" className="text-[17px] sm:text-[18px] font-semibold tracking-[-0.01em] text-text">
                {title}
              </h2>
              <p id="confirm-dialog-description" className="mt-2 text-[13.5px] leading-relaxed text-text-muted">
                {description}
              </p>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onCancel}
              className="w-8 h-8 -mt-1 -mr-1 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-2"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 bg-surface-2 border-t border-border flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-[max(env(safe-area-inset-bottom),1rem)] sm:pb-4">
          <Button type="button" variant="secondary" onClick={onCancel} className="w-full sm:w-auto">
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            className="w-full sm:w-auto"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function useConfirmDialog(): {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  confirmDialog: ReactNode;
} {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const close = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((nextOptions: ConfirmDialogOptions) => {
    setOptions(nextOptions);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  useEffect(() => () => {
    resolverRef.current?.(false);
  }, []);

  const confirmDialog = options ? (
    <ConfirmDialog
      title={options.title}
      description={options.description}
      eyebrow={options.eyebrow}
      confirmLabel={options.confirmLabel ?? 'Confirmer'}
      cancelLabel={options.cancelLabel ?? 'Annuler'}
      tone={options.tone ?? 'danger'}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  ) : null;

  return { confirm, confirmDialog };
}
