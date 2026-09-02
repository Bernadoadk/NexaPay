import { useState, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';

const FORBIDDEN_MESSAGE = 'Ce compte n’a pas accès à la console d’administration.';

export default function Login() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('forbidden') ? FORBIDDEN_MESSAGE : '');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez renseigner votre email et mot de passe');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await authApi.login({ email, password });
      if (res.data?.token && res.data?.user) {
        // Les identifiants sont valables sur toute la plateforme : c'est ici
        // qu'on filtre les comptes non administrateurs, sans conserver de session.
        if (res.data.user.role !== 'ADMIN') {
          logout();
          setError(FORBIDDEN_MESSAGE);
          return;
        }
        login(res.data.token, res.data.user);
        navigate('/');
      } else {
        setError('Réponse inattendue du serveur');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Identifiants invalides ou accès non autorisé');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-surface p-8 rounded-2xl border border-border shadow-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary font-bold text-xl mb-3">
            NP
          </div>
          <h1 className="text-2xl font-bold text-text">Administration NexaPay</h1>
          <p className="text-sm text-text-muted mt-1">Connectez-vous à la console de gestion</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5">
              Adresse e-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@nexapay.com"
              required
              className="w-full h-11 px-3.5 rounded-lg border border-border bg-bg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text uppercase tracking-wider mb-1.5">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full h-11 px-3.5 pr-10 rounded-lg border border-border bg-bg text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text text-xs font-medium"
              >
                {showPassword ? 'Masquer' : 'Afficher'}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full h-11 font-semibold mt-2"
            disabled={loading}
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </Button>
        </form>
      </div>
    </div>
  );
}
