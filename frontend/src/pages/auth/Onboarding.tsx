import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { useEntrance } from '@/hooks/useAnime';
import PhoneCountryInput from '@/components/ui/PhoneCountryInput';
import { toE164 } from '@/lib/phone';
import logoSrc from '@/assets/Logo.png';
import logoDarkSrc from '@/assets/Logo-dark.png';
import { Wallet, Info } from 'lucide-react';

/// Post-signup onboarding step. Reached automatically by `App.tsx` whenever an
/// authenticated user has no `phone` yet — typically right after a Google /
/// Apple social sign-in, but also for any email account that skipped the
/// phone field.
///
/// We collect *only* the info that blocks the payment loop:
/// - **Numéro Mobile Money** (required) — where NexaPay pays the user.
/// - **Nom d'entreprise** (optional) — appears in the PDF header.
///
/// Everything else (adresse, IFU, RCCM, logo, mot de passe) stays in
/// Réglages → Profil & entreprise. The screen is NOT skippable; the logout
/// link is the only escape hatch.
export default function Onboarding() {
  const { user, updateUser, logout } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState(user?.phoneCountry || 'bj');
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const rightRef = useEntrance<HTMLDivElement>('fadeInUp', { duration: 500 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!phone.trim()) {
      setError('Le numéro Mobile Money est obligatoire.');
      return;
    }
    setSaving(true);
    try {
      const e164 = toE164(phone, phoneCountry);
      const res = await authApi.updateMe({
        phone: e164,
        phoneCountry,
        ...(companyName.trim() ? { companyName: companyName.trim() } : {}),
      });
      updateUser(res.data);
      // Once `user.phone` is populated, App.tsx stops redirecting to /onboarding.
      navigate('/', { replace: true });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Left branding panel — mirrors Register.tsx visually so the
          onboarding feels like a continuation, not a context switch. */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0F8F65 0%, #0C7A56 50%, #0a6648 100%)' }}
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10" style={{ background: 'rgba(255,255,255,0.4)' }} />
        <div className="absolute bottom-0 -left-16 w-64 h-64 rounded-full opacity-10" style={{ background: 'rgba(255,255,255,0.3)' }} />

        <div className="relative z-10">
          <img src={logoSrc} alt="NexaPay" className="h-20 w-auto object-contain brightness-0 invert" />
        </div>

        <div className="relative z-10 flex-1 flex items-center">
          <div className="w-full">
            <p className="text-white text-[26px] font-bold tracking-[-0.03em] mb-3">
              Encore un détail, et c'est parti.
            </p>
            <p className="text-white/70 text-[14px] mb-10 leading-relaxed">
              Pour vous reverser ce que vos clients paient, NexaPay a besoin
              de votre numéro Mobile Money.
            </p>
            <div className="bg-white/10 border border-white/20 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Wallet size={18} className="text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <div className="text-white font-semibold text-[14px]">Comment ça marche ?</div>
                  <div className="text-white/70 text-[12.5px] mt-1 leading-relaxed">
                    Vos clients paient via votre lien. NexaPay reverse 97 %
                    sur ce numéro automatiquement. Commission : 3 %.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-white/40" />
            <span className="text-white/60 text-[13px]">Configuration · étape 1/1</span>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
        <div ref={rightRef} className="w-full max-w-[460px]">
          <div className="lg:hidden mb-8 flex justify-center">
            <img src={isDark ? logoDarkSrc : logoSrc} alt="NexaPay" className="h-16 w-auto object-contain" />
          </div>

          <div className="mb-8">
            <h1 className="text-[28px] font-bold tracking-[-0.03em] text-text mb-2">
              {firstName ? `Bienvenue ${firstName} 👋` : 'Bienvenue 👋'}
            </h1>
            <p className="text-[14px] text-text-muted leading-relaxed">
              Encore deux infos pour configurer votre compte. C'est là que
              NexaPay vous reversera vos paiements clients.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2.5 px-4 py-3 bg-danger-soft text-danger text-[13px] rounded-lg border border-danger/20">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <PhoneCountryInput
                label={
                  <span className="flex items-center gap-1">
                    Numéro Mobile Money <span className="text-danger">*</span>
                  </span>
                }
                phone={phone}
                country={phoneCountry}
                onPhoneChange={setPhone}
                onCountryChange={setPhoneCountry}
                placeholder="97 00 00 00"
              />
              <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-primary-soft border border-primary/15 rounded-lg text-[11.5px] text-primary-hover leading-snug">
                <Info size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  <strong>C'est sur ce numéro que vous recevrez vos paiements clients</strong>{' '}
                  (MTN MoMo, Moov Money…). Vous pourrez le modifier plus tard
                  dans les Réglages.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-text mb-1.5">
                Nom de votre entreprise{' '}
                <span className="text-text-subtle font-normal">(optionnel)</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Ex : Studio Dolce, Plomberie Gnonlonfoun…"
                className="w-full h-11 px-3.5 rounded-lg border border-border-strong bg-surface text-[14px] placeholder-text-subtle focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/10 transition-all"
              />
              <p className="mt-1.5 text-[11.5px] text-text-subtle">
                Apparaîtra dans l'en-tête de vos devis. Modifiable à tout moment.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="h-11 mt-2 bg-primary text-white rounded-xl font-semibold text-[14.5px] hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
            >
              {saving ? (
                <span className="w-4.5 h-4.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  Terminer la configuration
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[11.5px] text-text-subtle leading-relaxed">
            Les autres infos (adresse, IFU, RCCM, logo) se règlent dans{' '}
            <span className="text-text-muted">Réglages → Profil & entreprise</span>.
          </p>

          <div className="mt-6 pt-5 border-t border-border text-center">
            <button
              type="button"
              onClick={handleLogout}
              className="text-[12.5px] text-text-muted hover:text-text underline-offset-2 hover:underline"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
