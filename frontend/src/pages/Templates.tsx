import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quoteTemplatesApi } from '@/lib/api';
import { fmtXOF } from '@/lib/utils';
import type { QuoteTemplate } from '@/types';
import Button from '@/components/ui/Button';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  PlusIcon, ReceiptIcon, SearchIcon, TrashIcon, CopyIcon,
} from '@/components/ui/Icon';

export default function Templates() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirmDialog();
  const [search, setSearch] = useState('');

  const { data: templates = [], isLoading } = useQuery<QuoteTemplate[]>({
    queryKey: ['quote-templates'],
    queryFn: () => quoteTemplatesApi.list().then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quoteTemplatesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quote-templates'] }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      (t.category ?? '').toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q),
    );
  }, [templates, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, QuoteTemplate[]>();
    filtered.forEach(t => {
      const key = t.category?.trim() || 'Sans catégorie';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Sans catégorie') return 1;
      if (b === 'Sans catégorie') return -1;
      return a.localeCompare(b, 'fr');
    });
  }, [filtered]);

  async function handleDelete(template: QuoteTemplate) {
    const ok = await confirm({
      eyebrow: 'Suppression définitive',
      title: `Supprimer "${template.name}" ?`,
      description: 'Ce template ne sera plus disponible pour créer de nouveaux devis. Les devis déjà créés ne changent pas.',
      confirmLabel: 'Supprimer',
      tone: 'danger',
    });
    if (ok) deleteMutation.mutate(template.id);
  }

  return (
    <div className="h-full overflow-auto scrollbar-thin p-4 lg:p-7">
      <div className="flex items-center gap-3 mb-4 lg:mb-5">
        <div className="flex-1 min-w-0">
          <div className="text-[22px] font-semibold tracking-[-0.02em]">Templates</div>
          <div className="text-[12.5px] text-text-muted mt-0.5">
            Bases de devis réutilisables pour les offres qui reviennent souvent.
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('/quotes/new')}>
          <PlusIcon size={14} /> Nouveau devis
        </Button>
      </div>

      <div className="flex gap-2.5 mb-4">
        <div className="relative flex-1 max-w-[420px]">
          <SearchIcon size={15} className="absolute left-3 top-[13px] text-text-muted" />
          <input
            className="w-full h-10 pl-9 pr-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            placeholder="Rechercher par nom, objet, catégorie..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 grid place-items-center">
          <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-surface border border-border rounded shadow-sm py-14 px-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary-soft grid place-items-center text-primary-hover mx-auto mb-3">
            <ReceiptIcon size={22} />
          </div>
          <div className="text-[15px] font-semibold">Aucun template enregistré</div>
          <div className="text-[12.5px] text-text-muted mt-1 max-w-[420px] mx-auto">
            Créez un devis type, puis utilisez “Enregistrer template” dans l’écran de création.
          </div>
          <Button className="mt-4" variant="primary" size="sm" onClick={() => navigate('/quotes/new')}>
            Créer un devis
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 text-center text-[13px] text-text-muted">
          Aucun template ne correspond à “{search}”.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([category, categoryTemplates]) => (
            <section key={category}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted mb-2">
                {category} · {categoryTemplates.length}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {categoryTemplates.map(template => (
                  <article
                    key={template.id}
                    className="bg-surface border border-border rounded shadow-sm p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-soft grid place-items-center text-primary-hover flex-shrink-0">
                        <ReceiptIcon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold truncate">{template.name}</div>
                        <div className="text-[12px] text-text-muted truncate mt-0.5">{template.title}</div>
                      </div>
                    </div>

                    {template.description && (
                      <div className="text-[12px] text-text-muted leading-snug line-clamp-2">
                        {template.description}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 text-[12px]">
                      <div className="bg-surface-2 rounded p-2">
                        <div className="text-[10.5px] text-text-muted">Total</div>
                        <div className="font-mono font-semibold truncate">{fmtXOF(template.total)}</div>
                      </div>
                      <div className="bg-surface-2 rounded p-2">
                        <div className="text-[10.5px] text-text-muted">Lignes</div>
                        <div className="font-semibold">{template.items?.length ?? 0}</div>
                      </div>
                      <div className="bg-surface-2 rounded p-2">
                        <div className="text-[10.5px] text-text-muted">Utilisé</div>
                        <div className="font-semibold">{template.usageCount}</div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-auto">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate(`/quotes/new?templateId=${template.id}`)}
                      >
                        <CopyIcon size={13} /> Utiliser
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger hover:bg-danger-soft"
                        loading={deleteMutation.isPending}
                        onClick={() => handleDelete(template)}
                      >
                        <TrashIcon size={13} />
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
