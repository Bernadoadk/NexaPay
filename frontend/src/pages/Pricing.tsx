import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, creditsApi, authApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/ui/Button';
import { ChevronLeftIcon } from '@/components/ui/Icon';
import { Check } from 'lucide-react';
import type { CreditPack } from '@/types';

const PLANS = [
  {
    id: 'FREE' as const,
    name: 'Gratuit',
    monthlyPrice: 0,
    description: 'Idéal pour démarrer',
    credits: 10,
    creditsLabel: '10 crédits à l\'inscription',
    features: [
      '5 devis par mois',
      'PDF avec modèles de devis',
      'Gestion des clients',
      'Catalogue produits',
    ],
    missing: ['Lien de paiement Mobile Money', 'Crédits IA mensuels'],
  },
  {
    id: 'PRO' as const,
    name: 'Pro',
    monthlyPrice: 3500,
    description: 'Pour les indépendants actifs',
    credits: 80,
    creditsLabel: '80 crédits IA / mois',
    features: [
      '30 devis par mois',
      'PDF avec modèles de devis',
      'Lien de paiement Mobile Money',
      'Suivi des paiements en temps réel',
      '80 crédits IA / mois',
    ],
    missing: [],
    highlighted: true,
  },
  {
    id: 'BUSINESS' as const,
    name: 'Business',
    monthlyPrice: 9000,
    description: 'Pour les PME',
    credits: 200,
    creditsLabel: '200 crédits IA / mois',
    features: [
      'Devis illimités',
      'PDF avec modèles de devis',
      'Lien de paiement Mobile Money',
      'Suivi des paiements en temps réel',
      '200 crédits IA / mois',
      'Plusieurs collaborateurs (bientôt)',
    ],
    missing: [],
  },
];

const ANNUAL_DISCOUNT = 0.15;

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  );
}

function fmtXOF(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(n);
}

