import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';

/**
 * Hook that provides authentication state and actions.
 * Validates the stored token on mount and hydrates the store.
 */
export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    if (!store.isAuthenticated) {
      store.hydrateFromToken();
    }
  }, []);

  return {
    user: store.user,
    token: store.token,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    login: store.login,
    logout: store.logout,
    switchCompany: store.switchCompany,
    clearError: store.clearError,
  };
}
