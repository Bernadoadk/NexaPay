import { clientInitials } from '@/lib/utils';

interface AvatarProps {
  name: string;
  photoUrl?: string;
  color?: string;
  size?: number;
  className?: string;
}

export default function Avatar({ name, photoUrl, color = '#0F8F65', size = 32, className }: AvatarProps) {
  const initials = clientInitials(name);
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