export default function Pricing() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const upgradedParam = searchParams.get('upgraded');
  const creditsPurchased = searchParams.get('credits_purchased');
  const packPurchasedId = searchParams.get('pack');
  const txIdParam = searchParams.get('id');
  const intervalParam = searchParams.get('interval') || 'monthly';
  const [upgrading, setUpgrading] = useState<'PRO' | 'BUSINESS' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (!upgradedParam || !txIdParam) return;
    setConfirming(true);
    paymentsApi
      .confirmUpgrade(txIdParam, upgradedParam, intervalParam)
      .then((res) => {
        updateUser(res.data.user);
        qc.invalidateQueries({ queryKey: ['credits'] });
        qc.invalidateQueries({ queryKey: ['quota'] });
      })
      .catch((err) => { setConfirmError(err.response?.data?.message || 'Erreur de confirmation'); })
      .finally(() => setConfirming(false));
  }, [upgradedParam, txIdParam]);

  // Crédit pack purchase callback (Fedapay → /pricing or /settings?credits_purchased=N&pack=pack_X&id=TX)
  useEffect(() => {
    if (!creditsPurchased || !txIdParam || !packPurchasedId) return;
    setConfirming(true);
    creditsApi
      .confirmPurchase(txIdParam, packPurchasedId)
      .then(async () => {
        const me = await authApi.me();
        updateUser(me.data);
        qc.invalidateQueries({ queryKey: ['credits'] });
      })
      .catch((err) => { setConfirmError(err.response?.data?.message || 'Erreur de confirmation'); })
      .finally(() => setConfirming(false));
  }, [creditsPurchased, txIdParam, packPurchasedId]);
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null);

  const { data: quotaData } = useQuery({
    queryKey: ['quota'],
    queryFn: () => paymentsApi.quota().then(r => r.data),
    enabled: !!user,
  });

  const { data: creditData } = useQuery({
    queryKey: ['credits'],
    queryFn: () => creditsApi.balance().then(r => r.data),
    enabled: !!user,
  });

  const upgradeMutation = useMutation({
    mutationFn: ({ plan, interval }: { plan: 'PRO' | 'BUSINESS'; interval: 'monthly' | 'annual' }) =>
      paymentsApi.upgrade(plan, interval),
    onSuccess: (res) => {
      const { paymentUrl } = res.data;
      if (paymentUrl) window.location.href = paymentUrl;
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: (packId: string) => creditsApi.purchase(packId),
    onSuccess: (res) => {
      const { paymentUrl } = res.data;
      if (paymentUrl) window.location.href = paymentUrl;
    },
  });

  const currentPlan = (user?.plan || 'FREE') as string;

  function getDisplayPrice(monthlyPrice: number) {
    if (monthlyPrice === 0) return 0;
    return interval === 'annual'
      ? Math.round(monthlyPrice * (1 - ANNUAL_DISCOUNT))
      : monthlyPrice;
  }

  function getAnnualTotal(monthlyPrice: number) {
    return Math.round(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT));
  }

  return (
    <div className="h-full overflow-auto scrollbar-thin bg-surface-2">
      <div className="max-w-[960px] mx-auto px-4 lg:px-5 py-5 lg:py-8">
        {/* Back — desktop only (mobile has it in the topbar) */}
        <button
          onClick={() => navigate('/settings')}
          className="hidden lg:flex items-center gap-1 text-[13px] text-text-muted hover:text-text transition-colors mb-6"
        >
          <ChevronLeftIcon size={15} /> Retour aux réglages
        </button>

        {/* Success banners */}
        {upgradedParam && confirming && (
          <div className="mb-6 p-4 bg-[#FEF9C3] border border-[#FDE047] rounded text-[13.5px] text-[#713F12] font-medium">
            Activation du plan <strong>{upgradedParam}</strong> en cours…
          </div>
        )}
        {upgradedParam && !confirming && !confirmError && (
          <div className="mb-6 p-4 bg-[#DCFCE7] border border-[#86EFAC] rounded text-[13.5px] text-[#14532D] font-medium flex items-center gap-2">
            <Check size={16} strokeWidth={2.5} className="flex-shrink-0" />
            <span>Votre plan a été mis à jour vers <strong>{upgradedParam}</strong> — merci !</span>
          </div>
        )}
        {confirmError && (
          <div className="mb-6 p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded text-[13.5px] text-[#7F1D1D] font-medium">
            Erreur d'activation : {confirmError}
          </div>
        )}
        {creditsPurchased && (
          <div className="mb-6 p-4 bg-[#DCFCE7] border border-[#86EFAC] rounded text-[13.5px] text-[#14532D] font-medium flex items-center gap-2">
            <Check size={16} strokeWidth={2.5} className="flex-shrink-0" />
            <span><strong>{creditsPurchased} crédits IA</strong> ajoutés à votre compte !</span>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-6 lg:mb-8">
          <div className="text-[22px] lg:text-[26px] font-semibold tracking-[-0.02em] mb-2">Choisissez votre plan</div>
          <div className="text-text-muted text-[13px] lg:text-[14px]">
            Payez par Mobile Money ou carte bancaire · Annulable à tout moment
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {creditData && (
              <div className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 bg-surface border border-border rounded-full">
                <span className="text-primary"><SparkleIcon /></span>
                <span className="text-text-muted">Crédits IA :</span>
                <strong className="text-text">{creditData.aiCredits}</strong>
              </div>
            )}
            {quotaData && (
              <div className="inline-flex items-center gap-1.5 text-[12.5px] px-3 py-1.5 bg-surface border border-border rounded-full">
                <span className="text-text-muted">Ce mois :</span>
                <strong>{quotaData.quotesThisMonth}</strong>
                <span className="text-text-muted">/ {quotaData.limit} devis</span>
              </div>
            )}
          </div>
        </div>

        {/* Mensuel / Annuel toggle */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-1 p-1 bg-surface border border-border rounded-lg">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-4 py-1.5 rounded text-[13px] font-medium transition-colors ${
                interval === 'monthly'
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setInterval('annual')}
              className={`px-4 py-1.5 rounded text-[13px] font-medium transition-colors flex items-center gap-1.5 ${
                interval === 'annual'
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              Annuel
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                interval === 'annual' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
              }`}>
                -15%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4 items-start">
          {PLANS.map(plan => {
            const isCurrent = plan.id === currentPlan;
            const isHighlighted = plan.highlighted;
            const displayPrice = getDisplayPrice(plan.monthlyPrice);

            return (
              <div
                key={plan.id}
                className={`relative bg-surface rounded border shadow-sm flex flex-col ${
                  isHighlighted ? 'border-primary ring-2 ring-primary-soft' : 'border-border'
                } ${isHighlighted ? 'mt-2 md:mt-0' : ''}`}
              >
                {isHighlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[11px] font-semibold px-3 py-0.5 rounded-full">
                    Recommandé
                  </div>
                )}

                <div className="p-4 lg:p-5 border-b border-border">
                  <div className="text-[12.5px] lg:text-[13px] font-semibold text-text-muted uppercase tracking-[0.04em] mb-1">{plan.name}</div>
                  <div className="flex items-baseline gap-1 mb-1">
                    {plan.monthlyPrice === 0 ? (
                      <span className="text-[22px] lg:text-[26px] font-semibold">Gratuit</span>
                    ) : (
                      <>
                        <span className="text-[22px] lg:text-[26px] font-semibold tracking-[-0.02em]">{fmtXOF(displayPrice)}</span>
                        <span className="text-[12.5px] lg:text-[13px] text-text-muted">/ mois</span>
                      </>
                    )}
                  </div>
                  {plan.monthlyPrice > 0 && interval === 'annual' && (
                    <div className="text-[12px] text-primary font-medium mb-1">
                      soit {fmtXOF(getAnnualTotal(plan.monthlyPrice))} / an
                    </div>
                  )}
                  <div className="text-[12.5px] text-text-muted mb-3">{plan.description}</div>

                  {/* Crédits badge */}
                  <div className="flex items-center gap-1.5 text-[12px] text-primary font-medium">
                    <SparkleIcon />
                    <span>{plan.creditsLabel}</span>
                  </div>
                </div>

                <div className="p-5 flex flex-col gap-2.5 flex-1">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-[13px]">
                      <span className="text-primary flex-shrink-0"><CheckIcon /></span>
                      <span>{f}</span>
                    </div>
                  ))}
                  {plan.missing.map(f => (
                    <div key={f} className="flex items-center gap-2 text-[13px] text-text-muted">
                      <span className="flex-shrink-0 opacity-40"><XIcon /></span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <div className="p-5 pt-0">
                  {isCurrent ? (
                    <div className="w-full h-10 rounded-sm border border-border bg-surface-2 flex items-center justify-center text-[13px] text-text-muted font-medium">
                      Plan actuel
                    </div>
                  ) : plan.id === 'FREE' ? (
                    <div className="w-full h-10 rounded-sm border border-border bg-surface-2 flex items-center justify-center text-[13px] text-text-muted">
                      Toujours disponible
                    </div>
                  ) : (
                    <Button
                      variant={isHighlighted ? 'primary' : 'secondary'}
                      className="w-full"
                      loading={upgradeMutation.isPending && upgrading === plan.id}
                      onClick={() => {
                        setUpgrading(plan.id);
                        upgradeMutation.mutate({ plan: plan.id, interval });
                      }}
                    >
                      Passer en {plan.name}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Section crédits IA supplémentaires */}
        <div className="mt-8 lg:mt-10">
          <div className="text-center mb-4 lg:mb-6">
            <div className="text-[16px] lg:text-[18px] font-semibold tracking-[-0.01em] mb-1">Crédits IA supplémentaires</div>
            <div className="text-[12.5px] lg:text-[13px] text-text-muted px-4">Achetez des crédits à tout moment, utilisables sur n'importe quel plan</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
            {((creditData?.packs ?? [
              { id: 'pack_10', credits: 10, price: 1500, label: '10 crédits' },
              { id: 'pack_30', credits: 30, price: 3500, label: '30 crédits' },
              { id: 'pack_100', credits: 100, price: 9000, label: '100 crédits' },
            ]) as CreditPack[]).map((pack: CreditPack) => {
              const pricePerCredit = Math.round(pack.price / pack.credits);
              return (
                <div key={pack.id} className="bg-surface border border-border rounded p-4 lg:p-5 flex flex-col gap-2.5 lg:gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-primary"><SparkleIcon /></span>
                    <span className="font-semibold text-[14.5px] lg:text-[15px]">{pack.credits} crédits</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-1">
                    <span className="text-[20px] lg:text-[22px] font-semibold tracking-[-0.02em]">{fmtXOF(pack.price)}</span>
                    <span className="text-[11.5px] lg:text-[12px] text-text-muted">({fmtXOF(pricePerCredit)} / crédit)</span>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    loading={purchaseMutation.isPending && purchasingPack === pack.id}
                    onClick={() => {
                      setPurchasingPack(pack.id);
                      purchaseMutation.mutate(pack.id);
                    }}
                  >
                    Acheter
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-3 lg:mt-4 p-3 bg-surface border border-border rounded text-[11.5px] lg:text-[12px] text-text-muted text-center leading-snug">
            Les crédits IA permettent de générer des devis automatiquement, suggérer des prix et améliorer vos descriptions. <strong className="text-text">1 crédit = 1 action IA</strong>.
          </div>
        </div>

        {/* Commission note */}
        <div className="mt-5 lg:mt-6 mb-3 p-3 lg:p-4 bg-surface border border-border rounded text-[12px] lg:text-[12.5px] text-text-muted text-center leading-relaxed">
          Une commission de <strong className="text-text">3 %</strong> est prélevée sur les paiements collectés via lien Mobile Money.
          Aucun frais fixe supplémentaire.
        </div>
      </div>
    </div>
  );
}
