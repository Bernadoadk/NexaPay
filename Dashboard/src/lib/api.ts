import axios from 'axios';

// Dev : proxy Vite (/api → localhost:3001). Prod : VITE_API_URL sur Vercel.
const apiBase = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBase,
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // 401 (token invalide) et compte bloqué : on repart de la page de connexion.
    const isBlocked =
      err.response?.status === 403 && err.response?.data?.code === 'ACCOUNT_BLOCKED';
    if (err.response?.status === 401 || isBlocked) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: { email: string; password: string; name: string; companyName?: string; phone?: string; phoneCountry?: string }) =>
    api.post('/auth/register', data),
  verifyEmail: (data: { email: string; code: string }) => api.post('/auth/verify-email', data),
  resendOtp: (data: { email: string }) => api.post('/auth/resend-otp', data),
  googleAuth: (data: { idToken: string; mode?: 'login' | 'register' }) => api.post('/auth/google', data),
  appleAuth: (data: { identityToken: string; user?: { name?: { firstName?: string; lastName?: string }; email?: string } }) =>
    api.post('/auth/apple', data),
  me: () => api.get('/auth/me'),
  updateMe: (data: object) => api.put('/auth/me', data),
  exportData: () => api.get('/auth/export-data'),
  deleteAccount: () => api.delete('/auth/me', { data: { confirm: 'SUPPRIMER' } }),
};

export const analyticsApi = {
  users: (params?: { page?: number; limit?: number; search?: string; blocked?: boolean }) =>
    api.get('/analytics/users', { params }),
  user: (id: string) => api.get(`/analytics/users/${id}`),
  blockUser: (id: string, blocked: boolean) =>
    api.patch(`/analytics/users/${id}/block`, { blocked }),
  // `months` fixe l'échéance : sans elle, un plan accordé serait révoqué par la
  // vérification d'expiration. `null` = plan sans date de fin.
  updateUserPlan: (id: string, plan: 'FREE' | 'PRO' | 'BUSINESS', months?: number | null) =>
    api.patch(`/analytics/users/${id}/plan`, { plan, months }),
  updateUserCredits: (id: string, amount: number) =>
    api.patch(`/analytics/users/${id}/credits`, { amount }),
  stats: (params?: { days?: number }) => api.get('/analytics/stats', { params }),
  timeseries: (params?: { days?: number }) => api.get('/analytics/timeseries', { params }),
  activity: (params?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => api.get('/analytics/activity', { params }),
  purgeActivity: (days: number) => api.delete('/analytics/activity', { params: { days } }),
};

export default api;