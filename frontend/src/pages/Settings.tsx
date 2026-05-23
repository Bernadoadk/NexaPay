import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi, paymentsApi, creditsApi, uploadApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, type ThemePreference } from '@/contexts/ThemeContext';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import PhoneCountryInput from '@/components/ui/PhoneCountryInput';
import { toE164, fromE164 } from '@/lib/phone';
import { SunIcon, MoonIcon, MonitorIcon } from '@/components/ui/Icon';
import { AlertTriangle, Info, Check } from 'lucide-react';
import type { User } from '@/types';

const PLAN_LABELS: Record<string, string> = { FREE: 'Gratuit', PRO: 'Pro', BUSINESS: 'Business' };
const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-surface-2 text-text-muted border-border',
  PRO: 'bg-primary-soft text-primary border-primary',
  BUSINESS: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]',
};

interface ProfileForm {
  name: string;
  companyName?: string;
  address?: string;
  ifu?: string;
  rccm?: string;
}

function ImageUploadBox({
  label,
  hint,
  currentUrl,
  onUpload,
  onDelete,
  loading,
}: {
  label: string;
  hint: string;
  currentUrl?: string;
  onUpload: (file: File) => void;
  onDelete: () => void;
  loading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative w-[72px] h-[72px] rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:border-primary transition-colors bg-surface-2"
        onClick={() => inputRef.current?.click()}
      >
        {currentUrl ? (
          <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
        {loading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => {
        const f = e.target.files?.[0];
        if (f) { onUpload(f); e.target.value = ''; }
      }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold mb-0.5">{label}</div>
        <div className="text-[12px] text-text-muted mb-2">{hint}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="text-[12px] font-medium text-primary hover:underline disabled:opacity-50"
          >
            {currentUrl ? 'Changer' : 'Importer'}
          </button>
          {currentUrl && (
            <button
              type="button"
              onClick={onDelete}
              disabled={loading}
              className="text-[12px] font-medium text-[#B43A3A] hover:underline disabled:opacity-50"
            >
              Supprimer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user, login, updateUser } = useAuth();
  const { preference, setPreference } = useTheme();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [avatarLoading, setAvatarLoading] = useState(false);
  const [quoteLogoLoading, setQuoteLogoLoading] = useState(false);
  const [useProfilePhoto, setUseProfilePhoto] = useState(user?.useProfilePhotoAsLogo ?? true);
  function parseUserPhone(u: typeof user) {
    const raw = u?.phone ?? '';
    const parsed = raw.startsWith('+') ? fromE164(raw) : null;
    return {
      country: parsed?.country.code ?? u?.phoneCountry ?? 'bj',
      local: parsed?.local ?? raw,
    };
  }

  const initial = parseUserPhone(user);
  const [phone, setPhone] = useState(initial.local);
  const [phoneCountry, setPhoneCountry] = useState(initial.country);
  const [savedPhone, setSavedPhone] = useState(initial.local);
  const [savedPhoneCountry, setSavedPhoneCountry] = useState(initial.country);

  useEffect(() => {
    if (user) {
      setUseProfilePhoto(user.useProfilePhotoAsLogo ?? true);
      const p = parseUserPhone(user);
      setPhone(p.local);
      setPhoneCountry(p.country);
      setSavedPhone(p.local);
      setSavedPhoneCountry(p.country);
    }
  }, [user?.id]);

  const isPhoneDirty = phone !== savedPhone || phoneCountry !== savedPhoneCountry;

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

  const { register, handleSubmit, reset, formState: { isDirty, isSubmitting } } = useForm<ProfileForm>({
    defaultValues: {
      name: user?.name ?? '',
      companyName: user?.companyName ?? '',
      address: user?.address ?? '',
      ifu: user?.ifu ?? '',
      rccm: user?.rccm ?? '',
    },
  });

  useEffect(() => {
    if (user) reset({
      name: user.name,
      companyName: user.companyName ?? '',
      address: user.address ?? '',
      ifu: user.ifu ?? '',
      rccm: user.rccm ?? '',
    });
  }, [user?.id]);

  const mutation = useMutation({
    mutationFn: (data: ProfileForm) => authApi.updateMe({
      ...data,
      phone: phone ? toE164(phone, phoneCountry) : '',
      phoneCountry,
    }),
    onSuccess: (res) => {
      const token = localStorage.getItem('token') ?? '';
      login(token, res.data as User);
      setSavedPhone(phone);
      setSavedPhoneCountry(phoneCountry);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  async function handleToggleProfilePhoto(checked: boolean) {
    setUseProfilePhoto(checked);
    const res = await authApi.updateMe({ useProfilePhotoAsLogo: checked });
    updateUser(res.data as User);
  }

  async function handleAvatarUpload(file: File) {
    setAvatarLoading(true);
    try {
      const res = await uploadApi.uploadAvatar(file);
      updateUser(res.data as User);
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleAvatarDelete() {
    setAvatarLoading(true);
    try {
      const res = await uploadApi.deleteAvatar();
      updateUser(res.data as User);
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handleQuoteLogoUpload(file: File) {
    setQuoteLogoLoading(true);
    try {
      const res = await uploadApi.uploadQuoteLogo(file);
      updateUser(res.data as User);
    } finally {
      setQuoteLogoLoading(false);
    }
  }

  async function handleQuoteLogoDelete() {
    setQuoteLogoLoading(true);
    try {
      const res = await uploadApi.deleteQuoteLogo();
      updateUser(res.data as User);
    } finally {
      setQuoteLogoLoading(false);
    }
  }

  const inputCls = "w-full h-10 px-3 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft";

  return (
    <div className="h-full overflow-auto scrollbar-thin p-6 lg:p-7">
      <div className="max-w-[620px] mx-auto">
        {/* Header */}
        <div className="mb-7">
          <div className="text-[22px] font-semibold tracking-[-0.02em]">Réglages du compte</div>
          <div className="text-[13px] text-text-muted mt-1">Informations affichées sur vos devis et factures</div>
        </div>

        {/* Avatar preview */}
        {user && (
          <div className="flex items-center gap-4 p-4 bg-surface border border-border rounded mb-4">
            <Avatar name={user.name} photoUrl={user.logoUrl} size={52} />
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold">{user.companyName || user.name}</div>
              <div className="text-[13px] text-text-muted mt-0.5">{user.email}</div>
            </div>
          </div>
        )}

        {/* Plan card */}
        {user && (
          <div className="p-4 bg-surface border border-border rounded mb-6">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[12px] text-text-muted mb-1">Plan actuel</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-full border ${PLAN_COLORS[user.plan || 'FREE']}`}>
                    {PLAN_LABELS[user.plan || 'FREE']}
                  </span>
                  {quotaData && (
                    <span className="text-[12px] text-text-muted">
                      {quotaData.quotesThisMonth} / {quotaData.limit} devis ce mois
                    </span>
                  )}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => navigate('/pricing')}>
                {(user.plan || 'FREE') !== 'BUSINESS' ? 'Changer de plan' : 'Voir les plans'}
              </Button>
            </div>
            {creditData !== undefined && (
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12.5px]">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                  </svg>
                  <span className="text-text-muted">Crédits IA disponibles :</span>
                  <strong className="text-text">{creditData?.aiCredits ?? 0}</strong>
                </div>
                <button
                  onClick={() => navigate('/pricing')}
                  className="text-[12px] text-primary hover:underline font-medium"
                >
                  Acheter des crédits
                </button>
              </div>
            )}
          </div>
        )}

        {/* Apparence */}
        <section className="bg-surface border border-border rounded p-5 mb-5">
          <div className="text-[13px] font-semibold text-text-muted uppercase tracking-[0.04em] mb-4">Apparence</div>
          <div className="grid grid-cols-3 gap-2.5">
            {([
              { value: 'light' as ThemePreference, label: 'Clair', Icon: SunIcon },
              { value: 'dark' as ThemePreference, label: 'Sombre', Icon: MoonIcon },
              { value: 'system' as ThemePreference, label: 'Système', Icon: MonitorIcon },
            ]).map(({ value, label, Icon }) => {
              const active = preference === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPreference(value)}
                  className={`relative flex flex-col items-center gap-2.5 py-4 px-3 rounded-sm border transition-all
                    ${active
                      ? 'bg-primary-soft border-primary text-primary-hover'
                      : 'bg-surface-2 border-border text-text-muted hover:border-border-strong hover:text-text hover:bg-surface'
                    }`}
                >
                  <Icon size={20} strokeWidth={active ? 2 : 1.6} />
                  <span className="text-[13px] font-semibold">{label}</span>
                  {active && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Photo de profil + Logo devis */}
        <section className="bg-surface border border-border rounded p-5 mb-5 flex flex-col gap-5">
          <div className="text-[13px] font-semibold text-text-muted uppercase tracking-[0.04em]">Photo & Logo</div>

          <ImageUploadBox
            label="Photo de profil"
            hint="Affichée dans l'interface. JPG, PNG — max 5 Mo"
            currentUrl={user?.logoUrl}
            onUpload={handleAvatarUpload}
            onDelete={handleAvatarDelete}
            loading={avatarLoading}
          />

          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[13px] font-semibold">Utiliser ma photo de profil comme logo de devis</div>
                <div className="text-[12px] text-text-muted mt-0.5">Votre photo apparaîtra dans l'en-tête de chaque devis PDF</div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleProfilePhoto(!useProfilePhoto)}
                className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${useProfilePhoto ? 'bg-primary' : 'bg-border-strong'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${useProfilePhoto ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {!useProfilePhoto && (
              <ImageUploadBox
                label="Logo personnalisé pour les devis"
                hint="Remplace la photo de profil sur vos PDFs. JPG, PNG — max 5 Mo"
                currentUrl={user?.quoteLogoUrl}
                onUpload={handleQuoteLogoUpload}
                onDelete={handleQuoteLogoDelete}
                loading={quoteLogoLoading}
              />
            )}

            {useProfilePhoto && !user?.logoUrl && (
              <div className="text-[12px] text-text-muted bg-surface-2 rounded px-3 py-2 border border-border">
                Aucune photo de profil importée — les initiales de votre nom seront utilisées.
              </div>
            )}
          </div>
        </section>

        <form onSubmit={handleSubmit(data => mutation.mutate(data))} className="flex flex-col gap-5">
          {/* Identity */}
          <section className="bg-surface border border-border rounded p-5 flex flex-col gap-3.5">
            <div className="text-[13px] font-semibold text-text-muted uppercase tracking-[0.04em]">Identité</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Nom complet *</label>
                <input {...register('name', { required: true })} className={inputCls} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Nom de l'entreprise</label>
                <input {...register('companyName')} placeholder="Aguidi Studio" className={inputCls} />
              </div>
            </div>
            <div>
              <PhoneCountryInput
                label={
                  <span className="flex items-center gap-1">
                    Numéro Mobile Money <span className="text-danger">*</span>
                    <span className="text-text-subtle font-normal ml-1">(également utilisé pour WhatsApp)</span>
                  </span>
                }
                phone={phone}
                country={phoneCountry}
                onPhoneChange={setPhone}
                onCountryChange={setPhoneCountry}
                placeholder="97 00 00 00"
              />
              {!phone && (
                <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-warn-soft border border-warn/30 rounded text-[11.5px] text-warn leading-snug">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-px" strokeWidth={2} />
                  <span>Sans numéro MoMo, les paiements reçus de vos clients <strong>ne peuvent pas vous être reversés</strong>.</span>
                </div>
              )}
            </div>
          </section>

          {/* Address */}
          <section className="bg-surface border border-border rounded p-5 flex flex-col gap-3.5">
            <div className="text-[13px] font-semibold text-text-muted uppercase tracking-[0.04em]">Adresse</div>
            <div>
              <label className="block text-[12px] font-semibold text-text-muted mb-1.5">Adresse postale</label>
              <textarea {...register('address')} rows={2}
                placeholder="Quartier, rue, ville — ex: Abomey-Calavi, Zone industrielle, face CEG"
                className="w-full px-3 py-2.5 rounded-sm border border-border-strong bg-surface text-[14px] focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft resize-y min-h-[64px] leading-relaxed" />
            </div>
          </section>

          {/* Legal */}
          <section className="bg-surface border border-border rounded p-5 flex flex-col gap-3.5">
            <div className="text-[13px] font-semibold text-text-muted uppercase tracking-[0.04em]">Informations légales</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-text-muted mb-1.5">IFU (n° fiscal)</label>
                <input {...register('ifu')} placeholder="3201900923418" className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-text-muted mb-1.5">RCCM</label>
                <input {...register('rccm')} placeholder="BJ-COT-2020-B-1234" className={`${inputCls} font-mono`} />
              </div>
            </div>
          </section>

          {/* Reversement Mobile Money */}
          <section className="bg-surface border border-border rounded p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-[13px] font-semibold text-text-muted uppercase tracking-[0.04em]">Reversement Mobile Money</div>
              <button
                type="button"
                onClick={() => navigate('/payouts')}
                className="text-[12.5px] font-semibold text-primary hover:underline"
              >
                Voir mes reversements →
              </button>
            </div>
            <div className="text-[12.5px] text-text-muted leading-relaxed">
              Lorsqu'un client paie un devis (MoMo ou carte bancaire), NexaPay vous reverse automatiquement{' '}
              <span className="font-semibold text-text">97 % du montant</span> sur le numéro ci-dessus (commission 3 %).
              Le reversement est déclenché immédiatement après confirmation du paiement.
            </div>
            <div className="flex items-start gap-2 bg-primary-soft border border-primary/20 rounded px-3 py-2.5 text-[12px] text-primary">
              <Info size={14} className="flex-shrink-0 mt-0.5" strokeWidth={2} />
              <span>Votre numéro de téléphone et le pays sélectionnés sont utilisés pour tous vos reversements MoMo.</span>
            </div>
          </section>

          {/* Save */}
          <div className="flex justify-end gap-2">
            {(isDirty || isPhoneDirty) && (
              <Button type="button" variant="secondary" onClick={() => { reset(); setPhone(savedPhone); setPhoneCountry(savedPhoneCountry); }}>
                Annuler
              </Button>
            )}
            <Button type="submit" variant="primary" loading={mutation.isPending || isSubmitting} disabled={!isDirty && !isPhoneDirty}>
              Enregistrer les modifications
            </Button>
          </div>

          {mutation.isSuccess && (
            <div className="flex items-center justify-center gap-1.5 text-[13px] text-primary font-medium">
              <Check size={15} strokeWidth={2.5} /> Profil mis à jour avec succès
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
