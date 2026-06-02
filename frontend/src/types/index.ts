export type QuoteStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type Plan = 'FREE' | 'PRO' | 'BUSINESS';

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
}

export interface CreditPack {
  id: string;
  credits: number;
  price: number;
  label: string;
}

export interface CreditBalance {
  aiCredits: number;
  plan: Plan;
  planInterval: 'monthly' | 'annual';
  monthlyQuota: number;
  cap: number;
  packs: CreditPack[];
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: 'signup_bonus' | 'plan_renewal' | 'purchase' | 'ai_use';
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export interface AiGeneratedQuote {
  title: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  aiCredits: number;
}

export interface AiPriceSuggestion {
  min: number;
  max: number;
  average: number;
  currency: string;
  advice: string;
  aiCredits: number;
}

export interface Client {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;         // stored as E.164
  phoneCountry?: string;  // country code e.g. "bj"
  city?: string;
  address?: string;
  ifu?: string;
  color: string;
  quotesCount?: number;
  totalBilled?: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit?: string | null;
  order?: number;
  productId?: string | null;
}

export interface Quote {
  id: string;
  number: string;
  title: string;
  status: QuoteStatus;
  notes?: string;
  taxRate: number;
  discount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  issuedAt: string;
  validDays: number;
  sentAt?: string;
  paidAt?: string;
  paymentRef?: string;
  paymentUrl?: string;
  paidViaLink?: boolean;
  clientId: string;
  client?: Client;
  items?: QuoteItem[];
  user?: User;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  title: string;
  notes?: string | null;
  taxRate: number;
  discount: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  validDays: number;
  usageCount: number;
  lastUsedAt?: string | null;
  items?: QuoteItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price: number;
  unit?: string | null;
  archived: boolean;
  usageCount?: number;
  totalBilled?: number;
  createdAt: string;
}

export type ProductSort = 'name' | 'price-asc' | 'price-desc' | 'used' | 'recent';

export type PayoutStatus = 'PENDING' | 'TRANSFERRING' | 'TRANSFERRED' | 'FAILED';

export interface Payout {
  id: string;
  quoteId: string;
  userId: string;
  grossAmount: number;
  commission: number;
  netAmount: number;
  status: PayoutStatus;
  fedapayTxId?: string | null;
  transferId?: string | null;
  transferredAt?: string | null;
  failReason?: string | null;
  createdAt: string;
  quote?: {
    number: string;
    title: string;
    total: number;
    paidAt?: string | null;
  };
}

export interface DashboardStats {
  totalQuotes: number;
  totalClients: number;
  revenue: number;
  revenueGrowth: number;
  pending: number;
  overdueCount: number;
  recentQuotes: Quote[];
  monthlyRevenue: { month: string; paid: number; sent: number }[];
}
