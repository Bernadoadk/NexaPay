import { HTMLAttributes } from 'react';

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  className?: string;
}

export default function Table({ className = '', children, ...props }: TableProps) {
  return (
    <table className={className} {...props}>
      {children}
    </table>
  );
}