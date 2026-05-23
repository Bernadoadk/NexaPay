import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

const inputBase = 'w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] text-text transition-colors focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft placeholder:text-text-subtle';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ mono, label, error, className, id, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-[12px] font-semibold text-text-muted tracking-[0.01em]">{label}</label>}
      <input
        ref={ref} id={id}
        className={cn(inputBase, mono && 'font-mono font-num', error && 'border-danger focus:border-danger focus:ring-danger-soft', className)}
        {...props}
      />
      {error && <p className="text-[11.5px] text-danger">{error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, className, id, children, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-[12px] font-semibold text-text-muted">{label}</label>}
      <select
        ref={ref} id={id}
        className={cn(inputBase, 'appearance-none cursor-pointer', className)}
        {...props}
      >
        {children}
      </select>
    </div>
  )
);
Select.displayName = 'Select';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className, id, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={id} className="text-[12px] font-semibold text-text-muted">{label}</label>}
      <textarea
        ref={ref} id={id}
        className={cn('w-full px-3 py-3 rounded-sm border border-border-strong bg-surface text-[14px] text-text transition-colors focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft placeholder:text-text-subtle resize-y min-h-[80px] leading-relaxed', className)}
        {...props}
      />
    </div>
  )
);
Textarea.displayName = 'Textarea';
