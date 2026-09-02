import { HTMLAttributes } from 'react';

interface CardTitleProps extends HTMLAttributes<HTMLSpanElement> {
  className?: string;
  asChild?: boolean;
}

export default function CardTitle({
  className = '',
  asChild = false,
  children,
  ...props
}: CardTitleProps) {
  const Component = asChild ? 'span' : 'span';
  return (
    <Component className={className} {...props}>
      {children}
    </Component>
  );
}