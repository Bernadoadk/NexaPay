import { HTMLAttributes } from 'react';

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export default function CardContent({ className = '', children, ...props }: CardContentProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}