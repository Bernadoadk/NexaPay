import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { User } from '@/types';
import AppShell from '@/layout/AppShell';
import Login from '@/pages/auth/Login';
import Dashboard from '@/pages/Dashboard';
import Users from '@/pages/Users';
import UserDetail from '@/pages/UserDetail';
import Analytics from '@/pages/Analytics';
import Settings from '@/pages/Settings';

// Le back-office s'appuie sur le champ `role` du modèle User. Le back-end
// refuse déjà toute route /api/analytics à un non-ADMIN ; ce garde-fou évite
// simplement d'afficher une coquille vide pleine de 403.
function isAdmin(user: User | null): boolean {
  return user?.role === 'ADMIN';
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-bg">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin(user)) return <Navigate to="/login?forbidden=1" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAdmin(user) ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <AdminRoute>
            <AppShell />
          </AdminRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="users/:id" element={<UserDetail />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}