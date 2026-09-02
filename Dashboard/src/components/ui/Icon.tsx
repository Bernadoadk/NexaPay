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
export const UsersIcon = (p: IconProps) => <Icon {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.5c2.6.4 5 2.6 5 5"/></Icon>;
export const BarChart3Icon = (p: IconProps) => <Icon {...p}><path d="M3 3h18"/><path d="M7 5h4"/><path d="M7 10h4"/><path d="M7 15h4"/></Icon>;
export const SettingsIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9 1.7 1.7 0 0 0 4.3 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1c0 .6.4 1.2 1 1.5a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.5.2 1 .7 1 1.5"/></Icon>;
export const LogOutIcon = (p: IconProps) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1 2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Icon>;
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>;
export const Sparkles = (p: IconProps) => <Icon {...p}><path d="M12 2l2.4 5.6M12 20.4l2.4-5.6M5.2 12l5.6 2.4M18.8 12l-5.6 2.4M6.8 7.2l6.8 6.8M14.8 16.4l-6.8-6.8M6.8 16.4l6.8-6.8M14.8 7.2l-6.8 6.8"/></Icon>;
export const ChevronDownIcon = (p: IconProps) => <Icon {...p}><path d="m6 9 6 6-6 6"/></Icon>;
export const MoreIcon = (p: IconProps) => <Icon {...p} fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></Icon>;
export const DownloadIcon = (p: IconProps) => <Icon {...p}><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></Icon>;
export const XIcon = (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12"/></Icon>;
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>;

export const BellIcon = (p: IconProps) => <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>;
export const ClipboardListIcon = (p: IconProps) => <Icon {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/><path d="M9 12h6M9 16h6"/></Icon>;

export const ArrowUpIcon = (p: IconProps) => <Icon {...p}><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></Icon>;
export const ArrowDownIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></Icon>;
export const SearchIcon = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>;
export const WalletIcon = (p: IconProps) => <Icon {...p}><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2"/><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/><path d="M21 10h-4a2 2 0 0 0 0 4h4z"/></Icon>;
export const ReceiptIcon = (p: IconProps) => <Icon {...p}><path d="M5 3v18l2-1.4 2 1.4 2-1.4 2 1.4 2-1.4 2 1.4V3z"/><path d="M9 8h6M9 12h6"/></Icon>;
export const AlertCircleIcon = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.01"/></Icon>;
export const CheckIcon = (p: IconProps) => <Icon {...p}><path d="m4 12 5.5 5.5L20 7"/></Icon>;
export const TrendingUpIcon = (p: IconProps) => <Icon {...p}><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></Icon>;

// Re-export from lucide-react for consistency with main app
export { AlertTriangle, X as LucideX, UserPlus, BarChart3, PieChart, ClipboardList, RefreshCw } from 'lucide-react';