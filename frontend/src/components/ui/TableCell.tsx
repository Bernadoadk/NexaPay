import { HTMLAttributes } from 'react';

interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  className?: string;
}

export default function TableCell({ className = '', children, ...props }: TableCellProps) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  );
}