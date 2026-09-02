import { cn } from '@/lib/utils';

export const Image = ({
  src,
  alt,
  className,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) => (
  <img
    src={src}
    alt={alt}
    className={cn(
      'rounded-t-lg',
      className
    )}
    {...props}
  />
);