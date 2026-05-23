import { useState, useEffect } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { useAuth } from '@/contexts/AuthContext';
import type { Quote } from '@/types';
import Button from '@/components/ui/Button';
import { DownloadIcon } from '@/components/ui/Icon';
import { X } from 'lucide-react';
import {
  PDF_TEMPLATES,
  downloadWithTemplate,
  getEffectiveLogo,
  fetchLogoBase64,
  type TemplateId,
  type TemplateCategory,
} from './QuotePDFTemplates';

interface Props {
  quote: Quote;
  onClose: () => void;
}

const CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'classique', label: 'Classique' },
  { id: 'dynamique', label: 'Dynamique' },
  { id: 'épuré', label: 'Épuré' },
  { id: 'moderne', label: 'Moderne' },
];

export default function TemplateSelectorModal({ quote, onClose }: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<TemplateId>('classique');
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('tous');
  const [downloading, setDownloading] = useState(false);
  const [logo, setLogo] = useState<string | null | undefined>(undefined);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    const url = getEffectiveLogo(quote);
    if (!url) { setLogo(null); return; }
    fetchLogoBase64(url).then(setLogo).catch(() => setLogo(null));
  }, []);

  function handleSelectTemplate(id: TemplateId) {
    setSelected(id);
    setPreviewKey(k => k + 1);
  }

  function handleSelectCategory(cat: TemplateCategory) {
    setActiveCategory(cat);
    // Si le template sélectionné n'est pas dans la nouvelle catégorie, sélectionner le premier visible
    const filtered = cat === 'tous' ? PDF_TEMPLATES : PDF_TEMPLATES.filter(t => t.category === cat);
    if (filtered.length > 0 && !filtered.find(t => t.id === selected)) {
      handleSelectTemplate(filtered[0].id);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadWithTemplate(quote, selected, user?.plan);
      onClose();
    } finally {
      setDownloading(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const filteredTemplates = activeCategory === 'tous'
    ? PDF_TEMPLATES
    : PDF_TEMPLATES.filter(t => t.category === activeCategory);

  const selectedTmpl = PDF_TEMPLATES.find(t => t.id === selected) ?? PDF_TEMPLATES[0];
  const logoReady = logo !== undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-surface rounded-xl border border-border shadow-2xl w-full max-w-[1200px] h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div>
            <div className="font-semibold text-[15px]">Choisir un template</div>
            <div className="text-[12px] text-text-muted mt-0.5">
              Sélectionnez un modèle qui reflète votre identité professionnelle
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-surface-2 text-text-muted transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* ── Body : 2 colonnes ── */}
        <div className="flex-1 flex min-h-0">

          {/* Colonne gauche : filtres + grille */}
          <div className="w-[300px] flex-shrink-0 border-r border-border flex flex-col min-h-0">

            {/* Chips de catégories */}
            <div className="px-4 pt-4 pb-3 flex-shrink-0">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelectCategory(cat.id)}
                    className={[
                      'px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150',
                      activeCategory === cat.id
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text',
                    ].join(' ')}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Compteur */}
            <div className="px-4 pb-2 flex-shrink-0">
              <span className="text-[11px] text-text-muted">
                {filteredTemplates.length} modèle{filteredTemplates.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Grille des templates */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-2 gap-3">
                {filteredTemplates.map((tmpl) => {
                  const isSelected = selected === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl.id)}
                      className={[
                        'flex flex-col items-center gap-2 p-1.5 rounded-xl border-2 transition-all duration-150',
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-transparent hover:border-border-strong hover:bg-surface-2',
                      ].join(' ')}
                    >
                      {/* Miniature A4 */}
                      <div
                        className="w-full rounded-lg overflow-hidden shadow-sm border border-border"
                        style={{ aspectRatio: '1 / 1.414' }}
                      >
                        {tmpl.thumbnail}
                      </div>
                      {/* Nom + catégorie badge */}
                      <div className="w-full text-center">
                        <span className={`text-[11px] font-semibold leading-tight block ${isSelected ? 'text-primary' : 'text-text'}`}>
                          {tmpl.name}
                        </span>
                        {activeCategory === 'tous' && (
                          <span className="text-[9px] text-text-muted capitalize mt-0.5 block">
                            {tmpl.category}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Colonne droite : aperçu PDF */}
          <div className="flex-1 bg-[#E8E8E8] flex items-center justify-center overflow-hidden relative">
            {!logoReady ? (
              <div className="flex flex-col items-center gap-3 text-text-muted">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-[13px]">Préparation de l'aperçu…</span>
              </div>
            ) : (
              <PDFViewer
                key={previewKey}
                style={{ width: '100%', height: '100%', border: 'none' }}
                showToolbar={false}
              >
                {selectedTmpl.document(quote, logo)}
              </PDFViewer>
            )}

            {/* Badge template sélectionné */}
            {logoReady && (
              <div className="absolute bottom-4 left-4 bg-black/60 text-white text-[11px] font-medium px-3 py-1.5 rounded-full backdrop-blur-sm pointer-events-none flex items-center gap-1.5">
                <span className="capitalize opacity-60 text-[10px]">{selectedTmpl.category}</span>
                <span className="opacity-40">·</span>
                <span>{selectedTmpl.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between flex-shrink-0 bg-surface">
          <div className="text-[12px] text-text-muted">
            Modèle sélectionné :{' '}
            <span className="font-semibold text-text">{selectedTmpl.name}</span>
            <span className="ml-1 text-[11px] opacity-60 capitalize">({selectedTmpl.category})</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={downloading}>
              Annuler
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={downloading}
              disabled={!logoReady}
              onClick={handleDownload}
            >
              <DownloadIcon size={13} />
              Télécharger PDF
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
