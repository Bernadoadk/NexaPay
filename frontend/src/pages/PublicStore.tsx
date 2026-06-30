import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { storesApi } from '@/lib/api';
import { fmtXOF } from '@/lib/utils';
import { toE164 } from '@/lib/phone';
import type { Store, StorePaymentMethod, StoreProduct } from '@/types';
import { buildStoreTheme, loadGoogleFonts } from '@/lib/storeTheme';
import Button from '@/components/ui/Button';
import PhoneCountryInput from '@/components/ui/PhoneCountryInput';
import { AlertCircleIcon, CheckIcon, MinusIcon, PlusIcon, SearchIcon, XIcon } from '@/components/ui/Icon';
import { CreditCard, MapPin, Package, Phone, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';

type Cart = Record<string, number>;

interface CheckoutForm {
  customerName: string;
  customerPhone: string;
  customerPhoneCountry: string;
  customerEmail: string;
  customerCity: string;
  customerAddress: string;
  customerNote: string;
}

export default function PublicStore() {
  const { slug = '' } = useParams();
  const [cart, setCart] = useState<Cart>({});
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState('featured');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  const { data: store, isLoading, error } = useQuery<Store>({
    queryKey: ['public-store', slug],
    queryFn: () => storesApi.publicStore(slug).then(r => r.data),
    enabled: !!slug,
    retry: false,
  });

  const products = store?.products ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = products.filter(p => {
      const matchesQuery = !q || [p.name, p.description, p.category].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
      const matchesCategory = !category || p.category === category;
      return matchesQuery && matchesCategory;
    });
    return [...result].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'name') return a.name.localeCompare(b.name, 'fr');
      if (sort === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return Number(b.featured) - Number(a.featured);
    });
  }, [products, search, category, sort]);
  const featured = useMemo(() => products.filter(p => p.featured).slice(0, 4), [products]);
  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[], [products]);
  const cartLines = useMemo(() => {
    const map = new Map(products.map(p => [p.id, p]));
    return Object.entries(cart)
      .map(([id, quantity]) => ({ product: map.get(id), quantity }))
      .filter((line): line is { product: StoreProduct; quantity: number } => !!line.product && line.quantity > 0);
  }, [cart, products]);
  const subtotal = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const taxAmount = Math.round(subtotal * ((store?.taxRate ?? 0) / 100));
  const total = subtotal + taxAmount;
  const itemCount = cartLines.reduce((s, l) => s + l.quantity, 0);
  const theme = buildStoreTheme(store);

  useEffect(() => {
    loadGoogleFonts([store?.themeFontFamily || 'Inter']);
  }, [store?.themeFontFamily]);

  function setQty(id: string, next: number) {
    setCart(prev => {
      const copy = { ...prev };
      if (next <= 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  if (isLoading) return <FullPageLoader />;
  if (error || !store) {
    return (
      <div className="min-h-screen bg-surface-2 grid place-items-center p-5">
        <div className="max-w-[420px] text-center bg-surface border border-border rounded p-8">
          <AlertCircleIcon size={32} className="mx-auto text-danger mb-3" />
          <div className="text-[18px] font-semibold">Boutique introuvable</div>
          <div className="text-[13px] text-text-muted mt-1">Le lien est peut-être incorrect ou la boutique est inactive.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="storefront-root min-h-screen" style={theme}>
      <header className="store-surface sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-3">
          <StoreLogo store={store} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold" style={{ color: 'var(--store-accent)' }}>{store.name}</div>
            <div className="store-muted truncate text-[12px]">{store.description || store.user?.companyName || store.user?.name}</div>
          </div>
          <button
            className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded border px-3 text-[13px] font-semibold shadow-sm disabled:opacity-45"
            style={{ backgroundColor: 'var(--store-primary)', borderColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
            onClick={() => setCheckoutOpen(true)}
            disabled={cartLines.length === 0}
            aria-label="Ouvrir le panier"
          >
            <ShoppingBag size={16} />
            <span className="hidden sm:inline">{itemCount} article{itemCount > 1 ? 's' : ''}</span>
            <span className="sm:hidden">{itemCount}</span>
          </button>
        </div>
      </header>

      <main className="pb-28">
        <section className="border-b border-black/10" style={{ backgroundColor: 'var(--store-bg)' }}>
          <div className="mx-auto max-w-[1200px] px-4 py-4 lg:py-6">
            <div className="relative min-h-[250px] overflow-hidden rounded bg-[#15211d] sm:min-h-[340px]">
              {store.coverImageUrl && <img src={store.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/32 to-black/8" />
              <div className="relative flex h-full min-h-[250px] flex-col justify-end p-5 text-white sm:min-h-[340px] sm:p-8">
                <h1 className="max-w-[720px] text-[30px] font-semibold leading-tight sm:text-[42px]">{store.name}</h1>
                <p className="mt-3 max-w-[640px] text-[14px] leading-relaxed text-white/84 sm:text-[15px]">
                  {store.description || 'Commandez vos produits en ligne et recevez une confirmation instantanée.'}
                </p>
                <div className="mt-5 flex flex-wrap gap-2 text-[12.5px] text-white/88">
                  {store.phone && <ContactChip icon={<Phone size={14} />} label={store.phone} />}
                  {(store.user?.address || store.email) && <ContactChip icon={<MapPin size={14} />} label={store.user?.address || store.email || ''} />}
                  <ContactChip icon={store.paymentMode === 'COD' ? <Truck size={14} /> : <CreditCard size={14} />} label={paymentModeLabel(store.paymentMode)} />
                </div>
              </div>
            </div>
            <div className="store-surface store-border mt-3 grid grid-cols-3 divide-x rounded border">
              <StoreBenefit icon={<ShieldCheck size={17} />} title="Commande sécurisée" />
              <StoreBenefit icon={<Truck size={17} />} title={store.paymentMode === 'ONLINE' ? 'Paiement en ligne' : 'Livraison disponible'} />
              <StoreBenefit icon={<Phone size={17} />} title="Contact marchand" />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-[1200px] gap-5 px-4 py-5 lg:grid-cols-[1fr_352px] lg:py-7">
          <div className="min-w-0">
            {featured.length > 0 && !search && !category && (
              <div className="mb-7">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[18px] font-semibold" style={{ color: 'var(--store-accent)' }}>Sélection de la boutique</div>
                    <div className="store-muted text-[12.5px]">Les produits recommandés par le marchand</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {featured.map(product => (
                    <FeaturedProduct key={product.id} product={product} onOpen={() => setSelectedProduct(product)} />
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3">
              <div className="text-[18px] font-semibold" style={{ color: 'var(--store-accent)' }}>Tous les produits</div>
              <div className="store-muted text-[12.5px]">{filtered.length} article{filtered.length > 1 ? 's' : ''}</div>
            </div>
            <div className={`mb-5 grid gap-2 ${categories.length > 1 ? 'sm:grid-cols-[minmax(220px,1fr)_180px_180px]' : 'sm:grid-cols-[minmax(220px,1fr)_180px]'}`}>
              <div className="relative min-w-0">
                <SearchIcon size={15} className="store-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={search} onChange={e => setSearch(e.target.value)} className="storefront-input h-11 w-full rounded border pl-9 pr-3 text-[13px] outline-none" placeholder="Rechercher dans la boutique..." />
              </div>
              {categories.length > 1 && (
                <select
                  value={category ?? ''}
                  onChange={event => setCategory(event.target.value || null)}
                  className="storefront-input h-11 rounded border px-3 text-[13px] outline-none"
                  aria-label="Filtrer par catégorie"
                >
                  <option value="">Toutes les catégories</option>
                  {categories.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              )}
              <select
                value={sort}
                onChange={event => setSort(event.target.value)}
                className="storefront-input h-11 rounded border px-3 text-[13px] outline-none"
                aria-label="Trier les produits"
              >
                <option value="featured">Recommandés</option>
                <option value="recent">Nouveautés</option>
                <option value="price-asc">Prix croissant</option>
                <option value="price-desc">Prix décroissant</option>
                <option value="name">Nom A-Z</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="store-surface store-border store-muted rounded border border-dashed p-10 text-center">Aucun produit ne correspond à votre recherche.</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                {filtered.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    quantity={cart[product.id] ?? 0}
                    onQty={(q) => setQty(product.id, q)}
                    onOpen={() => setSelectedProduct(product)}
                  />
                ))}
              </div>
            )}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-[84px]">
              <CartBox cartLines={cartLines} subtotal={subtotal} taxAmount={taxAmount} total={total} store={store} setQty={setQty} onCheckout={() => setCheckoutOpen(true)} />
            </div>
          </aside>
        </section>
      </main>

      {cartLines.length > 0 && (
        <div className="store-surface store-border fixed bottom-0 left-0 right-0 z-30 border-t p-3 shadow-[0_-10px_30px_rgba(15,32,28,0.12)] lg:hidden">
          <button
            className="flex h-12 w-full items-center justify-between rounded px-4 text-[14px] font-semibold"
            style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
            onClick={() => setCheckoutOpen(true)}
          >
            <span className="inline-flex items-center gap-2"><ShoppingBag size={17} /> Commander</span>
            <span className="font-mono">{fmtXOF(total)}</span>
          </button>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutModal
          store={store}
          cartLines={cartLines}
          subtotal={subtotal}
          taxAmount={taxAmount}
          total={total}
          onClose={() => setCheckoutOpen(false)}
        />
      )}

      {selectedProduct && (
        <ProductDetail
          product={selectedProduct}
          quantity={cart[selectedProduct.id] ?? 0}
          onQty={quantity => setQty(selectedProduct.id, quantity)}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}

function ProductCard({ product, quantity, onQty, onOpen }: { product: StoreProduct; quantity: number; onQty: (q: number) => void; onOpen: () => void }) {
  const soldOut = product.status === 'SOLD_OUT' || (product.trackStock && !product.allowBackorder && (product.stock ?? 0) <= 0);
  const preorder = (product.stock ?? 0) <= 0 && product.allowBackorder;
  return (
    <article className="flex min-h-[294px] flex-col overflow-hidden rounded border border-black/10 bg-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md">
      <button type="button" onClick={onOpen} className="relative block w-full text-left">
        <ProductThumb product={product} />
        {(soldOut || preorder) && (
          <span className="store-surface store-border absolute left-2 top-2 rounded border px-2 py-1 text-[10.5px] font-semibold shadow-sm">
            {preorder ? 'Précommande' : 'Épuisé'}
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button type="button" onClick={onOpen} className="min-w-0 text-left">
              <h2 className="text-[14px] font-semibold leading-snug sm:text-[15px]" style={{ color: 'var(--store-accent)' }}>{product.name}</h2>
            </button>
            {product.featured && <span className="hidden rounded bg-surface-2 px-2 py-1 text-[10.5px] font-semibold text-text-muted sm:inline">Top</span>}
          </div>
          {product.category && <div className="mt-1 truncate text-[11.5px] font-semibold" style={{ color: 'var(--store-primary)' }}>{product.category}</div>}
        </div>
        {product.description && <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-text-muted sm:text-[12.5px]">{product.description}</p>}
        <div className="mt-auto pt-3">
          <div className="mb-3 flex items-end justify-between gap-2">
            <div className="font-mono text-[14px] font-semibold sm:text-[15px]">{fmtXOF(product.price)}</div>
            {product.unit && <div className="text-[11px] text-text-muted">/{product.unit}</div>}
          </div>
          {quantity > 0 ? (
            <div className="grid h-10 grid-cols-[40px_1fr_40px] items-center overflow-hidden rounded border border-border bg-surface">
              <button className="grid h-10 place-items-center hover:bg-surface-2" onClick={() => onQty(quantity - 1)} aria-label="Réduire"><MinusIcon size={15} /></button>
              <span className="text-center text-[14px] font-semibold">{quantity}</span>
              <button className="grid h-10 place-items-center hover:bg-surface-2" onClick={() => onQty(quantity + 1)} aria-label="Ajouter"><PlusIcon size={15} /></button>
            </div>
          ) : (
            <button
              className="h-10 w-full rounded border px-3 text-[13px] font-semibold disabled:opacity-50"
              style={soldOut ? undefined : { borderColor: 'var(--store-primary)', color: 'var(--store-primary)' }}
              onClick={() => onQty(1)}
              disabled={soldOut}
            >
              {soldOut ? 'Épuisé' : preorder ? 'Précommander' : 'Ajouter au panier'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function FeaturedProduct({ product, onOpen }: { product: StoreProduct; onOpen: () => void }) {
  const unavailable = product.status === 'SOLD_OUT' && !product.allowBackorder;
  return (
    <button type="button" onClick={onOpen} className="overflow-hidden rounded border border-black/10 bg-white text-left shadow-sm">
      <div className="relative">
        <ProductThumb product={product} />
        {unavailable && <span className="store-surface store-border absolute left-2 top-2 rounded border px-2 py-1 text-[10px] font-semibold">Épuisé</span>}
      </div>
      <div className="p-3">
        <div className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--store-accent)' }}>{product.name}</div>
        <div className="mt-1 font-mono text-[12px] font-semibold" style={{ color: 'var(--store-primary)' }}>{fmtXOF(product.price)}</div>
      </div>
    </button>
  );
}

function ProductDetail({ product, quantity, onQty, onClose }: { product: StoreProduct; quantity: number; onQty: (quantity: number) => void; onClose: () => void }) {
  const soldOut = product.status === 'SOLD_OUT' || (!product.allowBackorder && (product.stock ?? 0) <= 0);
  const preorder = !soldOut && product.allowBackorder && (product.stock ?? 0) <= 0;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-text/45 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-auto rounded-t bg-white shadow-xl sm:max-w-[820px] sm:rounded" onClick={event => event.stopPropagation()}>
        <div className="grid sm:grid-cols-2">
          <div className="relative aspect-square bg-surface-2">
            {product.imageUrl
              ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
              : <div className="grid h-full place-items-center"><Package size={52} className="text-text-subtle" /></div>}
            <button onClick={onClose} className="store-surface absolute right-3 top-3 grid h-9 w-9 place-items-center rounded shadow-sm" aria-label="Fermer"><XIcon size={16} /></button>
          </div>
          <div className="flex min-h-0 flex-col p-5 sm:p-7">
            {product.category && <div className="text-[12px] font-semibold" style={{ color: 'var(--store-primary)' }}>{product.category}</div>}
            <h2 className="mt-1 text-[24px] font-semibold leading-tight" style={{ color: 'var(--store-accent)' }}>{product.name}</h2>
            <div className="mt-3 font-mono text-[20px] font-semibold">{fmtXOF(product.price)}</div>
            {product.description && <p className="mt-4 text-[13.5px] leading-relaxed text-text-muted">{product.description}</p>}
            <div className="mt-5 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${soldOut ? 'bg-surface-2 text-text-muted' : 'text-white'}`} style={soldOut ? undefined : { backgroundColor: 'var(--store-primary)' }}>
                {soldOut ? 'Épuisé' : preorder ? 'Disponible en précommande' : 'Disponible'}
              </span>
              {product.unit && <span className="text-[11.5px] text-text-muted">Vendu par {product.unit}</span>}
            </div>
            <div className="mt-auto pt-7">
              {quantity > 0 ? (
                <div className="grid h-12 grid-cols-[48px_1fr_48px] items-center overflow-hidden rounded border border-border">
                  <button className="grid h-12 place-items-center" onClick={() => onQty(quantity - 1)}><MinusIcon size={16} /></button>
                  <span className="text-center font-semibold">{quantity} dans le panier</span>
                  <button className="grid h-12 place-items-center" onClick={() => onQty(quantity + 1)}><PlusIcon size={16} /></button>
                </div>
              ) : (
                <button
                  className="h-12 w-full rounded text-[14px] font-semibold disabled:opacity-50"
                  style={soldOut ? undefined : { backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
                  onClick={() => onQty(1)}
                  disabled={soldOut}
                >
                  {soldOut ? 'Produit épuisé' : preorder ? 'Précommander' : 'Ajouter au panier'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CartBox({ cartLines, subtotal, taxAmount, total, store, setQty, onCheckout }: {
  cartLines: { product: StoreProduct; quantity: number }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  store: Store;
  setQty: (id: string, next: number) => void;
  onCheckout: () => void;
}) {
  return (
    <div className="rounded border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[15px] font-semibold">Panier</div>
        <div className="text-[12px] text-text-muted">{cartLines.length} ligne{cartLines.length > 1 ? 's' : ''}</div>
      </div>
      {cartLines.length === 0 ? (
        <div className="grid min-h-[160px] place-items-center rounded border border-dashed border-border text-center text-[13px] text-text-muted">
          Votre panier est vide.
        </div>
      ) : (
        <>
          <div className="mb-4 flex max-h-[360px] flex-col gap-3 overflow-auto pr-1">
            {cartLines.map(({ product, quantity }) => (
              <div key={product.id} className="flex gap-3">
                <ProductThumb product={product} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{product.name}</div>
                  <div className="font-mono text-[12px] text-text-muted">{quantity} x {fmtXOF(product.price)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="icon-btn" onClick={() => setQty(product.id, quantity - 1)} aria-label="Réduire"><MinusIcon size={13} /></button>
                  <span className="w-5 text-center text-[13px] font-semibold">{quantity}</span>
                  <button className="icon-btn" onClick={() => setQty(product.id, quantity + 1)} aria-label="Ajouter"><PlusIcon size={13} /></button>
                </div>
              </div>
            ))}
          </div>
          <Totals subtotal={subtotal} taxAmount={taxAmount} total={total} taxRate={store.taxRate} />
          <button
            className="mt-4 h-11 w-full rounded px-4 text-[14px] font-semibold"
            style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
            onClick={onCheckout}
          >
            Finaliser la commande
          </button>
        </>
      )}
    </div>
  );
}

function CheckoutModal({ store, cartLines, subtotal, taxAmount, total, onClose }: {
  store: Store;
  cartLines: { product: StoreProduct; quantity: number }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  onClose: () => void;
}) {
  const methods = allowedPaymentMethods(store.paymentMode);
  const [paymentMethod, setPaymentMethod] = useState<StorePaymentMethod>(methods[0]);
  const [form, setForm] = useState<CheckoutForm>({
    customerName: '',
    customerPhone: '',
    customerPhoneCountry: store.momoCountry || store.phoneCountry || 'bj',
    customerEmail: '',
    customerCity: '',
    customerAddress: '',
    customerNote: '',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => storesApi.checkout(store.slug, {
      ...form,
      customerPhone: toE164(form.customerPhone, form.customerPhoneCountry),
      paymentMethod,
      items: cartLines.map(line => ({ productId: line.product.id, quantity: line.quantity })),
    }),
    onSuccess: (res) => {
      const paymentUrl = res.data.paymentUrl;
      const orderId = res.data.order?.id;
      if (paymentUrl) window.location.href = paymentUrl;
      else if (orderId) window.location.href = `/store/${store.slug}/success?orderId=${orderId}&mode=cod`;
    },
    onError: (err: any) => setError(err?.response?.data?.message || 'Impossible de lancer la commande'),
  });

  function update<K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function startCheckout() {
    setError(null);
    if (cartLines.length === 0) {
      setError('Votre panier est vide.');
      return;
    }
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setError('Nom et téléphone obligatoires.');
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-text/45 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full overflow-auto rounded-t bg-white shadow-lg sm:max-w-[620px] sm:rounded" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center border-b border-border bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-semibold">Finaliser la commande</div>
            <div className="text-[12px] text-text-muted">{store.name}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><XIcon size={16} /></button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          {error && <div className="rounded border border-danger/25 bg-danger-soft p-3 text-[12.5px] text-danger">{error}</div>}

          {methods.length > 1 && (
            <div>
              <div className="mb-2 text-[12px] font-semibold text-text-muted">Mode de paiement</div>
              <div className="grid grid-cols-2 gap-2">
                <PaymentChoice active={paymentMethod === 'ONLINE'} icon={<CreditCard size={16} />} label="Payer en ligne" onClick={() => setPaymentMethod('ONLINE')} />
                <PaymentChoice active={paymentMethod === 'COD'} icon={<Truck size={16} />} label="À la livraison" onClick={() => setPaymentMethod('COD')} />
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nom complet">
              <input className="input" value={form.customerName} onChange={e => update('customerName', e.target.value)} />
            </Field>
            <Field label={paymentMethod === 'ONLINE' ? 'Téléphone Mobile Money' : 'Téléphone'}>
              <PhoneCountryInput
                phone={form.customerPhone}
                country={form.customerPhoneCountry}
                onPhoneChange={value => update('customerPhone', value)}
                onCountryChange={value => update('customerPhoneCountry', value)}
              />
            </Field>
            <Field label="Email optionnel">
              <input className="input" type="email" value={form.customerEmail} onChange={e => update('customerEmail', e.target.value)} />
            </Field>
            <Field label="Ville">
              <input className="input" value={form.customerCity} onChange={e => update('customerCity', e.target.value)} />
            </Field>
          </div>
          <Field label="Adresse de livraison">
            <input className="input" value={form.customerAddress} onChange={e => update('customerAddress', e.target.value)} />
          </Field>
          <Field label="Note pour le vendeur">
            <textarea className="input min-h-[76px] py-2.5" value={form.customerNote} onChange={e => update('customerNote', e.target.value)} />
          </Field>
          <Totals subtotal={subtotal} taxAmount={taxAmount} total={total} taxRate={store.taxRate} />
          <Button
            variant="primary"
            className="w-full"
            loading={mutation.isPending}
            onClick={startCheckout}
            style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}
          >
            <CheckIcon size={15} /> {paymentMethod === 'COD' ? `Envoyer la commande · ${fmtXOF(total)}` : `Payer ${fmtXOF(total)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Totals({ subtotal, taxAmount, total, taxRate }: { subtotal: number; taxAmount: number; total: number; taxRate: number }) {
  return (
    <div className="border-t border-border pt-3 flex flex-col gap-1.5 text-[13px]">
      <div className="flex justify-between gap-3"><span className="text-text-muted">Sous-total</span><span className="font-mono">{fmtXOF(subtotal)}</span></div>
      <div className="flex justify-between gap-3"><span className="text-text-muted">TVA {taxRate}%</span><span className="font-mono">{fmtXOF(taxAmount)}</span></div>
      <div className="flex justify-between gap-3 pt-1 text-[16px] font-semibold"><span>Total</span><span className="font-mono" style={{ color: 'var(--store-primary)' }}>{fmtXOF(total)}</span></div>
    </div>
  );
}

function ProductThumb({ product, size = 'md' }: { product: StoreProduct; size?: 'sm' | 'md' }) {
  const className = size === 'sm' ? 'h-11 w-11 rounded' : 'aspect-[4/3] w-full';
  return (
    <div className={`${className} flex-shrink-0 overflow-hidden bg-surface-2 grid place-items-center`}>
      {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package size={size === 'sm' ? 18 : 36} className="text-text-subtle" />}
    </div>
  );
}

function StoreLogo({ store }: { store: Store }) {
  if (store.logoUrl) return <img src={store.logoUrl} alt="" className="h-11 w-11 rounded object-cover" />;
  return (
    <div className="grid h-11 w-11 rounded place-items-center text-[15px] font-semibold" style={{ backgroundColor: 'var(--store-primary)', color: 'var(--store-button-text)' }}>
      {store.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function PaymentChoice({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 items-center justify-center gap-2 rounded border text-[13px] font-semibold"
      style={active ? { borderColor: 'var(--store-primary)', color: 'var(--store-primary)', backgroundColor: 'color-mix(in srgb, var(--store-primary) 9%, var(--store-surface))' } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

function StoreBenefit({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1.5 px-2 py-3 text-center sm:flex-row sm:text-left">
      <span style={{ color: 'var(--store-primary)' }}>{icon}</span>
      <span className="truncate text-[10.5px] font-semibold sm:text-[12px]" style={{ color: 'var(--store-accent)' }}>{title}</span>
    </div>
  );
}

function ContactChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded border border-white/18 bg-white/10 px-2.5 backdrop-blur"><span className="flex-shrink-0">{icon}</span><span className="truncate">{label}</span></span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className="block text-[12px] font-semibold text-text-muted mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function FullPageLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-surface-2">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function allowedPaymentMethods(mode: Store['paymentMode']): StorePaymentMethod[] {
  if (mode === 'COD') return ['COD'];
  if (mode === 'BOTH') return ['ONLINE', 'COD'];
  return ['ONLINE'];
}

function paymentModeLabel(mode: Store['paymentMode']) {
  if (mode === 'COD') return 'Paiement à la livraison';
  if (mode === 'BOTH') return 'Paiement en ligne ou livraison';
  return 'Paiement en ligne';
}
