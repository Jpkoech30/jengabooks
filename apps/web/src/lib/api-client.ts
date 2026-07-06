import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send httpOnly cookies automatically
});

// Request interceptor - attach JWT token as fallback (cookie is primary)
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('jengabooks_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// Response interceptor - handle common errors with toast notifications
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response;
      const message = (data as any)?.message || error.message;

      switch (status) {
        case 401:
          // Token expired or invalid - try refresh using stored refresh token
          const storedRefreshToken = localStorage.getItem('jengabooks_refresh_token');
          if (!storedRefreshToken) {
            // Dispatch event so React Router handles the redirect (no full page reload)
            window.dispatchEvent(new CustomEvent('auth:logout'));
            break;
          }
          try {
            const refreshRes = await axios.post('/api/auth/refresh', { refreshToken: storedRefreshToken }, { withCredentials: true });
            if (refreshRes.data?.access_token) {
              localStorage.setItem('jengabooks_token', refreshRes.data.access_token);
              if (refreshRes.data?.refresh_token) {
                localStorage.setItem('jengabooks_refresh_token', refreshRes.data.refresh_token);
              }
              // Retry original request
              if (error.config) {
                error.config.headers.Authorization = `Bearer ${refreshRes.data.access_token}`;
                return apiClient(error.config);
              }
            }
          } catch {
            // Refresh failed, dispatch logout event (no full page reload)
            window.dispatchEvent(new CustomEvent('auth:logout'));
          }
          break;
        case 403:
          if (typeof window !== 'undefined') {
            import('../stores/ui-store').then(({ showToast }) =>
              showToast('error', 'Access Denied', 'You do not have permission for this action'),
            );
          }
          break;
        case 404:
          break; // 404s are usually handled inline
        case 422:
        case 400:
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            import('../stores/ui-store').then(({ showToast }) =>
              showToast('warning', 'Request Failed', typeof message === 'string' ? message : 'Please check your input'),
            );
          }
          break;
        case 500:
        case 502:
        case 503:
          if (typeof window !== 'undefined') {
            import('../stores/ui-store').then(({ showToast }) =>
              showToast('error', 'Server Error', 'Something went wrong. Please try again later.'),
            );
          }
          break;
      }
    }
    return Promise.reject(error);
  },
);

// API helper methods for type-safe usage
export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    apiClient.get<T>(url, { params }).then((res) => res.data),

  post: <T>(url: string, data?: unknown) =>
    apiClient.post<T>(url, data).then((res) => res.data),

  put: <T>(url: string, data?: unknown) =>
    apiClient.put<T>(url, data).then((res) => res.data),

  patch: <T>(url: string, data?: unknown) =>
    apiClient.patch<T>(url, data).then((res) => res.data),

  delete: <T>(url: string) =>
    apiClient.delete<T>(url).then((res) => res.data),
};
