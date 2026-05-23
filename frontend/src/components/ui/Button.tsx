import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base = 'inline-flex items-center justify-center gap-2 font-medium border border-transparent rounded transition-all duration-100 active:translate-y-px whitespace-nowrap select-none disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_1px_2px_rgba(15,32,28,0.12)]',
  secondary: 'bg-surface text-text border-border-strong hover:bg-surface-2 shadow-sm',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  danger: 'bg-danger text-white hover:opacity-90',
};

const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-[14px] rounded-xl',
  sm: 'h-8 px-3 text-[13px] rounded-sm',
  icon: 'h-9 w-9 p-0 rounded-xl',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, children, className, ...props }, ref) => (
    <button ref={ref} disabled={loading || props.disabled} className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {loading && <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
export default Button;
