import { HTMLAttributes } from 'react';

interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  className?: string;
}

export default function TableBody({ className = '', children, ...props }: TableBodyProps) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}