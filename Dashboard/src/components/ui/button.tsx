import { cn } from '@/lib/utils';

export const Button = (
  { variant = 'default', size = 'default', className, children, ...props }:
  {
    variant?: 'default' | 'primary' | 'outline' | 'destructive';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
    children?: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
) => {
  // Size configurations
  const sizeConfig = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 px-3 text-sm',
    lg: 'h-10 px-6 text-lg',
    icon: 'h-8 w-8',
  }[size];

  // Les tokens `*-foreground` et `*-hover` n'existent pas dans la config
  // Tailwind : les classes etaient ignorees, laissant un texte a la couleur
  // heritee sur fond colore (et un survol sans effet sur `outline`).
  const variantConfig = {
    default: 'bg-primary text-white hover:bg-primary-hover',
    primary: 'bg-primary text-white hover:bg-primary-hover',
    outline: 'border border-border bg-surface text-text hover:bg-surface-2 hover:border-border-strong',
    destructive: 'bg-danger text-white hover:opacity-90',
  }[variant];

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        sizeConfig,
        variantConfig,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};