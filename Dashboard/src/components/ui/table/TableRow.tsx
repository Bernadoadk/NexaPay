export const TableRow = (
  { className, children, ...props }:
  {
    className?: string;
    children: React.ReactNode;
  } & React.HTMLAttributes<HTMLTableRowElement>
) => (
  <tr
    className={className}
    {...props}
  >
    {children}
  </tr>
);