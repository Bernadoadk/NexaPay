import { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
}

function Icon({ size = 20, strokeWidth = 1.6, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0 }}
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => <Icon {...p}><path d="M3 10.5 12 4l9 6.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/></Icon>;
export const FileIcon = (p: IconProps) => <Icon {...p}><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/></Icon>;
export const UsersIcon = (p: IconProps) => <Icon {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.5c2.6.4 5 2.6 5 5"/></Icon>;
export const SettingsIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9 1.7 1.7 0 0 0 4.3 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1c0 .6.4 1.2 1 1.5a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.5.2 1 .7 1 1.5"/></Icon>;
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>;
export const MinusIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14"/></Icon>;
export const SearchIcon = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>;
export const DownloadIcon = (p: IconProps) => <Icon {...p}><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></Icon>;
export const SendIcon = (p: IconProps) => <Icon {...p}><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></Icon>;
export const BellIcon = (p: IconProps) => <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>;
export const TrashIcon = (p: IconProps) => <Icon {...p}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></Icon>;
export const ArrowUpIcon = (p: IconProps) => <Icon {...p}><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></Icon>;
export const ArrowDownIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14"/><path d="m5 12 7 7 7-7"/></Icon>;
export const ArrowRightIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></Icon>;
export const ChevronDownIcon = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>;
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>;
export const ChevronLeftIcon = (p: IconProps) => <Icon {...p}><path d="m15 6-6 6 6 6"/></Icon>;
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="M20 6 9 17l-5-5"/></Icon>;
export const MoreIcon = (p: IconProps) => <Icon {...p} fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></Icon>;
export const FilterIcon = (p: IconProps) => <Icon {...p}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></Icon>;
export const WalletIcon = (p: IconProps) => <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h15v-5"/><path d="M21 9h-5a2 2 0 0 0 0 5h5z"/></Icon>;
export const ReceiptIcon = (p: IconProps) => <Icon {...p}><path d="M5 3v18l3-2 3 2 3-2 3 2 2-2V3z"/><path d="M9 8h7M9 12h7M9 16h4"/></Icon>;
export const PhoneIcon = (p: IconProps) => <Icon {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/></Icon>;
export const MailIcon = (p: IconProps) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></Icon>;
export const CalendarIcon = (p: IconProps) => <Icon {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></Icon>;
export const EditIcon = (p: IconProps) => <Icon {...p}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></Icon>;
export const EyeIcon = (p: IconProps) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Icon>;
export const CopyIcon = (p: IconProps) => <Icon {...p}><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Icon>;
export const XIcon = (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12"/></Icon>;
export const LogOutIcon = (p: IconProps) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Icon>;
export const AlertCircleIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></Icon>;
export const CheckCircleIcon = (p: IconProps) => <Icon {...p}><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4 12 14l-3-3"/></Icon>;
export const ClockIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></Icon>;

export const SunIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></Icon>;
export const MoonIcon = (p: IconProps) => <Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Icon>;
export const MonitorIcon = (p: IconProps) => <Icon {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></Icon>;

export const LogoIcon = ({ size = 20, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }} {...props}>
    <path d="M4 4h10a8 8 0 0 1 8 8 8 8 0 0 1-8 8H4z" fill="currentColor" opacity="0.18"/>
    <path d="M4 4h7a8 8 0 0 1 8 8 8 8 0 0 1-8 8H4z" fill="currentColor"/>
  </svg>
);
