import Button from '@/components/ui/Button';
import { ClockIcon, XIcon } from '@/components/ui/Icon';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AiComingSoonDialog({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-coming-soon-title"
        aria-describedby="ai-coming-soon-description"
        className="w-full sm:max-w-[420px] bg-surface border border-border shadow-2xl rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl border border-primary/20 bg-primary-soft text-primary-hover grid place-items-center flex-shrink-0">
              <ClockIcon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted mb-1">
                Disponible bientôt
              </div>
              <h2 id="ai-coming-soon-title" className="text-[17px] sm:text-[18px] font-semibold tracking-[-0.01em] text-text">
                Fonctionnalité IA en préparation
              </h2>
              <p id="ai-coming-soon-description" className="mt-2 text-[13.5px] leading-relaxed text-text-muted">
                Nous finalisons l'activation des services IA afin de garantir une expérience fiable. Cette option sera disponible prochainement.
              </p>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              className="w-8 h-8 -mt-1 -mr-1 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-2"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-4 bg-surface-2 border-t border-border flex justify-end pb-[max(env(safe-area-inset-bottom),1rem)] sm:pb-4">
          <Button type="button" variant="primary" onClick={onClose} className="w-full sm:w-auto">
            D'accord
          </Button>
        </div>
      </div>
    </div>
  );
}
