import { clientInitials } from '@/lib/utils';

interface AvatarProps {
  name: string;
  photoUrl?: string;
  size?: number;
  color?: string;
  className?: string;
}

export function Avatar({ name, photoUrl, size = 32, color = '#0F8F65', className }: AvatarProps) {
  const initials = clientInitials(name || 'Admin');
  const fontSize = size * 0.38;

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`rounded-full object-cover flex-shrink-0 ${className ?? ''}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white flex-shrink-0 ${className ?? ''}`}
      style={{ background: color, width: size, height: size, fontSize }}
    >
      {initials}
    </span>
  );
}

export default Avatar;