import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export default function Card({ padding = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn('bg-surface border border-border rounded shadow-sm', padding && 'p-[18px]', className)}
      {...props}
    >
      {children}
    </div>
  );
}
