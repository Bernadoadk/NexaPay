export type QuoteStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type Plan = 'FREE' | 'PRO' | 'BUSINESS';
export type Role = 'USER' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  companyName?: string;
  phone?: string;
  phoneCountry?: string;
  address?: string;
  ifu?: string;
  rccm?: string;
  logoUrl?: string;
  quoteLogoUrl?: string;
  useProfilePhotoAsLogo?: boolean;
  plan?: Plan;
  planExpiresAt?: string;
  planInterval?: 'monthly' | 'annual';
  aiCredits?: number;
  isEmailVerified?: boolean;
  role?: Role;
  blocked?: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    quotes?: number;
    activityLogs?: number;
  };
}

export interface AnalyticsStats {
  users: {
    total: number;
    activeToday: number;
    newToday: number;
  };
  quotes: {
    total: number;
    today: number;
  };
  payments: {
    total: number;
    revenue: number;
  };
  plans: Record<string, number>;
  credits: {
    average: number;
    total: number;
    min: number;
    max: number;
  };
  timestamp: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  details: any;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface DashboardStats {
  totalQuotes: number;
  totalClients: number;
  revenue: number;
  revenueGrowth: number;
  pending: number;
  overdueCount: number;
  recentQuotes: any[];
  monthlyRevenue: { month: string; paid: number; sent: number }[];
}