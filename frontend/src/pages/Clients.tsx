import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { clientsApi } from '@/lib/api';
import { fmtXOF } from '@/lib/utils';
import { toE164 } from '@/lib/phone';
import type { Client } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import PhoneCountryInput from '@/components/ui/PhoneCountryInput';
import ClientDrawer from '@/components/clients/ClientDrawer';
import ContextMenu from '@/components/ui/ContextMenu';
import { PlusIcon, SearchIcon, DownloadIcon, ChevronDownIcon, ChevronRightIcon, FilterIcon, MoreIcon, XIcon, EditIcon, TrashIcon, FileIcon } from '@/components/ui/Icon';

function NewClientModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Partial<Client>>();
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('bj');

  const mutation = useMutation({
    mutationFn: (data: Partial<Client>) => clientsApi.create({
      ...data,
      phone: phone ? toE164(phone, phoneCountry) : undefined,
      phoneCountry,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); onClose(); },
  });
  return (
    <div className="fixed inset-0 z-40 bg-text/30 flex items-center justify-center p-4">
      <div className="bg-surface rounded shadow-lg w-full max-w-[440px]">
        <div className="flex items-center px-6 py-4 border-b border-border">
          <div className="flex-1 text-[15px] font-semibold">Nouveau client</div>
          <button onClick={onClose}><XIcon size={16} /></button>
        </div>
        <form onSubmit={handleSubmit(data => mutation.mutate(data))} className="p-6 flex flex-col gap-3">
          {[
            { name: 'name' as const, label: "Nom de l'entreprise *", ph: 'Maison Tossou SARL' },
            { name: 'contact' as const, label: 'Contact principal', ph: 'Émile Tossou' },
            { name: 'email' as const, label: 'E-mail', ph: 'emile@example.bj' },
            { name: 'city' as const, label: 'Ville', ph: 'Cotonou' },
          ].map(({ name, label, ph }) => (
            <div key={name}>
              <label className="block text-[12px] font-semibold text-text-muted mb-1.5">{label}</label>
              <input {...register(name, { required: name === 'name' })} placeholder={ph}
                className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft" />
            </div>
          ))}
          <PhoneCountryInput
            label="Téléphone / WhatsApp"
            phone={phone}
            country={phoneCountry}
            onPhoneChange={setPhone}
            onCountryChange={setPhoneCountry}
          />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button type="submit" variant="primary" className="flex-[2]" loading={mutation.isPending || isSubmitting}>Créer le client</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

type SortField = 'name' | 'city' | 'quotesCount' | 'totalBilled' | 'createdAt';
type SortDir = 'asc' | 'desc';

function SortHeader({ label, field, sort, dir, onSort }: {
  label: string; field: SortField; sort: SortField; dir: SortDir; onSort: (f: SortField) => void;
}) {
  const active = sort === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="text-left px-4 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-[0.02em] border-b border-border cursor-pointer hover:text-text select-none"
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (dir === 'asc' ? <ChevronRightIcon size={11} className="-rotate-90" /> : <ChevronRightIcon size={11} className="rotate-90" />) : null}
      </span>
    </th>
  );
}

