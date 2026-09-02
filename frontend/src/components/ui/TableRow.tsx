import { HTMLAttributes } from 'react';

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  className?: string;
}

export default function TableRow({ className = '', children, ...props }: TableRowProps) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
}