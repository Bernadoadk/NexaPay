import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { productsApi } from '@/lib/api';
import { fmtXOF } from '@/lib/utils';
import type { Product, ProductSort } from '@/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ContextMenu from '@/components/ui/ContextMenu';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  PlusIcon, TrashIcon, EditIcon, XIcon, ReceiptIcon,
  SearchIcon, CopyIcon, MoreIcon, CheckIcon, ChevronDownIcon, AlertCircleIcon,
} from '@/components/ui/Icon';

interface ProductFormData {
  name: string;
  description?: string;
  category?: string;
  price: number;
  unit?: string;
}

const SORT_LABELS: Record<ProductSort, string> = {
  name: 'Nom (A→Z)',
  'price-asc': 'Prix croissant',
  'price-desc': 'Prix décroissant',
  used: 'Plus utilisés',
  recent: 'Récents',
};

const UNIT_SUGGESTIONS = ['forfait', 'heure', 'jour', 'm²', 'kg', 'ml', 'unité', 'séance'];
const CATEGORY_SUGGESTIONS = ['Service', 'Produit', 'Forfait', 'Maintenance', 'Conseil', 'Formation', 'Création'];

const CATEGORY_COLORS: { bg: string; text: string; border: string }[] = [
  { bg: '#E8EFFE', text: '#1E40AF', border: '#BFDBFE' },
  { bg: '#E6F4EE', text: '#0C7A56', border: '#BBF7D0' },
  { bg: '#FBEFDF', text: '#A1530F', border: '#FDE68A' },
  { bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' },
  { bg: '#FCE7F3', text: '#9D174D', border: '#FBCFE8' },
  { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  { bg: '#ECFEFF', text: '#155E75', border: '#A5F3FC' },
];

function categoryColor(cat?: string | null) {
  if (!cat) return null;
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) >>> 0;
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

function CategoryChip({ category }: { category?: string | null }) {
  if (!category) return null;
  const c = categoryColor(category)!;
  return (
    <span
      className="inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {category}
    </span>
  );
}

function UsageBadge({ count, billed }: { count?: number; billed?: number }) {
  if (!count) return <span className="text-[11.5px] text-text-subtle">Jamais utilisé</span>;
  return (
    <div className="leading-[1.2]">
      <div className="text-[12px] font-semibold">{count}× dans des devis</div>
      {billed ? (
        <div className="text-[11px] text-text-muted font-mono">{fmtXOF(billed)} facturé</div>
      ) : (
        <div className="text-[11px] text-text-subtle">aucun encaissé</div>
      )}
    </div>
  );
}

function ProductModal({
  product,
  onClose,
  existingCategories,
}: {
  product?: Product;
  onClose: () => void;
  existingCategories: string[];
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(product);
  const {
    register, handleSubmit, watch, setValue,
    formState: { isSubmitting, errors },
  } = useForm<ProductFormData>({
    defaultValues: product
      ? {
          name: product.name,
          description: product.description ?? '',
          category: product.category ?? '',
          price: product.price,
          unit: product.unit ?? '',
        }
      : { price: 0, name: '' },
  });
  const [serverError, setServerError] = useState<string | null>(null);

  const priceWatch = watch('price');
  const unitWatch = watch('unit');
  const categoryWatch = watch('category');
  const categoryOptions = useMemo(() => {
    const all = new Set([...existingCategories, ...CATEGORY_SUGGESTIONS]);
    return Array.from(all);
  }, [existingCategories]);

  const mutation = useMutation({
    mutationFn: (data: ProductFormData) =>
      isEdit ? productsApi.update(product!.id, data) : productsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (err: any) => {
      setServerError(err?.response?.data?.message || 'Erreur lors de l\'enregistrement');
    },
  });

  return (
    <div
      className="fixed inset-0 z-40 bg-text/30 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded shadow-lg w-full max-w-[480px] max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex-1 text-[15px] font-semibold">
            {isEdit ? 'Modifier l\'article' : 'Nouvel article du catalogue'}
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2">
            <XIcon size={16} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(d => { setServerError(null); mutation.mutate(d); })}
          className="p-6 flex flex-col gap-4 overflow-auto"
        >
          {serverError && (
            <div className="flex items-start gap-2 p-2.5 bg-danger-soft border border-danger/30 rounded text-[12px] text-danger">
              <AlertCircleIcon size={14} className="flex-shrink-0 mt-px" />
              {serverError}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-text-muted mb-1.5">
              Nom de l'article <span className="text-danger">*</span>
            </label>
            <input
              {...register('name', { required: 'Nom obligatoire' })}
              autoFocus
              placeholder="ex. Conception logo & charte"
              className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            />
            {errors.name && <div className="text-[11.5px] text-danger mt-1">{errors.name.message}</div>}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-text-muted mb-1.5">
              Description <span className="text-text-subtle font-normal">(insérée dans la ligne du devis)</span>
            </label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="ex. Logo vectoriel, déclinaisons et guide d'utilisation"
              className="w-full px-3 py-2.5 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft resize-y min-h-[68px] leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Catégorie</label>
            <input
              {...register('category')}
              list="product-category-options"
              placeholder="ex. Service, Maintenance, Forfait…"
              className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            />
            <datalist id="product-category-options">
              {categoryOptions.map(c => <option key={c} value={c} />)}
            </datalist>
            {categoryWatch && (
              <div className="mt-1.5"><CategoryChip category={categoryWatch} /></div>
            )}
          </div>

          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Prix unitaire (FCFA)</label>
              <input
                type="number"
                min={0}
                step={100}
                {...register('price', { valueAsNumber: true, min: { value: 0, message: 'Doit être ≥ 0' } })}
                placeholder="0"
                className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface font-mono text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
              />
              <div className="text-[11px] text-text-muted mt-1 font-mono">
                {Number.isFinite(priceWatch) && priceWatch > 0
                  ? fmtXOF(priceWatch)
                  : <span className="text-text-subtle">Aperçu du prix</span>}
                {unitWatch && priceWatch > 0 && <span className="text-text-muted"> / {unitWatch}</span>}
              </div>
              {errors.price && <div className="text-[11.5px] text-danger mt-1">{errors.price.message}</div>}
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Unité</label>
              <input
                {...register('unit')}
                list="product-unit-options"
                placeholder="forfait"
                className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
              />
              <datalist id="product-unit-options">
                {UNIT_SUGGESTIONS.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>

          <div>
            <div className="text-[11px] text-text-muted mb-1.5">Suggestions d'unité</div>
            <div className="flex flex-wrap gap-1.5">
              {UNIT_SUGGESTIONS.map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setValue('unit', u, { shouldDirty: true })}
                  className={`px-2.5 h-6 rounded-full text-[11.5px] border transition-colors ${
                    unitWatch === u
                      ? 'bg-primary-soft border-primary text-primary-hover font-semibold'
                      : 'bg-surface-2 border-border text-text-muted hover:border-border-strong hover:text-text'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-[2]"
              loading={mutation.isPending || isSubmitting}
            >
              {isEdit ? 'Enregistrer' : 'Ajouter au catalogue'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Products() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | undefined>();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ProductSort>('name');
  const [showArchived, setShowArchived] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', { search, sort, archived: showArchived ? 'all' : '0' }],
    queryFn: () =>
      productsApi
        .list({ search: search || undefined, sort, archived: showArchived ? 'all' : '0' })
        .then(r => r.data),
  });

  const filtered = useMemo(
    () => (activeCategory ? products.filter(p => (p.category ?? '') === activeCategory) : products),
    [products, activeCategory],
  );

  const categoriesInUse = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      const key = p.category ?? '';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const totalCatalogValue = products.reduce((s, p) => s + p.price, 0);
  const archivedCount = products.filter(p => p.archived).length;
  const usageTotal = products.reduce((s, p) => s + (p.usageCount ?? 0), 0);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (err: any) => {
      const data = err?.response?.data;
      if (data?.code === 'IN_USE') {
        setErrorBanner(data.message);
      } else {
        setErrorBanner(data?.message || 'Erreur lors de la suppression');
      }
      setTimeout(() => setErrorBanner(null), 6000);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      productsApi.archive(id, archived),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => productsApi.duplicate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  function openEdit(p: Product) {
    setEditing(p);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(undefined);
  }

  function actionsFor(p: Product) {
    const items = [
      { label: 'Modifier', icon: <EditIcon size={14} />, onClick: () => openEdit(p) },
      { label: 'Dupliquer', icon: <CopyIcon size={14} />, onClick: () => duplicateMutation.mutate(p.id) },
      {
        label: p.archived ? 'Désarchiver' : 'Archiver',
        icon: (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
            <path d="M10 12h4" />
          </svg>
        ),
        onClick: () => archiveMutation.mutate({ id: p.id, archived: !p.archived }),
      },
      {
        label: 'Supprimer',
        danger: true,
        icon: <TrashIcon size={14} />,
        onClick: async () => {
          const confirmed = await confirm({
            eyebrow: 'Suppression du catalogue',
            title: `Supprimer "${p.name}" ?`,
            description: 'Cet article sera supprimé du catalogue. Les produits déjà utilisés dans des devis peuvent être protégés par le système.',
            confirmLabel: 'Supprimer l’article',
            tone: 'danger',
          });
          if (confirmed) deleteMutation.mutate(p.id);
        },
      },
    ];
    return items;
  }

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  const hasNoProductsAtAll = !isLoading && products.length === 0 && !search && !activeCategory;
  const hasNoResults = !isLoading && filtered.length === 0 && (search || activeCategory);

  return (
    <div className="h-full overflow-auto scrollbar-thin p-6 lg:p-7 pb-24">
      {/* Header */}
      <div className="flex items-start gap-4 mb-5 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="text-[22px] font-semibold tracking-[-0.02em]">Produits & services</div>
          <div className="text-[13px] text-text-muted mt-1">
            Votre bibliothèque réutilisable. Insérez vos prestations en un clic dans vos devis.
          </div>
        </div>
        <Button variant="primary" onClick={() => { setEditing(undefined); setShowModal(true); }}>
          <PlusIcon size={15} /> Ajouter un article
        </Button>
      </div>

      {/* Stat cards */}
      {!hasNoProductsAtAll && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Articles actifs" value={String(products.filter(p => !p.archived).length)} />
          <StatCard
            label="Valeur du catalogue"
            value={fmtXOF(totalCatalogValue)}
            mono
            hint="somme des prix unitaires"
          />
          <StatCard label="Utilisations totales" value={`${usageTotal}×`} hint="dans des devis" />
          <StatCard label="Archivés" value={String(archivedCount)} hint="masqués par défaut" />
        </div>
      )}

      {errorBanner && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-danger-soft border border-danger/30 rounded text-[12.5px] text-danger">
          <AlertCircleIcon size={15} className="flex-shrink-0 mt-px" />
          <span className="flex-1">{errorBanner}</span>
        </div>
      )}

      {/* Toolbar */}
      {!hasNoProductsAtAll && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[360px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              <SearchIcon size={14} />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom, description, catégorie…"
              className="w-full h-9 pl-8 pr-8 rounded-sm border border-border-strong bg-surface text-[13px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:bg-surface-2"
                aria-label="Effacer"
              >
                <XIcon size={12} />
              </button>
            )}
          </div>

          {/* Sort */}
          <SortMenu value={sort} onChange={setSort} />

          {/* Archived toggle */}
          <button
            type="button"
            onClick={() => setShowArchived(v => !v)}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-sm border text-[12.5px] transition-colors ${
              showArchived
                ? 'border-primary bg-primary-soft text-primary-hover font-semibold'
                : 'border-border-strong bg-surface text-text-muted hover:text-text'
            }`}
          >
            {showArchived ? <CheckIcon size={13} /> : null}
            Afficher archivés ({archivedCount})
          </button>
        </div>
      )}

      {/* Category chips */}
      {!hasNoProductsAtAll && categoriesInUse.length > 1 && (
        <div className="flex items-center gap-1.5 mb-4 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={`h-7 px-2.5 rounded-full text-[12px] border transition-colors ${
              !activeCategory
                ? 'bg-text text-surface border-text font-semibold'
                : 'bg-surface border-border text-text-muted hover:border-border-strong hover:text-text'
            }`}
          >
            Toutes ({products.length})
          </button>
          {categoriesInUse.map(([cat, count]) => (
            <button
              key={cat || 'none'}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`h-7 px-2.5 rounded-full text-[12px] border transition-colors ${
                activeCategory === cat
                  ? 'bg-text text-surface border-text font-semibold'
                  : 'bg-surface border-border text-text-muted hover:border-border-strong hover:text-text'
              }`}
            >
              {cat || 'Sans catégorie'} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : hasNoProductsAtAll ? (
        <EmptyCatalog onCreate={() => setShowModal(true)} />
      ) : hasNoResults ? (
        <EmptyResults onClear={() => { setSearch(''); setActiveCategory(null); }} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-surface border border-border rounded overflow-hidden shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-2">
                  {['Article', 'Catégorie', 'Usage', 'Prix unitaire', ''].map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-4 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-[0.04em] border-b border-border"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    className={`border-t border-border hover:bg-surface-2 transition-colors group ${
                      p.archived ? 'opacity-60' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-[8px] bg-primary-soft grid place-items-center flex-shrink-0 mt-0.5">
                          <ReceiptIcon size={16} className="text-primary-hover" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-semibold truncate">{p.name}</span>
                            {p.archived && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2 border border-border text-text-muted">
                                Archivé
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <div className="text-[12.5px] text-text-muted mt-0.5 line-clamp-2 leading-snug">
                              {p.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <CategoryChip category={p.category} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <UsageBadge count={p.usageCount} billed={p.totalBilled} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="font-mono font-semibold text-[14px]">{fmtXOF(p.price)}</div>
                      {p.unit && <div className="text-[11.5px] text-text-muted">/ {p.unit}</div>}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <ContextMenu items={actionsFor(p)}>
                        <button
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted"
                          aria-label="Actions"
                        >
                          <MoreIcon size={16} />
                        </button>
                      </ContextMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden flex flex-col gap-3">
            {filtered.map(p => (
              <Card key={p.id} className={`flex gap-3 items-start ${p.archived ? 'opacity-60' : ''}`}>
                <div className="w-10 h-10 rounded-[10px] bg-primary-soft grid place-items-center flex-shrink-0 mt-0.5">
                  <ReceiptIcon size={18} className="text-primary-hover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[14px] font-semibold truncate">{p.name}</span>
                        {p.archived && (
                          <span className="text-[9.5px] font-semibold uppercase px-1.5 py-px rounded bg-surface-2 border border-border text-text-muted">
                            Archivé
                          </span>
                        )}
                      </div>
                      {p.description && (
                        <div className="text-[12px] text-text-muted mt-0.5 line-clamp-2 leading-snug">
                          {p.description}
                        </div>
                      )}
                    </div>
                    <ContextMenu items={actionsFor(p)}>
                      <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted -mt-1" aria-label="Actions">
                        <MoreIcon size={16} />
                      </button>
                    </ContextMenu>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <CategoryChip category={p.category} />
                    <div className="font-mono text-[13px] font-semibold text-primary-hover">
                      {fmtXOF(p.price)}{p.unit ? ` / ${p.unit}` : ''}
                    </div>
                  </div>
                  {!!p.usageCount && (
                    <div className="text-[11.5px] text-text-muted mt-1">
                      {p.usageCount}× utilisé · {fmtXOF(p.totalBilled ?? 0)} facturé
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {showModal && (
        <ProductModal
          product={editing}
          onClose={closeModal}
          existingCategories={categoriesInUse.map(([c]) => c).filter(Boolean)}
        />
      )}
      {confirmDialog}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Subcomponents
// ──────────────────────────────────────────────────────────────

function StatCard({ label, value, hint, mono }: { label: string; value: string; hint?: string; mono?: boolean }) {
  return (
    <div className="bg-surface border border-border rounded p-3.5">
      <div className="text-[11.5px] text-text-muted uppercase tracking-[0.04em] font-semibold">{label}</div>
      <div className={`text-[18px] font-semibold mt-1 ${mono ? 'font-mono' : ''}`}>{value}</div>
      {hint && <div className="text-[11px] text-text-subtle mt-0.5">{hint}</div>}
    </div>
  );
}

function SortMenu({ value, onChange }: { value: ProductSort; onChange: (s: ProductSort) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-1.5 h-9 px-3 rounded-sm border border-border-strong bg-surface text-[12.5px] text-text-muted hover:text-text transition-colors"
      >
        Trier : <span className="font-semibold text-text">{SORT_LABELS[value]}</span>
        <ChevronDownIcon size={13} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-border rounded shadow-lg z-20 min-w-[200px] py-1">
          {(Object.keys(SORT_LABELS) as ProductSort[]).map(k => (
            <button
              key={k}
              onClick={() => { onChange(k); setOpen(false); }}
              className={`flex items-center justify-between w-full px-3 py-2 text-[13px] text-left hover:bg-surface-2 ${
                value === k ? 'font-semibold text-primary-hover' : ''
              }`}
            >
              {SORT_LABELS[k]}
              {value === k && <CheckIcon size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyCatalog({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-soft grid place-items-center mb-5">
        <ReceiptIcon size={32} className="text-primary" />
      </div>
      <div className="text-[16px] font-semibold mb-1.5">Votre catalogue est vide</div>
      <div className="text-[13.5px] text-text-muted mb-6 max-w-[360px] leading-relaxed">
        Ajoutez vos prestations courantes — par exemple <em>"Pose porte intérieure"</em> ou
        <em> "Maintenance mensuelle"</em> — pour les insérer en un clic dans vos devis.
      </div>
      <Button variant="primary" onClick={onCreate}>
        <PlusIcon size={15} /> Ajouter mon premier article
      </Button>
      <div className="text-[11.5px] text-text-subtle mt-5 max-w-[400px]">
        Astuce : Renseignez la <strong>description</strong> — elle apparaîtra dans le devis envoyé au client.
      </div>
    </div>
  );
}

function EmptyResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-surface border border-border border-dashed rounded">
      <div className="w-12 h-12 rounded-xl bg-surface-2 grid place-items-center mb-3">
        <SearchIcon size={20} className="text-text-muted" />
      </div>
      <div className="text-[14px] font-semibold mb-1">Aucun résultat</div>
      <div className="text-[12.5px] text-text-muted mb-4">Essayez d'élargir la recherche ou de retirer les filtres.</div>
      <button
        onClick={onClear}
        className="text-[12.5px] font-semibold text-primary hover:underline"
      >
        Réinitialiser
      </button>
    </div>
  );
}
