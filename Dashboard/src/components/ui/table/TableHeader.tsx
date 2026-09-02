export const TableHeader = (
  { className, children, ...props }:
  {
    className?: string;
    children: React.ReactNode;
  } & React.HTMLAttributes<HTMLTableSectionElement>
) => (
  <thead
    className={className}
    {...props}
  >
    {children}
  </thead>
);