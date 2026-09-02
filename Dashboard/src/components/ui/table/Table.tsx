import { cn } from '@/lib/utils';

export const Table = (
  { className, children, ...props }:
  {
    className?: string;
    children: React.ReactNode;
  } & React.TableHTMLAttributes<HTMLTableElement>
) => (
  <table
    className={cn(
      'w-full text-sm text-left rtl:text-right border-border',
      className
    )}
    {...props}
  >
    {children}
  </table>
);