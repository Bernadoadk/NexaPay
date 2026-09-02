import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LucideX } from '@/components/ui/Icon';

/**
 * Boîtes de dialogue du back-office.
 *
 * Reprend le langage visuel du ConfirmDialog de l'application cliente (même
 * palette, même structure entête / corps / pied) pour que l'admin ne change pas
 * d'univers. Remplace les `window.confirm` / `window.prompt`, inutilisables
 * pour des actions sensibles : pas de contexte, pas de validation, pas de style.
 */
type Tone = 'danger' | 'primary';

interface BaseOptions {
  title: string;
  description: string;
  eyebrow?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

export interface ConfirmOptions extends BaseOptions {}

export interface PromptOptions extends BaseOptions {
  label: string;
  placeholder?: string;
  defaultValue?: string;
  /** `number` borne la saisie et renvoie une valeur numérique valide. */
  type?: 'text' | 'number';
  min?: number;
  max?: number;
  helpText?: string;
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export interface ChoiceOptions<T extends string> extends BaseOptions {
  options: ChoiceOption<T>[];
  defaultValue?: T;
}

function Shell({
  title,
  description,
  eyebrow,
  tone = 'danger',
  onCancel,
  children,
  footer,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  tone?: Tone;
  onCancel: () => void;
  children?: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const toneClasses =
    tone === 'danger'
      ? 'bg-danger-soft text-danger border-danger/20'
      : 'bg-primary-soft text-primary border-primary/20';

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
        aria-label={title}
        className="w-full sm:max-w-[460px] bg-surface border border-border shadow-lg rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 pb-4">
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-2xl border grid place-items-center flex-shrink-0 ${toneClasses}`}>
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              {eyebrow && (
                <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted mb-1">
                  {eyebrow}
                </div>
              )}
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-text">{title}</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-text-muted">{description}</p>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onCancel}
              className="w-8 h-8 -mt-1 -mr-1 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-2"
            >
              <LucideX size={16} />
            </button>
          </div>

          {children && <div className="mt-4">{children}</div>}
        </div>

        <div className="px-5 sm:px-6 py-4 bg-surface-2 border-t border-border flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  );
}

type Pending =
  | { kind: 'confirm'; options: ConfirmOptions }
  | { kind: 'prompt'; options: PromptOptions }
  | { kind: 'choice'; options: ChoiceOptions<string> };

/**
 * Fournit `confirm`, `prompt` et `choose` sous forme de promesses, plus le
 * nœud à rendre dans la page.
 */
export function useDialogs() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState('');
  const resolverRef = useRef<((result: any) => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback((result: any) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setPending(null);
    setValue('');
  }, []);

  useEffect(() => {
    if (pending?.kind === 'prompt') inputRef.current?.focus();
  }, [pending]);

  useEffect(() => () => resolverRef.current?.(null), []);

  const confirm = useCallback((options: ConfirmOptions) => {
    setPending({ kind: 'confirm', options });
    return new Promise<boolean>((resolve) => {
      resolverRef.current = (r) => resolve(Boolean(r));
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    setValue(options.defaultValue ?? '');
    setPending({ kind: 'prompt', options });
    return new Promise<string | null>((resolve) => {
      resolverRef.current = (r) => resolve(r as string | null);
    });
  }, []);

  const choose = useCallback(<T extends string>(options: ChoiceOptions<T>) => {
    setValue(options.defaultValue ?? options.options[0]?.value ?? '');
    setPending({ kind: 'choice', options: options as ChoiceOptions<string> });
    return new Promise<T | null>((resolve) => {
      resolverRef.current = (r) => resolve(r as T | null);
    });
  }, []);

  let dialog: ReactNode = null;

  if (pending?.kind === 'confirm') {
    const { options } = pending;
    dialog = (
      <Shell
        title={options.title}
        description={options.description}
        eyebrow={options.eyebrow}
        tone={options.tone}
        onCancel={() => close(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)} className="w-full sm:w-auto">
              {options.cancelLabel ?? 'Annuler'}
            </Button>
            <Button
              variant={options.tone === 'primary' ? 'primary' : 'destructive'}
              onClick={() => close(true)}
              className="w-full sm:w-auto"
            >
              {options.confirmLabel ?? 'Confirmer'}
            </Button>
          </>
        }
      />
    );
  }

  if (pending?.kind === 'prompt') {
    const { options } = pending;
    const numeric = options.type === 'number';
    const parsed = numeric ? Number(value) : value.trim();
    const invalid = numeric
      ? !Number.isFinite(parsed as number) ||
        value.trim() === '' ||
        (options.min !== undefined && (parsed as number) < options.min) ||
        (options.max !== undefined && (parsed as number) > options.max)
      : (parsed as string).length === 0;

    dialog = (
      <Shell
        title={options.title}
        description={options.description}
        eyebrow={options.eyebrow}
        tone={options.tone ?? 'primary'}
        onCancel={() => close(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => close(null)} className="w-full sm:w-auto">
              {options.cancelLabel ?? 'Annuler'}
            </Button>
            <Button
              variant={options.tone === 'danger' ? 'destructive' : 'primary'}
              disabled={invalid}
              onClick={() => close(value)}
              className="w-full sm:w-auto"
            >
              {options.confirmLabel ?? 'Valider'}
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5">
            {options.label}
          </span>
          <input
            ref={inputRef}
            type={options.type ?? 'text'}
            value={value}
            min={options.min}
            max={options.max}
            placeholder={options.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !invalid) close(value);
            }}
            className="w-full h-11 px-3.5 rounded-lg border border-border bg-bg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          {options.helpText && (
            <span className="block text-[12px] text-text-muted mt-1.5">{options.helpText}</span>
          )}
        </label>
      </Shell>
    );
  }

  if (pending?.kind === 'choice') {
    const { options } = pending;
    dialog = (
      <Shell
        title={options.title}
        description={options.description}
        eyebrow={options.eyebrow}
        tone={options.tone ?? 'primary'}
        onCancel={() => close(null)}
        footer={
          <>
            <Button variant="outline" onClick={() => close(null)} className="w-full sm:w-auto">
              {options.cancelLabel ?? 'Annuler'}
            </Button>
            <Button
              variant={options.tone === 'danger' ? 'destructive' : 'primary'}
              disabled={!value}
              onClick={() => close(value)}
              className="w-full sm:w-auto"
            >
              {options.confirmLabel ?? 'Appliquer'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          {options.options.map((option) => {
            const active = value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue(option.value)}
                className={`w-full text-left px-3.5 py-3 rounded-lg border transition-colors ${
                  active
                    ? 'bg-primary-soft border-primary'
                    : 'bg-surface-2 border-border hover:border-border-strong'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded-full border-2 grid place-items-center flex-shrink-0 ${
                      active ? 'border-primary' : 'border-border-strong'
                    }`}
                  >
                    {active && <span className="w-2 h-2 rounded-full bg-primary" />}
                  </span>
                  <span className={`text-[13.5px] font-semibold ${active ? 'text-primary-hover' : 'text-text'}`}>
                    {option.label}
                  </span>
                </div>
                {option.hint && (
                  <span className="block text-[12px] text-text-muted mt-1 pl-6">{option.hint}</span>
                )}
              </button>
            );
          })}
        </div>
      </Shell>
    );
  }

  return { confirm, prompt, choose, dialog };
}
