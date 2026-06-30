import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { storesApi, uploadApi } from '@/lib/api';
import { fmtDateFR, fmtXOF } from '@/lib/utils';
import { fromE164, toE164 } from '@/lib/phone';
import type { Store, StoreOrder, StoreOrderStatus, StorePaymentMode, StoreProduct, StoreProductStatus } from '@/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Toggle from '@/components/ui/Toggle';
import Checkbox from '@/components/ui/Checkbox';
import ImageDropzone from '@/components/ui/ImageDropzone';
import GoogleFontPicker from '@/components/ui/GoogleFontPicker';
import PhoneCountryInput from '@/components/ui/PhoneCountryInput';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { AlertCircleIcon, CheckIcon, CopyIcon, EditIcon, EyeIcon, PlusIcon, TrashIcon, XIcon } from '@/components/ui/Icon';
import { PDF_TEMPLATES, type TemplateId } from '@/components/quotes/QuotePDFTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { buildStoreTheme, loadGoogleFonts } from '@/lib/storeTheme';
import {
  CreditCard,
  BadgeCheck,
  ExternalLink,
  Globe2,
  Image,
  LayoutTemplate,
  Link2,
  Monitor,
  Package,
  Palette,
  Paintbrush,
  Settings2,
  ShoppingBag,
  Sparkles,
  Smartphone,
  Store as StoreIcon,
  Truck,
  WalletCards,
} from 'lucide-react';

type Tab = 'settings' | 'products' | 'orders';
type PreviewDevice = 'desktop' | 'mobile';
type SettingsSection = 'identity' | 'appearance' | 'commerce' | 'receipt';

const STATUS_LABELS: Record<StoreProductStatus, string> = {
  DRAFT: 'Masqué',
  ACTIVE: 'Disponible',
  HIDDEN: 'Masqué',
  SOLD_OUT: 'Épuisé',
};

const ORDER_LABELS: Record<StoreOrderStatus, string> = {
  PENDING_PAYMENT: 'Paiement attendu',
  PAID: 'Payée',
  PROCESSING: 'En traitement',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};

const ADMIN_ORDER_STATUSES: StoreOrderStatus[] = ['PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED'];

interface StoreFormData {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  themePrimaryColor: string;
  themeAccentColor: string;
  themeBackgroundColor: string;
  themeSurfaceColor: string;
  themeTextColor: string;
  themeMutedTextColor: string;
  themeBorderColor: string;
  themeButtonTextColor: string;
  themeInputBackgroundColor: string;
  themeInputTextColor: string;
  themeInputBorderColor: string;
  themeFontFamily: string;
  whatsapp?: string;
  phone?: string;
  phoneCountry?: string;
  email?: string;
  momoPhone?: string;
  momoCountry?: string;
  whatsappCountry?: string;
  quoteTemplateId: string;
  receiptTitle: string;
  taxRate: number;
  acceptsOrders: boolean;
  paymentMode: StorePaymentMode;
}

const THEME_PRESETS: { name: string; colors: Partial<StoreFormData> }[] = [
  {
    name: 'Émeraude',
    colors: {
      themePrimaryColor: '#0F8F65', themeAccentColor: '#14201C', themeBackgroundColor: '#F7F8F5',
      themeSurfaceColor: '#FFFFFF', themeTextColor: '#14201C', themeMutedTextColor: '#66706B',
      themeBorderColor: '#E0E4DE', themeButtonTextColor: '#FFFFFF', themeInputBackgroundColor: '#FFFFFF',
      themeInputTextColor: '#14201C', themeInputBorderColor: '#C8CEC8',
    },
  },
  {
    name: 'Marine',
    colors: {
      themePrimaryColor: '#1457D9', themeAccentColor: '#132238', themeBackgroundColor: '#F5F7FB',
      themeSurfaceColor: '#FFFFFF', themeTextColor: '#132238', themeMutedTextColor: '#667085',
      themeBorderColor: '#DDE3ED', themeButtonTextColor: '#FFFFFF', themeInputBackgroundColor: '#FFFFFF',
      themeInputTextColor: '#132238', themeInputBorderColor: '#C7D0DE',
    },
  },
  {
    name: 'Rose',
    colors: {
      themePrimaryColor: '#D83A6F', themeAccentColor: '#2C1821', themeBackgroundColor: '#FFF7F9',
      themeSurfaceColor: '#FFFFFF', themeTextColor: '#2C1821', themeMutedTextColor: '#79636C',
      themeBorderColor: '#EADDE2', themeButtonTextColor: '#FFFFFF', themeInputBackgroundColor: '#FFFFFF',
      themeInputTextColor: '#2C1821', themeInputBorderColor: '#D8C5CC',
    },
  },
  {
    name: 'Nuit',
    colors: {
      themePrimaryColor: '#F4C95D', themeAccentColor: '#F7F8F5', themeBackgroundColor: '#111714',
      themeSurfaceColor: '#1B2420', themeTextColor: '#F7F8F5', themeMutedTextColor: '#A6B0AA',
      themeBorderColor: '#34413B', themeButtonTextColor: '#17201C', themeInputBackgroundColor: '#222D28',
      themeInputTextColor: '#F7F8F5', themeInputBorderColor: '#435149',
    },
  },
];

interface ProductFormData {
  name: string;
  description?: string;
  category?: string;
  price: number;
  unit?: string;
  stock: number;
  allowBackorder: boolean;
  featured: boolean;
  visible: boolean;
}

