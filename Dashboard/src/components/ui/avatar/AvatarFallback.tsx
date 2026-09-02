import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

interface AvatarFallbackProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const AvatarFallback = ({ className, ...props }: AvatarFallbackProps) => (
  <div
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-primary text-white',
      className
    )}
    {...props}
  />
);