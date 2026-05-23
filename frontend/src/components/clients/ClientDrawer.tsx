import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { clientsApi } from '@/lib/api';
import { fmtXOF } from '@/lib/utils';
import { toE164, fromE164 } from '@/lib/phone';
import type { Client } from '@/types';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import PhoneCountryInput from '@/components/ui/PhoneCountryInput';
import { XIcon } from '@/components/ui/Icon';

interface Props {
  client: Client;
  onClose: () => void;
}

function parsePhone(client: Client) {
  const raw = client.phone ?? '';
  const parsed = raw.startsWith('+') ? fromE164(raw) : null;
  return {
    local: parsed?.local ?? raw,
    country: parsed?.country.code ?? client.phoneCountry ?? 'bj',
  };
}

export default function ClientDrawer({ client, onClose }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { register, handleSubmit, reset } = useForm<Partial<Client>>({ defaultValues: client });

  const init = parsePhone(client);
  const [phone, setPhone] = useState(init.local);
  const [phoneCountry, setPhoneCountry] = useState(init.country);

  useEffect(() => {
    reset(client);
    const p = parsePhone(client);
    setPhone(p.local);
    setPhoneCountry(p.country);
  }, [client.id]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Client>) => clientsApi.update(client.id, {
      ...data,
      phone: phone ? toE164(phone, phoneCountry) : '',
      phoneCountry,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); onClose(); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => clientsApi.delete(client.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); onClose(); },
  });

  function handleCreateQuote() {
    onClose();
    navigate(`/quotes/new?clientId=${client.id}`);
  }

  return (
    <div className="fixed inset-0 z-30 bg-text/25 flex justify-end" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[440px] h-full bg-surface border-l border-border shadow-lg flex flex-col"
      >
        {/* Header */}
        <div className="px-[22px] py-[18px] border-b border-border flex items-center gap-3 flex-shrink-0">
          <Avatar name={client.name} color={client.color} size={42} />
          <div className="flex-1 leading-[1.2]">
            <div className="text-[15px] font-semibold">{client.name}</div>
            <div className="text-[12px] text-text-muted mt-0.5">
              {client.quotesCount ?? 0} devis · {fmtXOF(client.totalBilled ?? 0)} facturés
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-2">
            <XIcon size={16} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 px-[22px] py-4 border-b border-border flex-shrink-0">
          <div>
            <div className="text-[11px] text-text-muted uppercase tracking-[0.04em]">Devis émis</div>
            <div className="font-mono font-semibold text-[22px] mt-1">{client.quotesCount ?? 0}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-muted uppercase tracking-[0.04em]">Total facturé</div>
            <div className="font-mono font-semibold text-[22px] mt-1">{fmtXOF(client.totalBilled ?? 0)}</div>
          </div>
        </div>

        {/* Form — scrollable */}
        <form
          id="client-drawer-form"
          onSubmit={handleSubmit(data => updateMutation.mutate(data))}
          className="flex-1 overflow-auto scrollbar-thin p-[22px] flex flex-col gap-3"
        >
          <div>
            <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Nom de l'entreprise</label>
            <input {...register('name')} className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Contact principal</label>
              <input {...register('contact')} className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Ville</label>
              <input {...register('city')} className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-text-muted mb-1.5">E-mail</label>
            <input {...register('email')} type="email" className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft" />
          </div>
          <div>
            <PhoneCountryInput
              label="Téléphone / WhatsApp"
              phone={phone}
              country={phoneCountry}
              onPhoneChange={setPhone}
              onCountryChange={setPhoneCountry}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-text-muted mb-1.5">IFU (numéro fiscal)</label>
            <input {...register('ifu')} placeholder="3201900923418" className="w-full h-10 px-3 rounded-sm border border-border-strong bg-surface font-mono text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Adresse de facturation</label>
            <textarea {...register('address')} rows={2} placeholder="Quartier, rue, repère…" className="w-full px-3 py-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft resize-y min-h-[64px] leading-relaxed" />
          </div>
        </form>

        {/* Footer — 3 actions séparées */}
        <div className="px-[18px] pb-[18px] pt-3 border-t border-border flex gap-2 flex-shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-danger hover:bg-danger-soft"
            loading={deleteMutation.isPending}
            onClick={() => { if (confirm('Supprimer ce client ?')) deleteMutation.mutate(); }}
          >
            Supprimer
          </Button>
          <Button
            form="client-drawer-form"
            type="submit"
            variant="secondary"
            size="sm"
            className="flex-1"
            loading={updateMutation.isPending}
          >
            Enregistrer
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="flex-1"
            onClick={handleCreateQuote}
          >
            + Créer un devis
          </Button>
        </div>
      </div>
    </div>
  );
}