function exportClientsCSV(clients: Client[]) {
  const rows = [
    ['Nom', 'Contact', 'Email', 'Téléphone', 'Ville', 'Devis', 'Total facturé'],
    ...clients.map(c => [
      c.name, c.contact ?? '', c.email ?? '', c.phone ?? '', c.city ?? '',
      String(c.quotesCount ?? 0), String(c.totalBilled ?? 0),
    ]),
  ];
  const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'clients-nexapay.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function Clients() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Client | null>(null);
  const [showNew, setShowNew] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  function getMenuItems(c: Client) {
    return [
      {
        label: 'Modifier le client',
        icon: <EditIcon size={13} />,
        onClick: () => setSelected(c),
      },
      {
        label: 'Créer un devis',
        icon: <FileIcon size={13} />,
        onClick: () => navigate(`/quotes/new?clientId=${c.id}`),
      },
      {
        label: 'Supprimer',
        icon: <TrashIcon size={13} />,
        danger: true,
        onClick: () => {
          if (confirm(`Supprimer "${c.name}" et tous ses devis ?`)) {
            deleteMutation.mutate(c.id);
          }
        },
      },
    ];
  }

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.list(search || undefined).then(r => r.data),
  });

  // All unique cities for filter
  const cities = useMemo(() =>
    Array.from(new Set(clients.map(c => c.city).filter(Boolean) as string[])).sort(),
    [clients]
  );

  // Close city dropdown on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const displayed = useMemo(() => {
    let list = [...clients];
    if (cityFilter) list = list.filter(c => c.city === cityFilter);
    list.sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortField === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (sortField === 'city') { av = (a.city ?? '').toLowerCase(); bv = (b.city ?? '').toLowerCase(); }
      else if (sortField === 'quotesCount') { av = a.quotesCount ?? 0; bv = b.quotesCount ?? 0; }
      else if (sortField === 'totalBilled') { av = a.totalBilled ?? 0; bv = b.totalBilled ?? 0; }
      else { av = a.createdAt; bv = b.createdAt; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [clients, cityFilter, sortField, sortDir]);

  return (
    <div className="h-full overflow-auto scrollbar-thin p-6 lg:p-7 relative">
      {/* Header */}
      <div className="flex items-center mb-5">
        <div className="flex-1">
          <div className="text-[22px] font-semibold tracking-[-0.02em]">Clients</div>
          <div className="text-[13px] text-text-muted mt-1">
            {displayed.length} client{displayed.length !== 1 ? 's' : ''}{cityFilter ? ` à ${cityFilter}` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportClientsCSV(displayed)}>
            <DownloadIcon size={14} /> Exporter
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
            <PlusIcon size={14} /> Nouveau client
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2.5 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-[380px]">
          <SearchIcon size={15} className="absolute left-3 top-[13px] text-text-muted" />
          <input
            className="w-full h-10 pl-9 pr-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
            placeholder="Rechercher par nom, contact, ville…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* City filter */}
        <div className="relative" ref={cityRef}>
          <Button variant="secondary" size="sm" onClick={() => setCityOpen(v => !v)}>
            <FilterIcon size={14} />
            {cityFilter || 'Toutes les villes'} <ChevronDownIcon size={13} />
          </Button>
          {cityOpen && (
            <div className="absolute top-full mt-1 left-0 z-20 bg-surface border border-border rounded shadow-lg py-1 min-w-[180px]">
              <button
                onClick={() => { setCityFilter(''); setCityOpen(false); }}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2 ${!cityFilter ? 'text-primary font-semibold' : ''}`}
              >
                Toutes les villes
              </button>
              {cities.map(city => (
                <button
                  key={city}
                  onClick={() => { setCityFilter(city); setCityOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-[13px] hover:bg-surface-2 ${cityFilter === city ? 'text-primary font-semibold' : ''}`}
                >
                  {city}
                </button>
              ))}
              {cities.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-text-muted">Aucune ville renseignée</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block bg-surface border border-border rounded overflow-hidden shadow-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-2">
              <th className="w-8 px-4 py-3 border-b border-border"><input type="checkbox" /></th>
              <SortHeader label="Client" field="name" sort={sortField} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Ville" field="city" sort={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="text-left px-4 py-3 text-[12px] font-semibold text-text-muted uppercase tracking-[0.02em] border-b border-border">Contact</th>
              <SortHeader label="Devis" field="quotesCount" sort={sortField} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Total facturé" field="totalBilled" sort={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="border-b border-border w-10" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-10 text-text-muted text-[13px]">Chargement…</td></tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="text-[14px] text-text-muted mb-2">Aucun client encore</div>
                  <Button variant="primary" size="sm" onClick={() => setShowNew(true)}><PlusIcon size={14} /> Ajouter un client</Button>
                </td>
              </tr>
            ) : (
              displayed.map(c => (
                <tr key={c.id} onClick={() => setSelected(c)} className="border-t border-border hover:bg-surface-2 cursor-pointer transition-colors">
                  <td className="px-4 py-3.5"><input type="checkbox" onClick={e => e.stopPropagation()} /></td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} color={c.color} size={34} />
                      <div className="leading-[1.2]">
                        <div className="text-[14px] font-semibold">{c.name}</div>
                        <div className="text-[12px] text-text-muted mt-0.5">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-[13.5px] text-text-muted">{c.city}</td>
                  <td className="px-4 py-3.5">
                    <div className="text-[13.5px]">{c.contact}</div>
                    <div className="font-mono text-[12px] text-text-muted mt-0.5">{c.phone}</div>
                  </td>
                  <td className="px-4 py-3.5 font-mono font-semibold text-right">{c.quotesCount ?? 0}</td>
                  <td className="px-4 py-3.5 font-mono font-semibold text-right">{fmtXOF(c.totalBilled ?? 0)}</td>
                  <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                    <ContextMenu items={getMenuItems(c)}>
                      <button className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted">
                        <MoreIcon size={16} />
                      </button>
                    </ContextMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="lg:hidden flex flex-col divide-y divide-border">
        {isLoading && <div className="py-10 text-center text-[13px] text-text-muted">Chargement…</div>}
        {!isLoading && displayed.length === 0 && (
          <div className="py-10 text-center">
            <div className="text-[14px] text-text-muted mb-3">Aucun client encore</div>
            <Button variant="primary" size="sm" onClick={() => setShowNew(true)}><PlusIcon size={14} /> Ajouter un client</Button>
          </div>
        )}
        {displayed.map(c => (
          <div key={c.id} className="flex items-center gap-3 py-2.5 px-1">
            <button onClick={() => setSelected(c)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <Avatar name={c.name} color={c.color} size={42} />
              <div className="flex-1 min-w-0 leading-[1.2]">
                <div className="text-[13.5px] font-semibold truncate">{c.name}</div>
                <div className="text-[11.5px] text-text-muted mt-0.5">{c.city} · {c.quotesCount ?? 0} devis</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-mono text-[12.5px] font-semibold">{fmtXOF(c.totalBilled ?? 0)}</div>
                <div className="text-[10.5px] text-text-subtle mt-0.5">total facturé</div>
              </div>
            </button>
            <ContextMenu items={getMenuItems(c)}>
              <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2 text-text-muted flex-shrink-0">
                <MoreIcon size={16} />
              </button>
            </ContextMenu>
          </div>
        ))}
      </div>

      {selected && <ClientDrawer client={selected} onClose={() => setSelected(null)} />}
      {showNew && <NewClientModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
