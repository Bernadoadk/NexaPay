import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { LOGO_URL, LOGO_DARK_URL } from '@/lib/branding';

export default function VerifyOTP() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();

  const email: string = (location.state as any)?.email || '';
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) navigate('/register', { replace: true });
    inputRefs.current[0]?.focus();
  }, [email, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleChange(index: number, value: string) {
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const next = Array(6).fill('');
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  }

  async function handleSubmit() {
    const code = digits.join('');
    if (code.length < 6) { setError('Entrez les 6 chiffres du code'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.verifyEmail({ email, code });
      login(res.data.token, res.data.user);
      navigate('/', { replace: true });
    } catch (e: any) {
      setError(e.response?.data?.message || 'Code invalide ou expiré');
      setDigits(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setResending(true);
    setError('');
    try {
      await authApi.resendOtp({ email });
      setResendCooldown(60);
      setDigits(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erreur lors du renvoi');
    } finally {
      setResending(false);
    }
  }

  const maskedEmail = email.replace(/(.{2}).+(@.+)/, '$1***$2');

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-6">
      <div className="w-full max-w-[420px]">
        <div className="flex justify-center mb-8">
          <img src={isDark ? LOGO_DARK_URL : LOGO_URL} alt="NexaPay" className="h-16 w-auto object-contain" />
        </div>

        <div className="mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-text mb-2">
            Vérifiez votre e-mail
          </h1>
          <p className="text-[14px] text-text-muted leading-relaxed">
            Nous avons envoyé un code à 6 chiffres à<br />
            <span className="font-semibold text-text">{maskedEmail}</span>
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

        {/* 6-digit OTP input */}
        <div className="flex gap-2.5 justify-center mb-8">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}
              className={[
                'w-12 h-14 text-center text-[22px] font-bold rounded-xl border-2 bg-surface',
                'focus:outline-none focus:ring-0 transition-all',
                d
                  ? 'border-primary text-primary'
                  : 'border-border-strong text-text',
                'focus:border-primary',
              ].join(' ')}
            />
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || digits.join('').length < 6}
          className="w-full h-11 bg-primary text-white rounded-xl font-semibold text-[14.5px] hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? (
            <span className="w-4.5 h-4.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <>
              Vérifier mon compte
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>

        <div className="mt-6 text-center">
          <span className="text-[13.5px] text-text-muted">Pas reçu le code ? </span>
          {resendCooldown > 0 ? (
            <span className="text-[13.5px] text-text-subtle">
              Renvoyer dans {resendCooldown}s
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-[13.5px] text-primary font-semibold hover:underline disabled:opacity-60"
            >
              {resending ? 'Envoi...' : 'Renvoyer le code'}
            </button>
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-[13px] text-text-subtle hover:text-text-muted transition-colors"
          >
            ← Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  );
}
