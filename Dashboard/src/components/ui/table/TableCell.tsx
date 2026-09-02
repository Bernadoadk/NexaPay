import { HTMLAttributes } from 'react';

interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  className?: string;
}

export function TableCell({ className = '', children, ...props }: TableCellProps) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  );
}

export default TableCell;