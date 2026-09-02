import { Image } from '@/components/ui/image';
import { ImgHTMLAttributes } from 'react';

interface AvatarImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  className?: string;
}

export const AvatarImage = ({ src, alt, className, ...props }: AvatarImageProps) => (
  <Image
    src={src}
    alt={alt}
    className={`h-full w-full object-cover ${className || ''}`}
    {...props}
  />
);