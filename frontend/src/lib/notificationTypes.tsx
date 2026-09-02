import type { ComponentType } from 'react';
import {
  AlertCircleIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
  FileIcon,
  ReceiptIcon,
  SendIcon,
  UsersIcon,
  WalletIcon,
} from '@/components/ui/Icon';

/**
 * Registre unique des types de notification.
 *
 * Chaque type émis par le back-end (voir backend/src/lib/notificationEvents.ts)
 * doit avoir une entrée ici : icône, teinte et libellé de catégorie. Un type
 * inconnu retombe sur une valeur neutre plutôt que de casser l'affichage.
 */
export interface NotificationVisual {
  Icon: ComponentType<{ size?: number; className?: string }>;
  /** Couleur du texte de l'icône. */
  tone: string;
  /** Fond de la pastille. */
  bg: string;
  category: string;
}

const REGISTRY: Record<string, NotificationVisual> = {
  payment_received: { Icon: CheckCircleIcon, tone: 'text-primary', bg: 'bg-primary-soft', category: 'Paiement' },
  payout_completed: { Icon: WalletIcon, tone: 'text-primary', bg: 'bg-primary-soft', category: 'Reversement' },
  payout_failed: { Icon: AlertCircleIcon, tone: 'text-danger', bg: 'bg-danger-soft', category: 'Reversement' },
  quote_sent: { Icon: SendIcon, tone: 'text-blue', bg: 'bg-blue-soft', category: 'Devis' },
  quote_expiring: { Icon: ClockIcon, tone: 'text-warn', bg: 'bg-warn-soft', category: 'Devis' },
  order_received: { Icon: ReceiptIcon, tone: 'text-primary', bg: 'bg-primary-soft', category: 'Boutique' },
  stock_out: { Icon: AlertCircleIcon, tone: 'text-warn', bg: 'bg-warn-soft', category: 'Boutique' },
  new_client: { Icon: UsersIcon, tone: 'text-blue', bg: 'bg-blue-soft', category: 'Client' },
  credits_low: { Icon: AlertCircleIcon, tone: 'text-warn', bg: 'bg-warn-soft', category: 'Crédits IA' },
  credits_empty: { Icon: AlertCircleIcon, tone: 'text-danger', bg: 'bg-danger-soft', category: 'Crédits IA' },
  credits_updated: { Icon: WalletIcon, tone: 'text-blue', bg: 'bg-blue-soft', category: 'Crédits IA' },
  subscription_expiring: { Icon: ClockIcon, tone: 'text-warn', bg: 'bg-warn-soft', category: 'Abonnement' },
  subscription_expired: { Icon: AlertCircleIcon, tone: 'text-danger', bg: 'bg-danger-soft', category: 'Abonnement' },
  subscription_updated: { Icon: CheckCircleIcon, tone: 'text-primary', bg: 'bg-primary-soft', category: 'Abonnement' },
  account_blocked: { Icon: AlertCircleIcon, tone: 'text-danger', bg: 'bg-danger-soft', category: 'Compte' },
  feedback_received: { Icon: FileIcon, tone: 'text-blue', bg: 'bg-blue-soft', category: 'Support' },
};

const FALLBACK: NotificationVisual = {
  Icon: BellIcon,
  tone: 'text-text-muted',
  bg: 'bg-surface-2',
  category: 'Notification',
};

export function notificationVisual(type: string): NotificationVisual {
  return REGISTRY[type] ?? FALLBACK;
}

/**
 * Destination du clic. Le back-end renvoie déjà `link` ; cette fonction sert de
 * repli pour les notifications reçues par WebSocket, qui ne le portent pas.
 * Doit rester alignée sur backend/src/lib/notificationLinks.ts.
 */
export function notificationLink(type: string, data: Record<string, any> | null): string {
  const quoteId = typeof data?.quoteId === 'string' ? data.quoteId : null;

  switch (type) {
    case 'payment_received':
    case 'quote_sent':
    case 'quote_expiring':
      return quoteId ? `/quotes/${quoteId}` : '/quotes';
    case 'order_received':
    case 'stock_out':
      return '/store';
    case 'payout_completed':
    case 'payout_failed':
      return '/payouts';
    case 'new_client':
      return '/clients';
    case 'credits_low':
    case 'credits_empty':
    case 'credits_updated':
    case 'subscription_expiring':
    case 'subscription_expired':
    case 'subscription_updated':
      return '/pricing';
    default:
      return '/';
  }
}

/** Regroupe par tranche temporelle pour aérer une longue liste. */
export function notificationGroup(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000);

  if (date >= startOfToday) return "Aujourd'hui";
  if (date >= startOfYesterday) return 'Hier';
  if (date >= startOfWeek) return 'Cette semaine';
  return 'Plus ancien';
}
