import axios from 'axios';

// Dev : proxy Vite (/api → localhost:3001). Prod : VITE_API_URL sur Vercel.
const apiBase =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ||
  '/api';

const api = axios.create({ baseURL: apiBase });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
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
  googleAuth: (data: { idToken: string }) => api.post('/auth/google', data),
  appleAuth: (data: { identityToken: string; user?: { name?: { firstName?: string; lastName?: string }; email?: string } }) =>
    api.post('/auth/apple', data),
  me: () => api.get('/auth/me'),
  updateMe: (data: object) => api.put('/auth/me', data),
};

export const clientsApi = {
  list: (search?: string) => api.get('/clients', { params: search ? { search } : undefined }),
  get: (id: string) => api.get(`/clients/${id}`),
  create: (data: object) => api.post('/clients', data),
  update: (id: string, data: object) => api.put(`/clients/${id}`, data),
  delete: (id: string) => api.delete(`/clients/${id}`),
};

export const quotesApi = {
  list: (params?: { status?: string; clientId?: string }) => api.get('/quotes', { params }),
  get: (id: string) => api.get(`/quotes/${id}`),
  create: (data: object) => api.post('/quotes', data),
  update: (id: string, data: object) => api.put(`/quotes/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/quotes/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/quotes/${id}`),
  duplicate: (id: string) => api.post(`/quotes/${id}/duplicate`),
  checkPayment: (id: string) => api.post(`/quotes/${id}/check-payment`),
};

export const productsApi = {
  list: (params?: { search?: string; sort?: string; archived?: '0' | '1' | 'all' }) =>
    api.get('/products', { params }),
  create: (data: object) => api.post('/products', data),
  update: (id: string, data: object) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  archive: (id: string, archived: boolean) =>
    api.patch(`/products/${id}/archive`, { archived }),
  duplicate: (id: string) => api.post(`/products/${id}/duplicate`),
  categories: () => api.get<string[]>('/products/categories'),
};

export const dashboardApi = {
  stats: (params?: { from?: string; to?: string }) =>
    api.get('/dashboard/stats', { params }),
};

export const uploadApi = {
  uploadAvatar: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/upload/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteAvatar: () => api.delete('/upload/avatar'),
  uploadQuoteLogo: (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    return api.post('/upload/quote-logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteQuoteLogo: () => api.delete('/upload/quote-logo'),
};

export const paymentsApi = {
  quote: (quoteId: string) => api.get(`/payments/quote/${quoteId}`),
  initiate: (quoteId: string) => api.post(`/payments/initiate/${quoteId}`),
  upgrade: (plan: 'PRO' | 'BUSINESS', interval: 'monthly' | 'annual' = 'monthly') =>
    api.post('/payments/upgrade', { plan, interval }),
  confirmUpgrade: (transactionId: string, plan: string, interval: string) =>
    api.post('/payments/confirm-upgrade', { transactionId, plan, interval }),
  confirmQuote: (quoteId: string) =>
    api.post(`/payments/confirm-quote/${quoteId}`),
  quota: () => api.get('/payments/quota'),
  history: () => api.get('/payments/history'),
  retryPayout: (paymentId: string) => api.post(`/payments/${paymentId}/retry`),
};

export const creditsApi = {
  balance: () => api.get('/credits/balance'),
  history: () => api.get('/credits/history'),
  purchase: (packId: string) => api.post('/credits/purchase', { packId }),
  confirmPurchase: (transactionId: string, packId: string) =>
    api.post('/credits/confirm-purchase', { transactionId, packId }),
};

export const aiApi = {
  generateQuote: (description: string) => api.post('/ai/generate-quote', { description }),
  suggestPrice: (data: { service: string; city?: string; details?: string }) =>
    api.post('/ai/suggest-price', data),
  improveText: (data: { text: string; context?: string }) =>
    api.post('/ai/improve-text', data),
};

export default api;
