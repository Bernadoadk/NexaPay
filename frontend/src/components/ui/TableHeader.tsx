import { HTMLAttributes } from 'react';

interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

export default function TableHeader({ className = '', children, ...props }: TableHeaderProps) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
}