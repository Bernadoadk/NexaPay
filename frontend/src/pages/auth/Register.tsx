import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { useEntrance } from '@/hooks/useAnime';
import { useTheme } from '@/contexts/ThemeContext';
import PhoneCountryInput from '@/components/ui/PhoneCountryInput';
import { toE164 } from '@/lib/phone';
import logoSrc from '@/assets/Logo.png';
import logoDarkSrc from '@/assets/Logo-dark.png';
import { FileText, Users, Smartphone } from 'lucide-react';

interface FormData {
  name: string;
  companyName: string;
  email: string;
  password: string;
}

// Apple's SDK is loaded globally by the host page (same as Login). Declared
// inline here too so TS doesn't complain when we touch `window.AppleID`.
declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: object) => void;
        signIn: () => Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string }; email?: string } }>;
      };
    };
  }
}

const steps = [
  { Icon: FileText,   title: 'Devis professionnels', desc: 'Créez et envoyez des devis en quelques secondes' },
  { Icon: Users,      title: 'Gestion clients',      desc: 'Centralisez tous vos contacts et leur historique' },
  { Icon: Smartphone, title: 'Mobile & WhatsApp',    desc: 'Partagez vos devis directement via WhatsApp' },
];

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('bj');
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<FormData>();

  // Social signups never include a phone number — `App.tsx` routes the user
  // to `/onboarding` automatically when `user.phone` is missing.
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setSocialLoading('google');
      setError('');
      try {
        const res = await authApi.googleAuth({ idToken: tokenResponse.access_token });
        login(res.data.token, res.data.user);
        navigate('/');
      } catch (e: any) {
        setError(e.response?.data?.message || 'Erreur Google');
      } finally {
        setSocialLoading(null);
      }
    },
    onError: () => {
      setError('Inscription Google annulée');
      setSocialLoading(null);
    },
  });

  async function handleAppleSignup() {
    if (!window.AppleID) {
      setError('Apple Sign-In non disponible');
      return;
    }
    setSocialLoading('apple');
    setError('');
    try {
      window.AppleID.auth.init({
        clientId: import.meta.env.VITE_APPLE_CLIENT_ID,
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true,
      });
      const response = await window.AppleID.auth.signIn();
      const res = await authApi.appleAuth({
        identityToken: response.authorization.id_token,
        user: response.user,
      });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (e: any) {
      if (e?.error !== 'popup_closed_by_user') {
        setError(e?.response?.data?.message || 'Erreur Apple');
      }
    } finally {
      setSocialLoading(null);
    }
  }

  const { isDark } = useTheme();
  const leftRef = useEntrance<HTMLDivElement>('fadeIn', { duration: 600 });
  const rightRef = useEntrance<HTMLDivElement>('fadeInUp', { delay: 120, duration: 500 });

  async function onSubmit(data: FormData) {
    setError('');
    if (!phone.trim()) {
      setError('Le numéro Mobile Money est obligatoire — c\'est sur ce numéro que vous recevrez vos paiements.');
      return;
    }
    try {
      const e164 = toE164(phone, phoneCountry);
      const res = await authApi.register({ ...data, phone: e164, phoneCountry });
      if (res.data.requiresVerification) {
        navigate('/verify-email', { state: { email: res.data.email } });
        return;
      }
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (e: any) {
      if (!e.response) {
        setError('Impossible de joindre l\'API. Vérifiez que le backend Vercel est déployé et que VITE_API_URL est correct.');
        return;
      }
      setError(e.response?.data?.message || 'Erreur lors de la création du compte');
    }
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Panneau gauche — branding */}
      <div
        ref={leftRef}
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
            <p className="text-white text-[24px] font-bold tracking-[-0.03em] mb-2">
              Commencez gratuitement
            </p>
            <p className="text-white/70 text-[14px] mb-10">
              Tout ce dont vous avez besoin pour gérer votre activité au Bénin.
            </p>
            <div className="flex flex-col gap-5">
              {steps.map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-white shrink-0">
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-[14px]">{title}</div>
                    <div className="text-white/60 text-[12.5px] mt-0.5">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-white/40" />
            <span className="text-white/60 text-[13px]">Gratuit · Sans carte bancaire</span>
          </div>
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
        <div ref={rightRef} className="w-full max-w-[420px]">
          {/* Logo mobile uniquement */}
          <div className="lg:hidden mb-8 flex justify-center">
            <img src={isDark ? logoDarkSrc : logoSrc} alt="NexaPay" className="h-16 w-auto object-contain" />
          </div>

          <div className="mb-8">
            <h1 className="text-[28px] font-bold tracking-[-0.03em] text-text mb-2">
              Créer un compte
            </h1>
            <p className="text-[14px] text-text-muted">
              Rejoignez des centaines d'entrepreneurs béninois.
            </p>
          </div>

          {/* Social signup buttons — same component as Login. After a
              successful social sign-in we land in App.tsx; if the user has no
              phone yet, App.tsx routes them to /onboarding. */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              type="button"
              onClick={() => { setSocialLoading('google'); googleLogin(); }}
              disabled={socialLoading !== null || isSubmitting}
              className="h-11 flex items-center justify-center gap-3 rounded-xl border border-border-strong bg-surface hover:bg-bg-subtle active:scale-[0.98] transition-all text-[14px] font-medium text-text disabled:opacity-60"
            >
              {socialLoading === 'google' ? (
                <span className="w-4 h-4 rounded-full border-2 border-text-muted border-t-transparent animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Continuer avec Google
            </button>

            <button
              type="button"
              onClick={handleAppleSignup}
              disabled={socialLoading !== null || isSubmitting}
              className="h-11 flex items-center justify-center gap-3 rounded-xl border border-border-strong bg-surface hover:bg-bg-subtle active:scale-[0.98] transition-all text-[14px] font-medium text-text disabled:opacity-60"
            >
              {socialLoading === 'apple' ? (
                <span className="w-4 h-4 rounded-full border-2 border-text-muted border-t-transparent animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
              )}
              Continuer avec Apple
            </button>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[12px] text-text-subtle font-medium">ou avec votre e-mail</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2.5 px-4 py-3 bg-danger-soft text-danger text-[13px] rounded-lg border border-danger/20">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[12.5px] font-semibold text-text mb-1.5">
                  Votre nom <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  {...register('name', { required: true })}
                  placeholder="Kévin Aguidi"
                  className="w-full h-11 px-3.5 rounded-lg border border-border-strong bg-surface text-[14px] placeholder-text-subtle focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/10 transition-all"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[12.5px] font-semibold text-text mb-1.5">
                  Entreprise <span className="text-text-subtle font-normal">(optionnel)</span>
                </label>
                <input
                  type="text"
                  {...register('companyName')}
                  placeholder="Studio Aguidi"
                  className="w-full h-11 px-3.5 rounded-lg border border-border-strong bg-surface text-[14px] placeholder-text-subtle focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/10 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-text mb-1.5">
                Adresse e-mail <span className="text-danger">*</span>
              </label>
              <input
                type="email"
                {...register('email', { required: true })}
                placeholder="vous@exemple.com"
                className="w-full h-11 px-3.5 rounded-lg border border-border-strong bg-surface text-[14px] placeholder-text-subtle focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/10 transition-all"
              />
            </div>

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
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 mt-0.5" aria-hidden>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
                <span>
                  <strong>C'est sur ce numéro que vous recevrez vos paiements clients</strong> (MTN MoMo, Moov Money…).
                  Donnez bien votre numéro de réception personnel — vous pourrez le modifier dans les Réglages.
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[12.5px] font-semibold text-text mb-1.5">
                Mot de passe <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: true, minLength: 6 })}
                  placeholder="Minimum 6 caractères"
                  className="w-full h-11 px-3.5 pr-10 rounded-lg border border-border-strong bg-surface text-[14px] placeholder-text-subtle focus:outline-none focus:border-primary focus:ring-3 focus:ring-primary/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || socialLoading !== null}
              className="h-11 bg-primary text-white rounded-xl font-semibold text-[14.5px] hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1 shadow-sm"
            >
              {isSubmitting ? (
                <span className="w-4.5 h-4.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  Créer mon compte gratuit
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-[13.5px] text-text-muted">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Se connecter
            </Link>
          </div>

          <p className="mt-6 text-center text-[11px] text-text-subtle leading-relaxed">
            En créant un compte, vous acceptez nos conditions d'utilisation.
          </p>
        </div>
      </div>
    </div>
  );
}
