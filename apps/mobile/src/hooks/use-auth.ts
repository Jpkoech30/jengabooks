import { useEffect, useCallback } from 'react';
import { useAuthStore, User } from '../stores/auth-store';
import { api } from '../lib/api-client';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  companyName: string;
}

export function useAuth() {
  const store = useAuthStore();

  const hydrateFromToken = useCallback(async () => {
    const { token, user } = useAuthStore.getState();
    if (!token) {
      store.setLoading(false);
      return;
    }

    try {
      const profile = await api.get<{
        id: string;
        email: string;
        name: string;
        memberships: Array<{ companyId: string; companyName: string; role: string }>;
      }>('/auth/profile');

      const primary = profile.memberships?.[0];
      if (primary) {
        const userData: User = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: primary.role,
          companyId: primary.companyId,
          companyName: primary.companyName,
        };
        store.setUser(userData);
      }
    } catch {
      store.logout();
    } finally {
      store.setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrateFromToken();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      await store.login(credentials.email, credentials.password);
      return useAuthStore.getState().isAuthenticated;
    } catch {
      return false;
    }
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      const response = await api.post<{ access_token: string; user: User }>('/auth/register', {
        email: data.email,
        password: data.password,
        name: data.name,
        companyName: data.companyName,
      });
      store.setUser(response.user);
      return true;
    } catch (error) {
      console.error('Registration failed:', error);
      return false;
    }
  };

  const logout = () => {
    store.logout();
  };

  return {
    user: store.user,
    token: store.token,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
    login,
    register,
    logout,
  };
}
