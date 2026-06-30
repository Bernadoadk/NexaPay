import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

export default function Toggle({
  checked,
  onCheckedChange,
  label,
  description,
  className,
  disabled,
  ...props
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'group inline-flex min-h-10 items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'relative h-6 w-11 flex-shrink-0 rounded-full border transition-colors',
          checked ? 'border-primary bg-primary' : 'border-border-strong bg-surface-2',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[20px]' : 'translate-x-0.5',
          )}
        />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-[13px] font-semibold text-text">{label}</span>}
          {description && <span className="mt-0.5 block text-[11.5px] leading-snug text-text-muted">{description}</span>}
        </span>
      )}
    </button>
  );
}
