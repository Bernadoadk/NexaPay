import { useState } from 'react';
import Button from '@/components/ui/Button';
import { CopyIcon, XIcon } from '@/components/ui/Icon';

export type SaveQuoteTemplateMeta = {
  name: string;
  category?: string;
  description?: string;
};

export default function SaveQuoteTemplateModal({
  defaultName,
  loading,
  error,
  onClose,
  onSave,
}: {
  defaultName: string;
  loading: boolean;
  error?: string;
  onClose: () => void;
  onSave: (meta: SaveQuoteTemplateMeta) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-end lg:items-center justify-center p-0 lg:p-6" onClick={onClose}>
      <div
        className="w-full lg:max-w-[460px] bg-surface rounded-t-2xl lg:rounded-lg shadow-xl border border-border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 lg:px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-soft grid place-items-center text-primary-hover">
            <CopyIcon size={16} />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Enregistrer comme template</div>
            <div className="text-[12px] text-text-muted">Le client, le numéro et le statut ne seront pas copiés.</div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 grid place-items-center rounded hover:bg-surface-2 text-text-muted">
            <XIcon size={16} />
          </button>
        </div>

        <div className="p-4 lg:p-5 flex flex-col gap-3.5">
          <div>
            <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Nom du template</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="ex. Site web vitrine standard"
              className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Catégorie</label>
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="ex. Web, Marketing, Maintenance"
              className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Description interne</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optionnel"
              className="w-full px-3 py-2.5 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft resize-none"
            />
          </div>
          {error && <div className="text-[12px] text-danger font-medium">{error}</div>}
        </div>

        <div className="px-4 lg:px-5 py-3 border-t border-border bg-surface-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={loading}
            disabled={!name.trim()}
            onClick={() => onSave({ name, category, description })}
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
