import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export default function Card({ padding = true, className, children, ...props }: CardProps) {
  return (
    <div
      className={`${padding && 'p-[18px]'} bg-surface border border-border rounded shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}