export default function StoreManager() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('settings');
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const storeQuery = useQuery<Store>({
    queryKey: ['store-me'],
    queryFn: () => storesApi.me().then(r => r.data),
    retry: false,
  });
  const productsQuery = useQuery<StoreProduct[]>({
    queryKey: ['store-products'],
    queryFn: () => storesApi.products().then(r => r.data),
    enabled: !!storeQuery.data,
  });
  const ordersQuery = useQuery<StoreOrder[]>({
    queryKey: ['store-orders'],
    queryFn: () => storesApi.orders().then(r => r.data),
    enabled: !!storeQuery.data,
    refetchInterval: q => (q.state.data ?? []).some(o => o.status === 'PENDING_PAYMENT') ? 8000 : false,
  });
  const statsQuery = useQuery({
    queryKey: ['store-stats'],
    queryFn: () => storesApi.stats().then(r => r.data),
    enabled: !!storeQuery.data,
  });

  const store = storeQuery.data;
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const publicUrl = store ? `${window.location.origin}/store/${store.slug}` : '';
  const proError = storeQuery.error as any;

  const visibilityMutation = useMutation({
    mutationFn: (active: boolean) => storesApi.updateMe({
      name: store!.name,
      slug: store!.slug,
      active,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store-me'] }),
  });

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const order of orders) map[order.status] = (map[order.status] ?? 0) + 1;
    return map;
  }, [orders]);

  function copyStoreLink() {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl);
    setFeedback('Lien boutique copié.');
    setTimeout(() => setFeedback(null), 2500);
  }

  if (storeQuery.isLoading) return <CenteredLoader />;

  if (proError?.response?.status === 403) {
    return (
      <div className="h-full overflow-auto bg-surface-2 p-6 lg:p-8">
        <div className="mx-auto max-w-[760px] rounded border border-border bg-surface p-8">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded bg-primary-soft">
            <StoreIcon size={24} className="text-primary" />
          </div>
          <div className="text-[22px] font-semibold">Boutique Pro</div>
          <p className="mb-5 mt-2 text-[14px] leading-relaxed text-text-muted">
            Vendez vos produits via un lien public, encaissez en ligne ou à la livraison et générez vos reçus automatiquement.
          </p>
          <Button variant="primary" onClick={() => navigate('/pricing')}>Passer à Pro</Button>
        </div>
      </div>
    );
  }

  if (!store) {
    return <div className="h-full overflow-auto bg-surface-2 p-6 text-danger">Boutique indisponible.</div>;
  }

  return (
    <div className="h-full overflow-auto bg-surface-2 scrollbar-thin">
      <div className="mx-auto max-w-[1280px] px-4 py-5 pb-24 lg:px-6 lg:py-8">
        <section className="relative mb-5 overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-sm lg:p-6">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary-soft opacity-80 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-primary text-white shadow-md">
                <StoreIcon size={23} />
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary-hover">Espace boutique</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-semibold ${store.active ? 'bg-primary-soft text-primary-hover' : 'bg-surface-2 text-text-muted'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${store.active ? 'bg-primary' : 'bg-text-subtle'}`} />
                    {store.active ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
                <h1 className="truncate text-[24px] font-semibold tracking-[-0.025em] lg:text-[28px]">{store.name}</h1>
                <div className="mt-2 flex min-w-0 max-w-[680px] items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12.5px]">
                  <Globe2 size={14} className="flex-shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-mono text-text-muted">{publicUrl}</span>
                  <button onClick={copyStoreLink} className="inline-flex flex-shrink-0 items-center gap-1.5 font-semibold text-primary-hover transition-colors hover:text-primary" aria-label="Copier le lien de la boutique">
                    <CopyIcon size={13} /> Copier
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-border bg-surface px-3 shadow-sm">
                <Toggle
                  checked={store.active}
                  onCheckedChange={active => visibilityMutation.mutate(active)}
                  disabled={visibilityMutation.isPending}
                  label={store.active ? 'Visible' : 'Masquée'}
                />
              </div>
              <Button variant="secondary" onClick={() => window.open(publicUrl, '_blank')}>
                <ExternalLink size={15} /> Ouvrir
              </Button>
              <Button variant="primary" onClick={() => { setEditingProduct(null); setProductModalOpen(true); }}>
                <PlusIcon size={15} /> Ajouter un produit
              </Button>
            </div>
          </div>
        </section>

        {feedback && (
          <div className="mb-4 rounded-lg border border-primary-soft-2 bg-primary-soft px-3 py-2 text-[13px] font-semibold text-primary-hover" aria-live="polite">
            {feedback}
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Produits en ligne" value={String(products.filter(p => p.status === 'ACTIVE').length)} icon={<Package size={17} />} />
          <Stat label="Commandes" value={String(statsQuery.data?.ordersCount ?? orders.length)} icon={<ShoppingBag size={17} />} />
          <Stat label="À confirmer" value={String(statusCounts.PENDING_PAYMENT ?? 0)} icon={<AlertCircleIcon size={17} />} />
          <Stat label="Ventes brutes" value={fmtXOF(statsQuery.data?.revenue ?? 0)} icon={<WalletCards size={17} />} mono />
          <Stat label="Net vendeur" value={fmtXOF(statsQuery.data?.netRevenue ?? 0)} icon={<CheckIcon size={17} />} mono />
        </div>

        <div className="mb-5 flex gap-1 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-sm">
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon={<Settings2 size={15} />}>Configuration</TabButton>
          <TabButton active={tab === 'products'} onClick={() => setTab('products')} icon={<Package size={15} />}>Produits</TabButton>
          <TabButton active={tab === 'orders'} onClick={() => setTab('orders')} icon={<ShoppingBag size={15} />}>Commandes</TabButton>
        </div>

        {tab === 'settings' && (
          <StoreSettings
            store={store}
            products={products}
            onSaved={() => qc.invalidateQueries({ queryKey: ['store-me'] })}
          />
        )}
        {tab === 'products' && (
          <ProductsPanel
            products={products}
            loading={productsQuery.isLoading}
            onAdd={() => { setEditingProduct(null); setProductModalOpen(true); }}
            onEdit={product => { setEditingProduct(product); setProductModalOpen(true); }}
          />
        )}
        {tab === 'orders' && <OrdersPanel orders={orders} loading={ordersQuery.isLoading} />}

        {productModalOpen && (
          <ProductModal
            product={editingProduct}
            onClose={() => { setProductModalOpen(false); setEditingProduct(null); }}
          />
        )}
      </div>
    </div>
  );
}

function StoreSettings({ store, products, onSaved }: { store: Store; products: StoreProduct[]; onSaved: () => void }) {
  const { user } = useAuth();
  const { register, handleSubmit, formState: { isSubmitting, isDirty }, watch, setValue, reset } = useForm<StoreFormData>({
    defaultValues: storeFormDefaults(store),
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [section, setSection] = useState<SettingsSection>('identity');

  useEffect(() => reset(storeFormDefaults(store)), [store.id, store.updatedAt, reset]);

  const form = watch();
  const liveSlug = slugify(form.slug || form.name || 'boutique');
  const liveUrl = `${window.location.origin}/store/${liveSlug}`;
  const storeUrlPrefix = `${window.location.origin}/store/`;
  const deferredSlug = useDeferredValue(liveSlug);
  const slugQuery = useQuery<{ slug: string; available: boolean; current: boolean }>({
    queryKey: ['store-slug-availability', deferredSlug],
    queryFn: () => storesApi.slugAvailability(deferredSlug).then(response => response.data),
    enabled: deferredSlug.length >= 2,
    staleTime: 30_000,
  });
  const slugAvailable = slugQuery.data?.available ?? true;
  const identityComplete = Boolean(form.name?.trim() && liveSlug && (form.logoUrl || form.coverImageUrl));
  const commerceComplete = Boolean(form.phone || form.whatsapp || form.email);

  useEffect(() => {
    loadGoogleFonts([form.themeFontFamily]);
  }, [form.themeFontFamily]);

  const mutation = useMutation({
    mutationFn: (data: StoreFormData) => storesApi.updateMe({
      ...data,
      slug: liveSlug,
      phone: data.phone ? toE164(data.phone, data.phoneCountry || 'bj') : '',
      whatsapp: data.whatsapp ? toE164(data.whatsapp, data.whatsappCountry || data.phoneCountry || 'bj') : '',
      momoPhone: data.momoPhone ? toE164(data.momoPhone, data.momoCountry || data.phoneCountry || 'bj') : '',
    }),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
      onSaved();
    },
    onError: (err: any) => setError(err?.response?.data?.message || 'Erreur enregistrement boutique'),
  });

  async function uploadLogo(file: File) {
    const response = await uploadApi.uploadStoreLogo(file);
    setValue('logoUrl', response.data.logoUrl, { shouldDirty: true });
  }

  async function removeLogo() {
    await uploadApi.deleteStoreLogo();
    setValue('logoUrl', '', { shouldDirty: true });
  }

  async function uploadCover(file: File) {
    const response = await uploadApi.uploadStoreCover(file);
    setValue('coverImageUrl', response.data.coverImageUrl, { shouldDirty: true });
  }

  async function removeCover() {
    await uploadApi.deleteStoreCover();
    setValue('coverImageUrl', '', { shouldDirty: true });
  }

  const sections: { id: SettingsSection; label: string; description: string; icon: React.ReactNode; complete: boolean }[] = [
    { id: 'identity', label: 'Identité & lien', description: 'Nom, adresse et visuels', icon: <Link2 size={17} />, complete: identityComplete && slugAvailable },
    { id: 'appearance', label: 'Apparence', description: 'Palette, police et couleurs', icon: <Paintbrush size={17} />, complete: true },
    { id: 'commerce', label: 'Vente & contact', description: 'Paiement et commandes', icon: <CreditCard size={17} />, complete: commerceComplete },
    { id: 'receipt', label: 'Facture & reçu', description: 'Document remis au client', icon: <LayoutTemplate size={17} />, complete: Boolean(form.receiptTitle) },
  ];

  return (
    <form onSubmit={handleSubmit(data => { setError(null); mutation.mutate(data); })}>
      <div className="mb-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_420px]">
        <aside className="min-w-0">
          <div className="sticky top-4 overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-sm">
            <div className="px-3 pb-3 pt-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-text-subtle">Configuration</div>
              <div className="mt-1 text-[13px] text-text-muted">Construisez votre boutique étape par étape.</div>
            </div>
            <nav className="flex gap-2 overflow-auto lg:flex-col" aria-label="Étapes de configuration">
              {sections.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`group flex min-w-[190px] items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors lg:min-w-0 ${section === item.id ? 'bg-primary-soft text-primary-hover' : 'text-text-muted hover:bg-surface-2 hover:text-text'}`}
                  aria-current={section === item.id ? 'step' : undefined}
                >
                  <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${section === item.id ? 'bg-primary text-white' : 'bg-surface-2 text-text-muted group-hover:text-text'}`}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold">{index + 1}. {item.label}</span>
                    <span className="mt-0.5 block truncate text-[10.5px] opacity-75">{item.description}</span>
                  </span>
                  {item.complete && <BadgeCheck size={15} className="flex-shrink-0 text-primary" />}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {error && <AlertBanner>{error}</AlertBanner>}

          {section === 'identity' && (
            <>
              <FormSection
                title="Identité de votre boutique"
                description="Ces informations accueillent vos clients et rendent votre boutique reconnaissable."
                icon={<StoreIcon size={19} />}
              >
                <Input label="Nom affiché de la boutique" placeholder="Ex. Maison Kora" {...register('name', { required: true })} />
                <Textarea label="Description courte" rows={3} placeholder="Présentez votre activité, vos produits et ce qui vous rend unique." {...register('description')} />
              </FormSection>

              <FormSection
                title="Adresse publique"
                description="C’est le lien que vous partagerez sur WhatsApp, Instagram ou avec vos clients."
                icon={<Globe2 size={19} />}
              >
                <div className={`overflow-hidden rounded-xl border bg-surface shadow-sm transition-colors ${slugAvailable ? 'border-border-strong focus-within:border-primary' : 'border-danger'}`}>
                  <label htmlFor="store-slug" className="block border-b border-border bg-surface-2 px-4 py-3">
                    <span className="text-[12px] font-semibold text-text">Lien personnalisé</span>
                    <span className="ml-2 text-[11px] text-text-muted">modifiable à tout moment</span>
                  </label>
                  <div className="flex min-w-0 items-center px-4 py-3">
                    <span className="hidden flex-shrink-0 font-mono text-[13px] text-text-muted sm:inline">{storeUrlPrefix}</span>
                    <span className="flex-shrink-0 font-mono text-[13px] text-text-muted sm:hidden">/store/</span>
                    <input
                      id="store-slug"
                      value={form.slug}
                      onChange={event => setValue('slug', slugify(event.target.value), { shouldDirty: true, shouldValidate: true })}
                      className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-[14px] font-semibold text-primary-hover outline-none"
                      placeholder="ma-boutique"
                      maxLength={60}
                      aria-describedby="slug-help slug-status"
                      aria-invalid={!slugAvailable}
                    />
                    <span id="slug-status" className={`ml-2 inline-flex flex-shrink-0 items-center gap-1 text-[11.5px] font-semibold ${slugAvailable ? 'text-primary-hover' : 'text-danger'}`} aria-live="polite">
                      {slugQuery.isFetching ? (
                        <><span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" /> Vérification</>
                      ) : slugAvailable ? (
                        <><CheckIcon size={13} /> {slugQuery.data?.current ? 'Votre lien actuel' : 'Disponible'}</>
                      ) : (
                        <><AlertCircleIcon size={13} /> Déjà utilisé</>
                      )}
                    </span>
                  </div>
                </div>
                <div id="slug-help" className="flex items-start gap-2 rounded-lg bg-blue-soft px-3 py-2.5 text-[11.5px] leading-relaxed text-blue">
                  <Sparkles size={14} className="mt-0.5 flex-shrink-0" />
                  Utilisez un nom court et facile à dicter. Les espaces et accents sont automatiquement transformés en tirets.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => navigator.clipboard?.writeText(liveUrl)}>
                    <CopyIcon size={13} /> Copier l’aperçu du lien
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => window.open(`/store/${store.slug}`, '_blank')}>
                    <ExternalLink size={13} /> Tester le lien actuel
                  </Button>
                </div>
              </FormSection>

              <FormSection
                title="Logo et bannière"
                description="Ajoutez des visuels nets. La bannière donne immédiatement le ton de votre marque."
                icon={<Image size={19} />}
              >
                <div className="grid gap-4 md:grid-cols-[190px_1fr]">
                  <ImageDropzone label="Logo" value={form.logoUrl} aspect="square" onUpload={uploadLogo} onRemove={removeLogo} />
                  <ImageDropzone label="Bannière" value={form.coverImageUrl} aspect="cover" onUpload={uploadCover} onRemove={removeCover} />
                </div>
              </FormSection>
            </>
          )}

          {section === 'appearance' && (
            <FormSection
              title="Univers visuel"
              description="Commencez par une palette professionnelle, puis ajustez uniquement ce dont vous avez besoin."
              icon={<Palette size={19} />}
            >
              <div>
                <div className="mb-2.5 text-[12px] font-semibold text-text-muted">Palettes recommandées</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {THEME_PRESETS.map(preset => {
                    const selected = form.themePrimaryColor === preset.colors.themePrimaryColor
                      && form.themeBackgroundColor === preset.colors.themeBackgroundColor;
                    return (
                      <button
                        type="button"
                        key={preset.name}
                        onClick={() => Object.entries(preset.colors).forEach(([key, value]) => {
                          setValue(key as keyof StoreFormData, value as never, { shouldDirty: true });
                        })}
                        className={`relative rounded-xl border-2 bg-surface p-2 text-left transition-colors ${selected ? 'border-primary bg-primary-soft' : 'border-border hover:border-border-strong'}`}
                        aria-pressed={selected}
                      >
                        {selected && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-white"><CheckIcon size={12} /></span>}
                        <div className="mb-2.5 flex h-12 overflow-hidden rounded-lg border border-border">
                          <span className="flex-1" style={{ backgroundColor: preset.colors.themePrimaryColor }} />
                          <span className="flex-1" style={{ backgroundColor: preset.colors.themeBackgroundColor }} />
                          <span className="flex-1" style={{ backgroundColor: preset.colors.themeSurfaceColor }} />
                        </div>
                        <span className="text-[11.5px] font-semibold">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <GoogleFontPicker value={form.themeFontFamily} onChange={family => setValue('themeFontFamily', family, { shouldDirty: true })} />

              <details className="group rounded-xl border border-border bg-surface">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5">
                  <span>
                    <span className="block text-[13px] font-semibold">Réglages avancés des couleurs</span>
                    <span className="mt-0.5 block text-[11px] text-text-muted">Pour affiner chaque surface, texte et champ.</span>
                  </span>
                  <Palette size={16} className="text-text-muted transition-transform group-open:rotate-12" />
                </summary>
                <div className="border-t border-border p-4">
                  <div className="mb-5">
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-text-subtle">Interface générale</div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <ColorControl label="Couleur principale" value={form.themePrimaryColor} onChange={value => setValue('themePrimaryColor', value, { shouldDirty: true })} />
                      <ColorControl label="Accent" value={form.themeAccentColor} onChange={value => setValue('themeAccentColor', value, { shouldDirty: true })} />
                      <ColorControl label="Fond de page" value={form.themeBackgroundColor} onChange={value => setValue('themeBackgroundColor', value, { shouldDirty: true })} />
                      <ColorControl label="Cartes" value={form.themeSurfaceColor} onChange={value => setValue('themeSurfaceColor', value, { shouldDirty: true })} />
                      <ColorControl label="Texte principal" value={form.themeTextColor} onChange={value => setValue('themeTextColor', value, { shouldDirty: true })} />
                      <ColorControl label="Texte secondaire" value={form.themeMutedTextColor} onChange={value => setValue('themeMutedTextColor', value, { shouldDirty: true })} />
                      <ColorControl label="Bordures" value={form.themeBorderColor} onChange={value => setValue('themeBorderColor', value, { shouldDirty: true })} />
                      <ColorControl label="Texte des boutons" value={form.themeButtonTextColor} onChange={value => setValue('themeButtonTextColor', value, { shouldDirty: true })} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-text-subtle">Champs et recherche</div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <ColorControl label="Fond des champs" value={form.themeInputBackgroundColor} onChange={value => setValue('themeInputBackgroundColor', value, { shouldDirty: true })} />
                      <ColorControl label="Texte des champs" value={form.themeInputTextColor} onChange={value => setValue('themeInputTextColor', value, { shouldDirty: true })} />
                      <ColorControl label="Bordure des champs" value={form.themeInputBorderColor} onChange={value => setValue('themeInputBorderColor', value, { shouldDirty: true })} />
                    </div>
                  </div>
                </div>
              </details>
            </FormSection>
          )}

          {section === 'commerce' && (
            <FormSection
              title="Vente, paiement et contact"
              description="Définissez comment vos clients commandent, paient et vous contactent."
              icon={<CreditCard size={19} />}
            >
              <div className="rounded-xl border border-border bg-surface-2 p-4">
                <Toggle
                  checked={form.acceptsOrders}
                  onCheckedChange={checked => setValue('acceptsOrders', checked, { shouldDirty: true })}
                  label="Accepter les commandes"
                  description="Vous pouvez suspendre le checkout sans rendre la boutique invisible."
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Select label="Mode de paiement proposé" {...register('paymentMode')}>
                  <option value="ONLINE">Paiement en ligne</option>
                  <option value="COD">Paiement à la livraison</option>
                  <option value="BOTH">En ligne ou à la livraison</option>
                </Select>
                <Input label="TVA appliquée (%)" type="number" step="0.1" min="0" max="100" {...register('taxRate', { valueAsNumber: true })} />
              </div>
              <div className="border-t border-border pt-4">
                <div className="mb-3 text-[12px] font-semibold text-text">Coordonnées visibles par les clients</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <PhoneCountryInput
                    label="Téléphone boutique"
                    phone={form.phone || ''}
                    country={form.phoneCountry || 'bj'}
                    onPhoneChange={value => setValue('phone', value, { shouldDirty: true })}
                    onCountryChange={value => setValue('phoneCountry', value, { shouldDirty: true })}
                  />
                  <PhoneCountryInput
                    label="WhatsApp"
                    phone={form.whatsapp || ''}
                    country={form.whatsappCountry || form.phoneCountry || 'bj'}
                    onPhoneChange={value => setValue('whatsapp', value, { shouldDirty: true })}
                    onCountryChange={value => setValue('whatsappCountry', value, { shouldDirty: true })}
                  />
                  <Input label="Email boutique" type="email" placeholder="contact@boutique.com" {...register('email')} />
                  <PhoneCountryInput
                    label="Mobile Money de reversement"
                    phone={form.momoPhone || ''}
                    country={form.momoCountry || form.phoneCountry || 'bj'}
                    onPhoneChange={value => setValue('momoPhone', value, { shouldDirty: true })}
                    onCountryChange={value => setValue('momoCountry', value, { shouldDirty: true })}
                  />
                </div>
              </div>
            </FormSection>
          )}

          {section === 'receipt' && (
            <FormSection
              title="Facture et reçu client"
              description="Choisissez le document généré automatiquement après chaque commande."
              icon={<LayoutTemplate size={19} />}
            >
              <Input label="Titre du document" {...register('receiptTitle')} />
              <ReceiptTemplatePicker
                value={form.quoteTemplateId as TemplateId}
                onChange={value => setValue('quoteTemplateId', value, { shouldDirty: true })}
                business={user?.plan === 'BUSINESS'}
              />
            </FormSection>
          )}
        </div>

        <div className="hidden min-w-0 xl:block">
          <div className="sticky top-4">
            <PreviewPanel form={{ ...form, slug: liveSlug }} products={products} device={device} setDevice={setDevice} storeSlug={store.slug} />
          </div>
        </div>
      </div>

      <div className="mb-4 xl:hidden">
        <PreviewPanel form={{ ...form, slug: liveSlug }} products={products} device={device} setDevice={setDevice} storeSlug={store.slug} />
      </div>

      <div className="sticky bottom-3 z-20 flex flex-col gap-3 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isDirty ? 'bg-warn' : 'bg-primary'}`} />
            <div className="truncate text-[12px] font-semibold">{saved ? 'Modifications enregistrées' : isDirty ? 'Modifications non enregistrées' : 'Boutique à jour'}</div>
          </div>
          <div className="mt-0.5 truncate pl-4 text-[10.5px] font-mono text-text-muted">{liveUrl}</div>
        </div>
        <Button type="submit" variant="primary" loading={mutation.isPending || isSubmitting} disabled={!slugAvailable}>
          <CheckIcon size={15} /> Enregistrer les modifications
        </Button>
      </div>
    </form>
  );
}

function PreviewPanel({
  form,
  products,
  device,
  setDevice,
  storeSlug,
}: {
  form: StoreFormData;
  products: StoreProduct[];
  device: PreviewDevice;
  setDevice: (device: PreviewDevice) => void;
  storeSlug: string;
}) {
  return (
    <Card className="overflow-hidden p-0 shadow-md">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2 text-[14px] font-semibold"><Sparkles size={15} className="text-primary" /> Aperçu en direct</div>
          <div className="mt-0.5 text-[11px] text-text-muted">Chaque modification apparaît ici.</div>
        </div>
        <div className="flex rounded-lg border border-border bg-surface-2 p-1">
          <PreviewDeviceButton active={device === 'desktop'} label="Ordinateur" icon={<Monitor size={14} />} onClick={() => setDevice('desktop')} />
          <PreviewDeviceButton active={device === 'mobile'} label="Mobile" icon={<Smartphone size={14} />} onClick={() => setDevice('mobile')} />
        </div>
      </div>
      <div className="bg-[#e9ebe7] p-4 dark:bg-[#101614]">
        <StorePreview form={form} products={products} device={device} />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
        <span className="truncate text-[10.5px] font-mono text-text-muted">/store/{form.slug}</span>
        <Link to={`/store/${storeSlug}`} target="_blank" className="inline-flex flex-shrink-0 items-center gap-1.5 text-[12px] font-semibold text-primary-hover">
          <ExternalLink size={13} /> Ouvrir
        </Link>
      </div>
    </Card>
  );
}

function ProductsPanel({ products, loading, onAdd, onEdit }: { products: StoreProduct[]; loading: boolean; onAdd: () => void; onEdit: (p: StoreProduct) => void }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => storesApi.deleteProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store-products'] }),
  });

  if (loading) return <CenteredLoader />;
  if (products.length === 0) {
    return (
      <div className="rounded border border-dashed border-border bg-surface p-10 text-center">
        <div className="mb-1 text-[16px] font-semibold">Aucun produit</div>
        <div className="mb-5 text-[13px] text-text-muted">Ajoutez votre premier article pour commencer à vendre.</div>
        <Button variant="primary" onClick={onAdd}><PlusIcon size={15} /> Ajouter un produit</Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded border border-border bg-surface">
      <div className="hidden grid-cols-[1fr_140px_150px_96px] gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-[11px] font-semibold uppercase text-text-muted lg:grid">
        <span>Produit</span><span>Prix</span><span>Disponibilité</span><span />
      </div>
      {products.map(product => (
        <div key={product.id} className="grid gap-3 border-t border-border p-4 first:border-t-0 lg:grid-cols-[1fr_140px_150px_96px] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <ProductImage product={product} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold">{product.name}</div>
              <div className="truncate text-[12px] text-text-muted">{product.category || 'Sans catégorie'}{product.featured ? ' · Mis en avant' : ''}</div>
            </div>
          </div>
          <div className="font-mono text-[13px] font-semibold">{fmtXOF(product.price)}</div>
          <ProductStatus product={product} />
          <div className="flex justify-end gap-1">
            <button onClick={() => onEdit(product)} className="icon-btn" aria-label="Modifier" title="Modifier"><EditIcon size={15} /></button>
            <button onClick={() => del.mutate(product.id)} className="icon-btn text-danger" aria-label="Supprimer" title="Supprimer"><TrashIcon size={15} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrdersPanel({ orders, loading }: { orders: StoreOrder[]; loading: boolean }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: StoreOrderStatus }) => storesApi.updateOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['store-orders'] }),
  });

  if (loading) return <CenteredLoader />;
  if (orders.length === 0) {
    return (
      <div className="rounded border border-dashed border-border bg-surface p-10 text-center">
        <div className="mb-1 text-[16px] font-semibold">Aucune commande</div>
        <div className="text-[13px] text-text-muted">Les commandes de votre boutique apparaîtront ici.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map(order => (
        <Card key={order.id} className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] text-text-muted">{order.number}</span>
              <OrderStatus status={order.status} />
              <span className="inline-flex items-center gap-1 text-[11.5px] text-text-muted">
                {order.paymentMethod === 'COD' ? <Truck size={13} /> : <CreditCard size={13} />}
                {order.paymentMethod === 'COD' ? 'À la livraison' : 'En ligne'}
              </span>
              {order.quote?.id && (
                <Link to={`/quotes/${order.quote.id}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary-hover">
                  <EyeIcon size={13} /> Facture {order.quote.number}
                </Link>
              )}
            </div>
            <div className="mt-1 text-[15px] font-semibold">{order.customerName}</div>
            <div className="mt-0.5 text-[12.5px] text-text-muted">
              {order.items.length} article(s) · {fmtDateFR(order.createdAt)} · {order.customerPhone}
            </div>
          </div>
          <div className="lg:text-right">
            <div className="font-mono text-[16px] font-semibold text-primary-hover">{fmtXOF(order.total)}</div>
            {order.payment && <div className="text-[11.5px] text-text-muted">Net {fmtXOF(order.payment.netAmount)} · commission {fmtXOF(order.payment.commission)}</div>}
          </div>
          {order.status === 'PENDING_PAYMENT' ? (
            <div className="text-[12px] text-text-muted">En attente du paiement</div>
          ) : (
            <Select
              value={order.status}
              onChange={event => mutation.mutate({ id: order.id, status: event.target.value as StoreOrderStatus })}
              className="lg:w-[180px]"
            >
              <option value={order.status}>{ORDER_LABELS[order.status]}</option>
              {ADMIN_ORDER_STATUSES.filter(status => status !== order.status).map(status => (
                <option key={status} value={status}>{ORDER_LABELS[status]}</option>
              ))}
            </Select>
          )}
        </Card>
      ))}
    </div>
  );
}

function ProductModal({ product, onClose }: { product: StoreProduct | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(product?.imageUrl ?? null);
  const { register, handleSubmit, watch, setValue, formState: { isSubmitting } } = useForm<ProductFormData>({
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      category: product?.category ?? '',
      price: product?.price ?? 0,
      unit: product?.unit ?? '',
      stock: product?.stock ?? 0,
      allowBackorder: product?.allowBackorder ?? false,
      featured: product?.featured ?? false,
      visible: product ? ['ACTIVE', 'SOLD_OUT'].includes(product.status) : true,
    },
  });

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const form = watch();
  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      const status: StoreProductStatus = !data.visible
        ? 'HIDDEN'
        : data.stock <= 0 && !data.allowBackorder
          ? 'SOLD_OUT'
          : 'ACTIVE';
      const payload = {
        name: data.name,
        description: data.description,
        category: data.category,
        price: data.price,
        unit: data.unit,
        status,
        stock: data.stock,
        trackStock: true,
        allowBackorder: data.allowBackorder,
        featured: data.featured,
      };
      const response = product
        ? await storesApi.updateProduct(product.id, payload)
        : await storesApi.createProduct(payload);
      const savedProduct = response.data as StoreProduct;
      try {
        if (imageRemoved && product?.imageUrl) await uploadApi.deleteStoreProductImage(savedProduct.id);
        if (pendingImage) await uploadApi.uploadStoreProduct(savedProduct.id, pendingImage);
      } catch (uploadError) {
        if (!product) await storesApi.deleteProduct(savedProduct.id);
        throw uploadError;
      }
      return savedProduct;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['store-products'] });
      qc.invalidateQueries({ queryKey: ['store-stats'] });
      qc.invalidateQueries({ queryKey: ['public-store'] });
      onClose();
    },
    onError: (err: any) => setError(err?.response?.data?.message || 'Erreur produit boutique'),
  });

  async function selectImage(file: File) {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPendingImage(file);
    setImageRemoved(false);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function removeImage() {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPendingImage(null);
    setImageRemoved(true);
    setPreviewUrl(null);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-text/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-auto rounded-t bg-surface shadow-lg sm:max-w-[720px] sm:rounded" onClick={event => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center border-b border-border bg-surface px-5 py-4">
          <div className="flex-1">
            <div className="text-[16px] font-semibold">{product ? 'Modifier le produit' : 'Ajouter un produit'}</div>
            <div className="text-[11.5px] text-text-muted">Les clients verront ces informations dans la boutique.</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Fermer"><XIcon size={16} /></button>
        </div>

        <form onSubmit={handleSubmit(data => { setError(null); mutation.mutate(data); })} className="grid gap-5 p-5 md:grid-cols-[240px_1fr]">
          <div>
            <ImageDropzone
              label="Photo du produit"
              value={previewUrl}
              aspect="product"
              onUpload={selectImage}
              onRemove={previewUrl ? removeImage : undefined}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {error && <AlertBanner>{error}</AlertBanner>}
            <Input label="Nom du produit" {...register('name', { required: true })} autoFocus />
            <Textarea label="Description" rows={3} {...register('description')} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Prix FCFA" type="number" min="0" step="100" mono {...register('price', { valueAsNumber: true, min: 0 })} />
              <Input label="Stock disponible" type="number" min="0" {...register('stock', { valueAsNumber: true, min: 0 })} />
              <Input label="Catégorie" placeholder="Ex. Soin visage" {...register('category')} />
              <Input label="Unité" placeholder="pièce, lot, kg..." {...register('unit')} />
            </div>

            <div className="grid gap-4 rounded border border-border bg-surface-2 p-4 sm:grid-cols-2">
              <Toggle
                checked={form.visible}
                onCheckedChange={checked => setValue('visible', checked, { shouldDirty: true })}
                label="Visible en boutique"
                description="Masquez le produit sans le supprimer."
              />
              <Toggle
                checked={form.allowBackorder}
                onCheckedChange={checked => setValue('allowBackorder', checked, { shouldDirty: true })}
                label="Précommande"
                description="Continue à accepter les commandes quand le stock est épuisé."
              />
              <Checkbox
                label="Mettre en avant"
                description="Affiche le produit parmi les recommandations."
                checked={form.featured}
                onChange={event => setValue('featured', event.target.checked, { shouldDirty: true })}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
              <Button type="submit" variant="primary" className="flex-[1.5]" loading={mutation.isPending || isSubmitting}>
                {product ? 'Enregistrer' : 'Ajouter à la boutique'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function StorePreview({ form, products, device }: { form: StoreFormData; products: StoreProduct[]; device: PreviewDevice }) {
  const primary = form.themePrimaryColor || '#0F8F65';
  const accent = form.themeAccentColor || '#14201C';
  const visibleProducts = products.filter(product => ['ACTIVE', 'SOLD_OUT'].includes(product.status)).slice(0, device === 'mobile' ? 4 : 6);
  const sampleProducts = visibleProducts.length > 0 ? visibleProducts : [
    { id: 'sample-1', name: 'Produit exemple', price: 12500, imageUrl: null, status: 'ACTIVE' },
    { id: 'sample-2', name: 'Nouveau produit', price: 8500, imageUrl: null, status: 'SOLD_OUT' },
  ];

  return (
    <div className={`mx-auto overflow-hidden rounded border border-black/10 bg-white shadow-md transition-all ${device === 'mobile' ? 'max-w-[285px]' : 'w-full'}`}>
      <div className="flex h-9 items-center gap-2 border-b border-black/10 bg-white px-3">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ef6a5b]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#e5b74a]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[#57b66b]" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded bg-surface-2 px-2 py-1 text-[8px] text-text-muted">
          /store/{form.slug}
        </div>
      </div>
      <div className="storefront-root" style={buildStoreTheme(form)}>
        <div className="flex h-11 items-center gap-2 border-b border-black/10 bg-white px-3">
          {form.logoUrl ? (
            <img src={form.logoUrl} alt="" className="h-7 w-7 rounded object-cover" />
          ) : (
            <div className="grid h-7 w-7 place-items-center rounded text-[10px] font-bold" style={{ backgroundColor: primary, color: form.themeButtonTextColor }}>
              {(form.name || 'B').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 truncate text-[10px] font-semibold" style={{ color: accent }}>{form.name || 'Ma boutique'}</div>
          <div className="rounded px-2 py-1 text-[8px] font-semibold" style={{ backgroundColor: primary, color: form.themeButtonTextColor }}>Panier</div>
        </div>

        <div className="relative h-[118px] overflow-hidden bg-[#17211d]">
          {form.coverImageUrl && <img src={form.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/10" />
          <div className="absolute inset-x-0 bottom-0 p-3 text-white">
            <div className="text-[15px] font-semibold">{form.name || 'Ma boutique'}</div>
            <div className="mt-1 line-clamp-2 text-[8.5px] text-white/80">{form.description || 'Découvrez nos produits et commandez en quelques clics.'}</div>
          </div>
        </div>

        <div className="p-3">
          <div className="mb-2 grid grid-cols-[1fr_82px] gap-2">
            <div className="store-input-preview h-7 flex-1 rounded border px-2 py-1.5 text-[8px]">Rechercher un produit...</div>
            <div className="store-input-preview h-7 rounded border px-2 py-1.5 text-[8px]">Recommandés</div>
          </div>
          <div className={`grid gap-2 ${device === 'mobile' ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {sampleProducts.map(product => (
              <div key={product.id} className="overflow-hidden rounded border border-black/10 bg-white">
                <div className="grid aspect-[4/3] place-items-center bg-surface-2">
                  {product.imageUrl
                    ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                    : <Package size={16} className="text-text-subtle" />}
                </div>
                <div className="p-2">
                  <div className="truncate text-[8.5px] font-semibold" style={{ color: accent }}>{product.name}</div>
                  <div className="mt-1 font-mono text-[8px] font-semibold">{fmtXOF(product.price)}</div>
                  <div
                    className="mt-2 rounded border px-1.5 py-1 text-center text-[7.5px] font-semibold"
                    style={product.status === 'SOLD_OUT' ? undefined : { borderColor: primary, color: primary }}
                  >
                    {product.status === 'SOLD_OUT' ? 'Épuisé' : 'Ajouter'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptTemplatePicker({ value, onChange, business }: { value: TemplateId; onChange: (value: TemplateId) => void; business: boolean }) {
  const templates = business ? PDF_TEMPLATES : PDF_TEMPLATES.filter(template => template.category === 'classique');
  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold text-text-muted">Modèle de facture</div>
      <div className="grid max-h-[360px] grid-cols-3 gap-2 overflow-auto pr-1 sm:grid-cols-4">
        {templates.map(template => (
          <button
            type="button"
            key={template.id}
            onClick={() => onChange(template.id)}
            className={`overflow-hidden rounded border-2 p-1.5 text-left transition-colors ${value === template.id ? 'border-primary bg-primary-soft' : 'border-border hover:border-border-strong'}`}
          >
            <div className="overflow-hidden rounded border border-border bg-white" style={{ aspectRatio: '1 / 1.414' }}>{template.thumbnail}</div>
            <div className={`mt-1.5 truncate text-[10.5px] font-semibold ${value === template.id ? 'text-primary-hover' : 'text-text'}`}>{template.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FormSection({ title, description, icon, children }: { title: string; description: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-5 rounded-xl p-5 shadow-sm lg:p-6">
      <div className="flex items-start gap-3">
        {icon && <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-hover">{icon}</div>}
        <div>
          <div className="text-[17px] font-semibold tracking-[-0.015em]">{title}</div>
          <div className="mt-1 text-[12.5px] leading-relaxed text-text-muted">{description}</div>
        </div>
      </div>
      {children}
    </Card>
  );
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-text-muted">
        {label}
        <span className="font-mono text-[10.5px] text-text-subtle">{value}</span>
      </span>
      <span className="flex h-10 items-center gap-2 rounded-sm border border-border-strong bg-surface px-2">
        <input type="color" value={value} onChange={event => onChange(event.target.value)} className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0" />
        <Palette size={14} className="text-text-muted" />
        <span className="font-mono text-[12px]">{value}</span>
      </span>
    </label>
  );
}

function PreviewDeviceButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-7 w-8 place-items-center rounded-sm ${active ? 'bg-surface text-text shadow-sm' : 'text-text-muted'}`}
    >
      {icon}
    </button>
  );
}

function Stat({ label, value, icon, mono }: { label: string; value: string; icon: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 shadow-sm">
      <div className="mb-3 flex items-center justify-between text-text-muted">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.06em]">{label}</span>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2">{icon}</span>
      </div>
      <div className={`text-[18px] font-semibold tracking-[-0.02em] ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function ProductImage({ product }: { product: StoreProduct }) {
  if (product.imageUrl) return <img src={product.imageUrl} alt="" className="h-12 w-12 rounded bg-surface-2 object-cover" />;
  return <div className="grid h-12 w-12 place-items-center rounded bg-primary-soft text-primary-hover"><Package size={20} /></div>;
}

function ProductStatus({ product }: { product: StoreProduct }) {
  const isSoldOut = product.status === 'SOLD_OUT' || (product.stock ?? 0) <= 0;
  const label = product.status === 'HIDDEN' || product.status === 'DRAFT'
    ? 'Masqué'
    : isSoldOut && product.allowBackorder
      ? 'Précommande'
      : isSoldOut
        ? 'Épuisé'
        : 'Disponible';
  const positive = label === 'Disponible' || label === 'Précommande';
  return <span className={`inline-flex h-6 w-fit items-center rounded-full px-2 text-[11.5px] font-semibold ${positive ? 'bg-primary-soft text-primary-hover' : 'bg-surface-2 text-text-muted'}`}>{label}</span>;
}

function OrderStatus({ status }: { status: StoreOrderStatus }) {
  const paid = ['PAID', 'PROCESSING', 'COMPLETED'].includes(status);
  return <span className={`inline-flex h-6 items-center rounded-full px-2 text-[11.5px] font-semibold ${paid ? 'bg-primary-soft text-primary-hover' : 'bg-surface-2 text-text-muted'}`}>{ORDER_LABELS[status]}</span>;
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex h-10 flex-1 flex-shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition-colors sm:flex-none ${active ? 'bg-text text-surface shadow-sm' : 'text-text-muted hover:bg-surface-2 hover:text-text'}`}>
      {icon}{children}
    </button>
  );
}

function AlertBanner({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-2 rounded border border-danger/25 bg-danger-soft p-3 text-[12.5px] text-danger"><AlertCircleIcon size={15} className="mt-px flex-shrink-0" />{children}</div>;
}

function CenteredLoader() {
  return (
    <div className="grid h-full min-h-[300px] place-items-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function storeFormDefaults(store: Store): StoreFormData {
  const parsedPhone = fromE164(store.phone ?? '');
  const parsedWhatsapp = fromE164(store.whatsapp ?? '');
  const parsedMomo = fromE164(store.momoPhone ?? '');
  const phoneCountry = parsedPhone?.country.code ?? store.phoneCountry ?? 'bj';
  const whatsappCountry = parsedWhatsapp?.country.code ?? store.whatsappCountry ?? phoneCountry;
  const momoCountry = parsedMomo?.country.code ?? store.momoCountry ?? phoneCountry;
  return {
    name: store.name,
    slug: store.slug,
    description: store.description ?? '',
    logoUrl: store.logoUrl ?? '',
    coverImageUrl: store.coverImageUrl ?? '',
    themePrimaryColor: store.themePrimaryColor ?? '#0F8F65',
    themeAccentColor: store.themeAccentColor ?? '#14201C',
    themeBackgroundColor: store.themeBackgroundColor ?? '#FAFAF7',
    themeSurfaceColor: store.themeSurfaceColor ?? '#FFFFFF',
    themeTextColor: store.themeTextColor ?? '#14201C',
    themeMutedTextColor: store.themeMutedTextColor ?? '#6B7570',
    themeBorderColor: store.themeBorderColor ?? '#E2E4DF',
    themeButtonTextColor: store.themeButtonTextColor ?? '#FFFFFF',
    themeInputBackgroundColor: store.themeInputBackgroundColor ?? '#FFFFFF',
    themeInputTextColor: store.themeInputTextColor ?? '#14201C',
    themeInputBorderColor: store.themeInputBorderColor ?? '#C8CCC6',
    themeFontFamily: store.themeFontFamily ?? 'Inter',
    whatsapp: parsedWhatsapp?.local ?? store.whatsapp ?? '',
    phone: parsedPhone?.local ?? store.phone ?? '',
    phoneCountry,
    email: store.email ?? '',
    momoPhone: parsedMomo?.local ?? store.momoPhone ?? '',
    momoCountry,
    whatsappCountry,
    quoteTemplateId: store.quoteTemplateId,
    receiptTitle: store.receiptTitle,
    taxRate: store.taxRate,
    acceptsOrders: store.acceptsOrders,
    paymentMode: store.paymentMode ?? 'ONLINE',
  };
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'boutique';
}
