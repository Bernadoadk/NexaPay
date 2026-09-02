import { HTMLAttributes } from 'react';

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export default function CardHeader({ className = '', children, ...props }: CardHeaderProps) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}