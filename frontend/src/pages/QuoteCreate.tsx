import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi, clientsApi, productsApi, aiApi, creditsApi, paymentsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { momoLabel } from '@/lib/phone';
import { fmtXOF } from '@/lib/utils';
import type { Client, QuoteItem, Product, Quote } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import {
  ChevronRightIcon, TrashIcon, PlusIcon, ReceiptIcon,
  SendIcon, ChevronDownIcon, CheckIcon, SearchIcon,
} from '@/components/ui/Icon';

interface LineItem extends QuoteItem { _key: number; productId?: string | null; unit?: string | null }

const DEFAULT_NOTES = 'Règlement par virement Mobile Money ou MoMo Pay sous 15 jours après réception. Acompte de 40 % à la commande. Prix valables 30 jours.';

export default function QuoteCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id) && id !== 'new';
  const qc = useQueryClient();

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => clientsApi.list().then(r => r.data),
  });
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products', 'picker'],
    // Picker only ever wants active items.
    queryFn: () => productsApi.list({ archived: '0' }).then(r => r.data),
  });
  const { data: existingQuote } = useQuery<Quote>({
    queryKey: ['quote', id],
    queryFn: () => quotesApi.get(id!).then(r => r.data),
    enabled: isEdit,
  });

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);

  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<LineItem[]>([
    { _key: 1, description: 'Conception identité visuelle (logo + charte)', quantity: 1, unitPrice: 450000, total: 450000 },
    { _key: 2, description: 'Déclinaison print : carte de visite & papier en-tête', quantity: 1, unitPrice: 120000, total: 120000 },
  ]);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [taxRate, setTaxRate] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [issuedAt, setIssuedAt] = useState(todayISO);
  const [validDays, setValidDays] = useState(30);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [sendMomo, setSendMomo] = useState(false);
  const [showProductMenu, setShowProductMenu] = useState(false);
  const canUseMomo = user?.plan === 'PRO' || user?.plan === 'BUSINESS';

  // Initialise depuis l'existant (edit) ou depuis le paramètre d'URL ?clientId=
  useEffect(() => {
    if (existingQuote) {
      setClientId(existingQuote.clientId);
      setTitle(existingQuote.title);
      setNotes(existingQuote.notes ?? DEFAULT_NOTES);
      setTaxRate(existingQuote.taxRate);
      setDiscount(existingQuote.discount);
      setValidDays(existingQuote.validDays);
      setIssuedAt(existingQuote.issuedAt.slice(0, 10));
      setItems((existingQuote.items ?? []).map((it, i) => ({ ...it, _key: i + 1 })));
    }
  }, [existingQuote]);

  useEffect(() => {
    const preselect = searchParams.get('clientId');
    if (preselect) setClientId(preselect);
    else if (clients.length > 0 && !clientId) setClientId(clients[0].id);
  }, [clients, searchParams]);

  useEffect(() => {
    if (!canUseMomo && sendMomo) setSendMomo(false);
  }, [canUseMomo, sendMomo]);

  // Totaux calculés
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const discountAmt = subtotal * (discount / 100);
  const taxable = subtotal - discountAmt;
  const taxAmount = taxable * (taxRate / 100);
  const total = taxable + taxAmount;

  function updateItem(key: number, patch: Partial<LineItem>) {
    setItems(prev => prev.map(it => {
      if (it._key !== key) return it;
      const m = { ...it, ...patch };
      return { ...m, total: m.quantity * m.unitPrice };
    }));
  }
  function removeItem(key: number) { setItems(prev => prev.filter(it => it._key !== key)); }
  function addItem() { setItems(prev => [...prev, { _key: Date.now(), description: '', quantity: 1, unitPrice: 0, total: 0 }]); }
  function addFromProduct(p: Product) {
    // The description sent to the client = product name, optionally followed by
    // its description for context. The freelancer can still edit the line.
    const desc = p.description?.trim()
      ? `${p.name} — ${p.description.trim()}`
      : p.name;
    setItems(prev => [...prev, {
      _key: Date.now(),
      description: desc,
      quantity: 1,
      unitPrice: p.price,
      total: p.price,
      unit: p.unit ?? null,
      productId: p.id,
    }]);
    setShowProductMenu(false);
  }

  async function handleAiGenerate() {
    if (!aiDescription.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const res = await aiApi.generateQuote(aiDescription);
      const { title: aiTitle, items: aiItems, aiCredits: remaining } = res.data;
      if (aiTitle) setTitle(aiTitle);
      if (aiItems?.length) {
        setItems(aiItems.map((it: { description: string; quantity: number; unitPrice: number }, i: number) => ({
          _key: Date.now() + i,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.quantity * it.unitPrice,
        })));
      }
      setAiCredits(remaining);
      setShowAiPanel(false);
      setAiDescription('');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Erreur IA';
      setAiError(msg);
      if (err.response?.data?.aiCredits !== undefined) setAiCredits(err.response.data.aiCredits);
    } finally {
      setAiLoading(false);
      qc.invalidateQueries({ queryKey: ['credits'] });
    }
  }

  const [saveError, setSaveError] = useState('');
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiCredits, setAiCredits] = useState<number | null>(null);

  useEffect(() => {
    creditsApi.balance().then(r => setAiCredits(r.data.aiCredits)).catch(() => {});
  }, []);

  const mutation = useMutation({
    mutationFn: async (asDraft: boolean) => {
      if (!clientId) throw new Error('Veuillez sélectionner un client');
      if (items.length === 0) throw new Error('Ajoutez au moins un produit ou service');
      if (!title.trim()) throw new Error("L'objet du devis est obligatoire");

      const payload = {
        title: title.trim(),
        clientId,
        notes,
        taxRate,
        discount,
        issuedAt,
        validDays,
        sendEmail,
        sendWhatsapp,
        sendMomo,
        items: items.map(({ _key, id: _id, ...it }) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          unit: it.unit ?? null,
          productId: it.productId ?? null,
        })),
      };

      let res: { data: { id: string } };
      if (isEdit) {
        res = await quotesApi.update(id!, payload);
      } else {
        res = await quotesApi.create(payload);
      }

      if (!asDraft && sendMomo && canUseMomo && res.data.id) {
        await paymentsApi.initiate(res.data.id);
      }

      return res;
    },
    onSuccess: (res, asDraft) => {
      setSaveError('');
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['notif-quotes'] });
      navigate(`/quotes/${res.data.id}${!asDraft && sendEmail ? '?send=1' : ''}`);
    },
    onError: (err: any) => {
      setSaveError(err.response?.data?.message || err.message || 'Une erreur est survenue. Vérifiez votre connexion.');
    },
  });

  const selectedClient = clients.find(c => c.id === clientId);

  return (
    <div className="h-full overflow-auto scrollbar-thin" onClick={() => setShowProductMenu(false)}>
      {/* Datalist for inline unit suggestions on line items */}
      <datalist id="quote-item-units">
        {['forfait', 'heure', 'jour', 'm²', 'kg', 'ml', 'unité', 'séance'].map(u => (
          <option key={u} value={u} />
        ))}
      </datalist>
      <div className="p-3 lg:p-7 max-w-[1100px] mx-auto pb-28 lg:pb-7">
        {/* Header */}
        <div className="flex items-start mb-4 lg:mb-5 gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="hidden lg:flex text-[12px] text-text-muted items-center gap-1.5 mb-1">
              <span>Devis</span> <ChevronRightIcon size={12} />
              <span>{isEdit ? existingQuote?.number : 'Nouveau'}</span>
            </div>
            <div className="flex items-center gap-2 lg:gap-2.5">
              <div className="text-[18px] lg:text-[22px] font-semibold tracking-[-0.02em] truncate">
                {isEdit ? `Modifier ${existingQuote?.number}` : 'Nouveau devis'}
              </div>
              <span className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11px] lg:text-[11.5px] font-semibold bg-surface-2 text-text-muted flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-text-subtle" /> Brouillon
              </span>
            </div>
          </div>

          {/* DESKTOP actions — mobile has sticky bottom bar */}
          <div className="hidden lg:flex flex-col items-end gap-1.5">
            {saveError && (
              <div className="text-[12px] text-danger font-medium px-1">{saveError}</div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" onClick={() => navigate(-1)}>Annuler</Button>
              <Button variant="secondary" loading={mutation.isPending} onClick={() => mutation.mutate(true)}>
                Enregistrer brouillon
              </Button>
              <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate(false)}>
                <SendIcon size={15} /> Envoyer
              </Button>
            </div>
          </div>

          {/* MOBILE error banner */}
          {saveError && (
            <div className="lg:hidden w-full text-[12px] text-danger font-medium p-2 bg-danger-soft border border-danger/20 rounded">
              {saveError}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* LEFT */}
          <div className="flex flex-col gap-3.5">

            {/* Client + dates */}
            <div className="bg-surface border border-border rounded shadow-sm p-4 lg:p-5">
              <div className="text-[13px] font-semibold mb-3.5">Destinataire</div>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px_120px] gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Client</label>
                  <div className="relative">
                    <select
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      className="w-full h-10 pl-11 pr-8 rounded-sm border border-border-strong bg-surface text-[14px] appearance-none focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                    >
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {selectedClient && (
                      <div className="absolute left-2 top-1 pointer-events-none">
                        <Avatar name={selectedClient.name} color={selectedClient.color} size={32} />
                      </div>
                    )}
                    <ChevronDownIcon size={15} className="absolute right-2.5 top-[13px] text-text-muted pointer-events-none" />
                  </div>
                  {selectedClient && (
                    <div className="text-[11.5px] text-text-muted mt-1.5">
                      {selectedClient.email} · {selectedClient.phone}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Date d'émission</label>
                  <input
                    type="date"
                    value={issuedAt}
                    onChange={e => setIssuedAt(e.target.value)}
                    className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface font-mono text-[13px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Validité (j)</label>
                  <input
                    type="number"
                    min={1}
                    value={validDays}
                    onChange={e => setValidDays(Number(e.target.value) || 30)}
                    className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface font-mono text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Objet du devis</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="ex. Aménagement comptoir & enseigne"
                  className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                />
              </div>
            </div>

            {/* Line items */}
            <div className="bg-surface border border-border rounded shadow-sm overflow-hidden">
              <div className="px-3.5 lg:px-5 py-3 lg:py-4 flex items-center border-b border-border">
                <div className="flex-1 text-[13px] font-semibold">Produits & services</div>
                {products.length > 0 && (
                  <ProductPicker
                    products={products}
                    open={showProductMenu}
                    onToggle={() => setShowProductMenu(v => !v)}
                    onPick={addFromProduct}
                    onClose={() => setShowProductMenu(false)}
                  />
                )}
              </div>

              {/* Table header */}
              <div className="hidden lg:grid grid-cols-[1fr_60px_90px_130px_130px_30px] gap-3 px-5 py-2.5 text-[11px] font-semibold text-text-muted uppercase tracking-[0.02em] bg-surface-2">
                <span>Désignation</span>
                <span className="text-right">Qté</span>
                <span>Unité</span>
                <span className="text-right">Prix unit.</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {items.map(it => (
                <div key={it._key} className="border-t border-border">
                  {/* Desktop row */}
                  <div className="hidden lg:grid grid-cols-[1fr_60px_90px_130px_130px_30px] gap-3 px-5 py-2.5 items-center">
                    <input
                      className="h-9 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                      value={it.description}
                      onChange={e => updateItem(it._key, { description: e.target.value })}
                      placeholder="Désignation du produit ou service"
                    />
                    <input
                      className="h-9 px-2 rounded-sm border border-border-strong bg-surface font-mono text-[14px] text-right focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                      type="number" min={0}
                      value={it.quantity}
                      onChange={e => updateItem(it._key, { quantity: Number(e.target.value) || 0 })}
                    />
                    <input
                      className="h-9 px-2 rounded-sm border border-border-strong bg-surface text-[13px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                      list="quote-item-units"
                      placeholder="—"
                      value={it.unit ?? ''}
                      onChange={e => updateItem(it._key, { unit: e.target.value || null })}
                    />
                    <input
                      className="h-9 px-2 rounded-sm border border-border-strong bg-surface font-mono text-[14px] text-right focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                      type="number" min={0}
                      value={it.unitPrice}
                      onChange={e => updateItem(it._key, { unitPrice: Number(e.target.value) || 0 })}
                    />
                    <div className="font-mono text-right text-[13.5px] font-semibold">{fmtXOF(it.quantity * it.unitPrice)}</div>
                    <button type="button" onClick={() => removeItem(it._key)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted">
                      <TrashIcon size={14} />
                    </button>
                  </div>
                  {/* Mobile row */}
                  <div className="lg:hidden px-4 py-3 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <input
                        className="flex-1 h-9 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                        value={it.description}
                        onChange={e => updateItem(it._key, { description: e.target.value })}
                        placeholder="Désignation"
                      />
                      <button type="button" onClick={() => removeItem(it._key)} className="w-9 h-9 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted flex-shrink-0">
                        <TrashIcon size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} placeholder="Qté"
                        className="w-16 h-9 px-2 rounded-sm border border-border-strong bg-surface font-mono text-[14px] text-right focus:outline-none focus:border-primary"
                        value={it.quantity} onChange={e => updateItem(it._key, { quantity: Number(e.target.value) || 0 })} />
                      <input list="quote-item-units" placeholder="unité"
                        className="w-20 h-9 px-2 rounded-sm border border-border-strong bg-surface text-[12.5px] focus:outline-none focus:border-primary"
                        value={it.unit ?? ''} onChange={e => updateItem(it._key, { unit: e.target.value || null })} />
                      <span className="text-text-muted text-[13px]">×</span>
                      <input type="number" min={0} placeholder="Prix"
                        className="flex-1 h-9 px-2 rounded-sm border border-border-strong bg-surface font-mono text-[14px] text-right focus:outline-none focus:border-primary"
                        value={it.unitPrice} onChange={e => updateItem(it._key, { unitPrice: Number(e.target.value) || 0 })} />
                      <div className="font-mono font-semibold text-[13px] w-24 text-right">{fmtXOF(it.quantity * it.unitPrice)}</div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="px-3.5 lg:px-5 py-3 border-t border-border flex items-center gap-2 flex-wrap">
                <button type="button" onClick={addItem} className="flex items-center gap-1.5 h-8 px-3 text-[13px] text-primary-hover font-medium rounded hover:bg-primary-soft transition-colors">
                  <PlusIcon size={14} /> Ajouter une ligne
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAiPanel(p => !p); setAiError(''); }}
                  className="flex items-center gap-1.5 h-8 px-3 text-[13px] text-primary font-medium rounded hover:bg-primary-soft transition-colors border border-primary/20"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>
                  Générer avec IA
                  {aiCredits !== null && (
                    <span className="text-[11px] text-text-muted ml-0.5">({aiCredits} crédit{aiCredits !== 1 ? 's' : ''})</span>
                  )}
                </button>
              </div>

              {/* Panneau IA */}
              {showAiPanel && (
                <div className="mx-5 mb-4 p-4 bg-primary-soft border border-primary/20 rounded">
                  <div className="text-[12.5px] font-semibold text-primary mb-2">
                    Décrivez votre prestation — l'IA génère le devis automatiquement (1 crédit)
                  </div>
                  <textarea
                    rows={3}
                    value={aiDescription}
                    onChange={e => setAiDescription(e.target.value)}
                    placeholder="Ex : Pose de carrelage 20m², matériaux inclus, appartement Cotonou..."
                    className="w-full px-3 py-2 rounded-sm border border-primary/30 bg-white text-[13px] focus:outline-none focus:border-primary resize-none mb-2"
                  />
                  {aiError && <div className="text-[12px] text-red-600 mb-2">{aiError}</div>}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={aiLoading}
                      onClick={handleAiGenerate}
                      disabled={!aiDescription.trim() || (aiCredits !== null && aiCredits < 1)}
                    >
                      Générer le devis
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setShowAiPanel(false)}>
                      Annuler
                    </Button>
                  </div>
                  {aiCredits !== null && aiCredits < 1 && (
                    <div className="mt-2 text-[12px] text-amber-700">
                      Crédits insuffisants —{' '}
                      <button type="button" onClick={() => navigate('/pricing')} className="underline font-medium">
                        acheter des crédits
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-surface border border-border rounded shadow-sm p-4 lg:p-5">
              <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Notes & conditions</label>
              <textarea
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft resize-y min-h-[80px] leading-relaxed"
              />
              <div className="flex gap-2 mt-2.5 flex-wrap">
                <button type="button" onClick={() => setNotes(DEFAULT_NOTES)}
                  className="h-8 px-3 text-[13px] text-text-muted rounded-sm border border-border-strong hover:bg-surface-2 transition-colors">
                  Réinitialiser
                </button>
                <button type="button" onClick={() => setNotes(prev => prev + '\nAcompte de 40 % exigé avant démarrage.')}
                  className="h-8 px-3 text-[13px] text-text-muted rounded-sm border border-border-strong hover:bg-surface-2 transition-colors">
                  + Conditions de paiement
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-3.5">
            {/* Totaux */}
            <div className="bg-surface border border-border rounded shadow-sm p-3.5 lg:p-[18px]">
              <div className="text-[13px] font-semibold mb-3">Récapitulatif</div>
              <div className="flex flex-col gap-2.5">
                <div className="flex text-[13px]">
                  <span className="flex-1 text-text-muted">Sous-total</span>
                  <span className="font-mono">{fmtXOF(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex text-[13px]">
                    <span className="flex-1 text-text-muted">Remise ({discount}%)</span>
                    <span className="font-mono text-warn">− {fmtXOF(discountAmt)}</span>
                  </div>
                )}
                <div className="flex items-center text-[13px]">
                  <span className="flex-1 text-text-muted">Remise</span>
                  <input
                    type="number" min={0} max={100}
                    className="h-7 w-14 px-2 text-right rounded-sm border border-border-strong bg-surface font-mono text-[13px] focus:outline-none focus:border-primary"
                    value={discount}
                    onChange={e => setDiscount(Math.min(100, Number(e.target.value) || 0))}
                  />
                  <span className="ml-1 text-text-muted">%</span>
                </div>
                <div className="flex items-center text-[13px]">
                  <span className="flex-1 text-text-muted">TVA</span>
                  <input
                    type="number" min={0} max={100}
                    className="h-7 w-14 px-2 text-right rounded-sm border border-border-strong bg-surface font-mono text-[13px] focus:outline-none focus:border-primary"
                    value={taxRate}
                    onChange={e => setTaxRate(Math.min(100, Number(e.target.value) || 0))}
                  />
                  <span className="ml-1 text-text-muted">%</span>
                </div>
                <div className="flex text-[12.5px] text-text-muted">
                  <span className="flex-1">Montant TVA</span>
                  <span className="font-mono">{fmtXOF(taxAmount)}</span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex items-baseline">
                  <span className="flex-1 text-[13px] font-semibold">Total TTC</span>
                  <span className="font-mono text-[20px] font-semibold tracking-[-0.01em]">{fmtXOF(total)}</span>
                </div>
                <div className="text-[11px] text-text-subtle text-right">Francs CFA · XOF</div>
              </div>
            </div>

            {/* Options d'envoi */}
            <div className="bg-surface border border-border rounded shadow-sm p-3.5 lg:p-[18px]">
              <div className="text-[13px] font-semibold mb-3">Options d'envoi</div>
              {[
                { state: sendEmail,    set: setSendEmail,    label: 'Envoyer par e-mail',           sub: selectedClient?.email || 'Sélectionnez un client' },
                { state: sendWhatsapp, set: setSendWhatsapp, label: 'Notifier par WhatsApp / SMS',  sub: selectedClient?.phone || 'Sélectionnez un client' },
                ...(canUseMomo
                  ? [{ state: sendMomo, set: setSendMomo, label: 'Activer paiement Mobile Money', sub: momoLabel(user?.phoneCountry ?? 'bj') }]
                  : []),
              ].map(({ state, set, label, sub }) => (
                <label key={label} className="flex items-start gap-2.5 text-[13px] mb-2.5 cursor-pointer">
                  <input type="checkbox" checked={state} onChange={e => set(e.target.checked)} className="mt-0.5 accent-primary" />
                  <span className="flex-1">
                    {label}
                    <div className="text-[11.5px] text-text-muted mt-0.5 truncate">{sub}</div>
                  </span>
                </label>
              ))}
            </div>

            {/* Conformité */}
            <div className="bg-primary-soft border border-primary-soft-2 rounded p-3.5">
              <div className="flex gap-2.5">
                <CheckIcon size={16} className="text-primary-hover mt-0.5 flex-shrink-0" />
                <div className="text-[12.5px] text-primary-hover leading-relaxed">
                  Vos devis sont conformes aux mentions légales requises au Bénin. Numérotation auto, archivage 10 ans.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE sticky bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] flex gap-2 shadow-[0_-6px_16px_rgba(0,0,0,0.06)]">
        <Button
          variant="secondary" size="md"
          loading={mutation.isPending}
          onClick={() => mutation.mutate(true)}
          className="flex-1"
        >
          Brouillon
        </Button>
        <Button
          variant="primary" size="md"
          loading={mutation.isPending}
          onClick={() => mutation.mutate(false)}
          className="flex-[1.4]"
        >
          <SendIcon size={14} /> Envoyer
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Product picker — searchable combobox grouped by category.
// ──────────────────────────────────────────────────────────────
function ProductPicker({
  products,
  open,
  onToggle,
  onPick,
  onClose,
}: {
  products: Product[];
  open: boolean;
  onToggle: () => void;
  onPick: (p: Product) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setSearch('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q) ||
      (p.category ?? '').toLowerCase().includes(q),
    );
  }, [products, search]);

  // Group by category, "Sans catégorie" last.
  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    filtered.forEach(p => {
      const key = p.category ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    const entries = Array.from(map.entries());
    entries.sort(([a], [b]) => {
      if (!a) return 1; if (!b) return -1;
      return a.localeCompare(b, 'fr');
    });
    return entries;
  }, [filtered]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="flex items-center gap-1.5 h-8 px-3 text-[13px] text-text-muted rounded hover:bg-surface-2 transition-colors"
      >
        <ReceiptIcon size={13} /> Depuis catalogue
        <ChevronDownIcon size={12} />
      </button>

      {open && (
        <div
          onClick={e => e.stopPropagation()}
          className="absolute right-0 top-full mt-1.5 bg-surface border border-border rounded-lg shadow-lg z-30 w-[340px] max-h-[380px] flex flex-col overflow-hidden"
        >
          <div className="p-2 border-b border-border">
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                <SearchIcon size={13} />
              </span>
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
                placeholder={`Rechercher dans ${products.length} article${products.length > 1 ? 's' : ''}…`}
                className="w-full h-8 pl-8 pr-2 rounded-sm border border-border-strong bg-surface text-[13px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12.5px] text-text-muted">
                Aucun article ne correspond à <strong className="text-text">"{search}"</strong>.
              </div>
            ) : (
              grouped.map(([cat, ps]) => (
                <div key={cat || 'none'}>
                  <div className="px-3 py-1.5 bg-surface-2 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-text-muted sticky top-0">
                    {cat || 'Sans catégorie'} · {ps.length}
                  </div>
                  {ps.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { onPick(p); onClose(); }}
                      className="flex items-start gap-2.5 w-full px-3 py-2 text-left hover:bg-surface-2 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-[6px] bg-primary-soft grid place-items-center flex-shrink-0 mt-0.5">
                        <ReceiptIcon size={13} className="text-primary-hover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-[13px] font-medium truncate flex-1">{p.name}</span>
                          <span className="font-mono text-[12px] text-text-muted whitespace-nowrap">
                            {fmtXOF(p.price)}{p.unit ? `/${p.unit}` : ''}
                          </span>
                        </div>
                        {p.description && (
                          <div className="text-[11.5px] text-text-muted truncate mt-0.5">{p.description}</div>
                        )}
                        {!!p.usageCount && p.usageCount > 0 && (
                          <div className="text-[10.5px] text-text-subtle mt-0.5">{p.usageCount}× déjà utilisé</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t border-border bg-surface-2 text-[11px] text-text-muted flex items-center justify-between">
            <span>{filtered.length} / {products.length}</span>
            <button
              type="button"
              onClick={onClose}
              className="text-[11.5px] text-text-muted hover:text-text font-semibold"
            >
              Fermer (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
