export const TableBody = (
  { className, children, ...props }:
  {
    className?: string;
    children: React.ReactNode;
  } & React.HTMLAttributes<HTMLTableSectionElement>
) => (
  <tbody
    className={className}
    {...props}
  >
    {children}
  </tbody>
);