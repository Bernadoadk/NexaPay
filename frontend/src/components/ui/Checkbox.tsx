import { InputHTMLAttributes, forwardRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className, id, ...props }, ref) => {
    const inputId = id || `checkbox-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
      <label htmlFor={inputId} className={cn('group flex cursor-pointer items-start gap-3', className)}>
        <span className="relative mt-0.5 h-5 w-5 flex-shrink-0">
          <input ref={ref} id={inputId} type="checkbox" className="peer sr-only" {...props} />
          <span className="absolute inset-0 grid place-items-center rounded-sm border border-border-strong bg-surface text-transparent transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-3 peer-focus-visible:ring-primary-soft peer-disabled:opacity-50">
            <Check size={13} strokeWidth={2.5} />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-text">{label}</span>
          {description && <span className="mt-0.5 block text-[11.5px] leading-snug text-text-muted">{description}</span>}
        </span>
      </label>
    );
  },
);

Checkbox.displayName = 'Checkbox';
export default Checkbox;
