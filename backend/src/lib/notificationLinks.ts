/**
 * Destination d'une notification dans l'application.
 *
 * Partagé par le Web Push (clic sur la notification système) et repris à
 * l'identique côté front pour le clic dans la liste — les deux doivent mener
 * au même endroit.
 */
export function notificationLink(type: string, data: any = {}): string {
  const quoteId = typeof data?.quoteId === 'string' ? data.quoteId : null;

  switch (type) {
    case 'payment_received':
    case 'quote_sent':
    case 'quote_expiring':
      return quoteId ? `/quotes/${quoteId}` : '/quotes';

    case 'order_received':
      return '/store';

    case 'stock_out':
      return '/store';

    case 'payout_completed':
    case 'payout_failed':
      return '/payouts';

    case 'new_client':
      return typeof data?.clientId === 'string' ? '/clients' : '/clients';

    case 'credits_low':
    case 'credits_empty':
    case 'credits_updated':
    case 'subscription_expiring':
    case 'subscription_expired':
    case 'subscription_updated':
      return '/pricing';

    case 'feedback_received':
    case 'account_blocked':
    default:
      return '/';
  }
}
