import { HTMLAttributes } from 'react';

interface TableHeadProps extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

export function TableHead({ className = '', children, ...props }: TableHeadProps) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
}

export default TableHead;