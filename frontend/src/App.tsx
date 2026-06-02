import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/layout/AppShell';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import VerifyOTP from '@/pages/auth/VerifyOTP';
import Onboarding from '@/pages/auth/Onboarding';
import Dashboard from '@/pages/Dashboard';
import Quotes from '@/pages/Quotes';
import QuoteCreate from '@/pages/QuoteCreate';
import QuoteDetail from '@/pages/QuoteDetail';
import Clients from '@/pages/Clients';
import Products from '@/pages/Products';
import Templates from '@/pages/Templates';
import Settings from '@/pages/Settings';
import Pricing from '@/pages/Pricing';
import Payouts from '@/pages/Payouts';
import PaymentPage from '@/pages/PaymentPage';
import PaymentSuccess from '@/pages/PaymentSuccess';

// Phone (the MoMo receiving number) is the single non-skippable field. If
// it's missing — typically right after a Google/Apple sign-in — we force
// the user through /onboarding before they can use the app.
function needsOnboarding(user: { phone?: string } | null) {
  return !!user && !user.phone?.trim();
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-bg">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (needsOnboarding(user)) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
      <Route path="/verify-email" element={user ? <Navigate to="/" replace /> : <VerifyOTP />} />
      <Route
        path="/onboarding"
        element={
          !user
            ? <Navigate to="/login" replace />
            : needsOnboarding(user)
              ? <Onboarding />
              : <Navigate to="/" replace />
        }
      />
      <Route path="/pay/success" element={<PaymentSuccess />} />
      <Route path="/pay/:quoteId" element={<PaymentPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="quotes" element={<Quotes />} />
        <Route path="quotes/new" element={<QuoteCreate />} />
        <Route path="quotes/:id" element={<QuoteDetail />} />
        <Route path="quotes/:id/edit" element={<QuoteCreate />} />
        <Route path="clients" element={<Clients />} />
        <Route path="products" element={<Products />} />
        <Route path="templates" element={<Templates />} />
        <Route path="settings" element={<Settings />} />
        <Route path="payouts" element={<Payouts />} />
        <Route path="pricing" element={<Pricing />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
