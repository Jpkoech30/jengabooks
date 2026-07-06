import axios, { AxiosError } from 'axios';
import { Alert } from 'react-native';
import { useAuthStore } from '../stores/auth-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT
apiClient.interceptors.request.use(
  (config) => {
    const { token } = useAuthStore.getState();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor for comprehensive error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.message || error.message;

      switch (status) {
        case 401:
          // Token expired or invalid — log out
          useAuthStore.getState().logout();
          break;
        case 403:
          Alert.alert('Access Denied', 'You do not have permission for this action');
          break;
        case 422:
        case 400:
          Alert.alert(
            'Request Failed',
            typeof message === 'string' ? message : 'Please check your input',
          );
          break;
        case 500:
        case 502:
        case 503:
          Alert.alert('Server Error', 'Something went wrong. Please try again later.');
          break;
      }
    } else if (error.request) {
      // Network error — no response received
      Alert.alert('Connection Error', 'Unable to reach the server. Please check your connection.');
    }
    return Promise.reject(error);
  },
);

// Typed API helper
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

export default apiClient;
