import { HTMLAttributes } from 'react';

interface TableHeadProps extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

export default function TableHead({ className = '', children, ...props }: TableHeadProps) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
}