import { useEffect } from 'react';
import { DownloadIcon, XIcon } from '@/components/ui/Icon';
import { usePwaInstall } from '@/hooks/usePwaInstall';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PwaInstallSheet({ open, onClose }: Props) {
  const { canInstall, install, isAndroid, isIos, isInstalled, needsIosInstructions } = usePwaInstall();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  async function handleInstall() {
    const accepted = await install();
    if (accepted) onClose();
  }

  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-200 ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="absolute inset-0 bg-text/45" onClick={onClose} aria-hidden />

      <div
        className={`absolute left-0 right-0 bottom-0 bg-surface rounded-t-2xl border-t border-border shadow-[0_-12px_32px_rgba(0,0,0,0.18)] transition-transform duration-250 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-label="Installer NexaPay"
      >
        <div className="flex items-center justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="px-4 pt-2 pb-3 flex items-start gap-3 border-b border-border">
          <span className="w-10 h-10 rounded-xl bg-primary-soft text-primary-hover flex items-center justify-center flex-shrink-0">
            <DownloadIcon size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-[16px] font-semibold tracking-tight text-text">Installer NexaPay</h2>
            <p className="text-[12.5px] text-text-muted mt-0.5 leading-snug">
              Ajoutez l'app sur l'ecran d'accueil pour l'ouvrir comme une application.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted"
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="px-4 py-4">
          {isInstalled ? (
            <div className="rounded-lg border border-primary-soft-2 bg-primary-soft px-3 py-3 text-[13px] font-medium text-primary-hover">
              NexaPay est deja installe sur cet appareil.
            </div>
          ) : canInstall && isAndroid ? (
            <button
              onClick={handleInstall}
              className="w-full h-11 rounded-xl bg-primary text-white text-[14px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <DownloadIcon size={17} />
              Installer l'application
            </button>
          ) : needsIosInstructions || isIos ? (
            <div className="space-y-3">
              <Step number="1" title="Ouvrez dans Safari" text="L'ajout a l'ecran d'accueil fonctionne depuis Safari sur iPhone." />
              <Step number="2" title="Touchez Partager" text="Appuyez sur l'icone de partage en bas de l'ecran." />
              <Step number="3" title="Choisissez Ajouter a l'ecran d'accueil" text="Validez le nom NexaPay, puis touchez Ajouter." />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-3 text-[13px] text-text-muted leading-snug">
              Si votre navigateur affiche l'option d'installation, utilisez le menu du navigateur pour ajouter NexaPay.
            </div>
          )}
        </div>

        <div className="h-[max(env(safe-area-inset-bottom),20px)]" />
      </div>
    </div>
  );
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-7 h-7 rounded-full bg-surface-2 border border-border text-[12px] font-semibold text-text flex items-center justify-center flex-shrink-0">
        {number}
      </span>
      <div className="min-w-0 leading-snug">
        <div className="text-[13.5px] font-semibold text-text">{title}</div>
        <div className="text-[12.5px] text-text-muted mt-0.5">{text}</div>
      </div>
    </div>
  );
}
