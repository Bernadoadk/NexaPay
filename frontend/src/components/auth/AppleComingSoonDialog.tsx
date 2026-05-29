interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AppleComingSoonDialog({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 bg-text/45"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apple-coming-soon-title"
        className="relative w-full max-w-[360px] rounded-2xl border border-border bg-surface p-5 shadow-[0_18px_55px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-soft text-primary-hover flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-hover">
              Disponible bientot
            </p>
            <h2 id="apple-coming-soon-title" className="mt-1 text-[18px] font-bold tracking-tight text-text">
              Connexion Apple en preparation
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
              Cette option sera activee des que le compte developpeur Apple sera pret.
              Pour le moment, utilisez Google ou votre adresse e-mail.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-xl bg-primary text-white text-[14px] font-semibold hover:bg-primary-hover active:scale-[0.98] transition-all"
        >
          Compris
        </button>
      </div>
    </div>
  );
}
