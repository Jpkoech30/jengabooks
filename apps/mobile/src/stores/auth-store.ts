import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'jengabooks_auth';

export interface User {
  id: string;
  email: string;
  name: string;
  companyId: string;
  companyName: string;
  role: string;
}

interface StoredAuth {
  token: string;
  refreshToken: string;
  user: User;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        const parsed: StoredAuth = JSON.parse(stored);
        set({
          user: parsed.user,
          token: parsed.token,
          refreshToken: parsed.refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  refreshAuth: async (): Promise<boolean> => {
    const { refreshToken: currentRefreshToken } = get();
    if (!currentRefreshToken) {
      get().logout();
      return false;
    }

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        },
      );

      if (!response.ok) {
        get().logout();
        return false;
      }

      const data = await response.json();

      // Update stored auth
      const stored: StoredAuth = {
        token: data.access_token,
        refreshToken: data.refresh_token || currentRefreshToken,
        user: get().user || data.user,
      };
      await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(stored));

      set({
        token: data.access_token,
        refreshToken: data.refresh_token || currentRefreshToken,
      });

      return true;
    } catch {
      get().logout();
      return false;
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Invalid credentials');
      }

      const data = await response.json();
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        companyId: data.user.companyId,
        companyName: data.user.companyName,
      };

      // Persist token + refresh token to secure storage
      const stored: StoredAuth = {
        token: data.access_token,
        refreshToken: data.refresh_token,
        user,
      };
      await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(stored));

      set({
        user,
        token: data.access_token,
        refreshToken: data.refresh_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Login failed',
      });
    }
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // Ignore secure store errors on logout
    }
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  setUser: (user: User) => {
    set({ user });
  },

  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  clearError: () => {
    set({ error: null });
  },
}));
