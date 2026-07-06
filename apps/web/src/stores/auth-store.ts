import { create } from 'zustand';

export interface Membership {
  companyId: string;
  companyName: string;
  role: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  companyName: string;
  memberships: Membership[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  switchCompany: (companyId: string) => Promise<boolean>;
  hydrateFromToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  hydrateFromToken: async () => {
    // Try to get profile using httpOnly cookie (auto-sent with request)
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/profile', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Token invalid');
      const profile = await response.json();
      const activeCompanyId = localStorage.getItem('jengabooks_company_id') || profile.memberships?.[0]?.companyId;
      const activeMembership = profile.memberships?.find((m: any) => m.companyId === activeCompanyId) || profile.memberships?.[0];

      // Clear any stale localStorage tokens to prevent Authorization header
      // from overriding the valid httpOnly cookie (which causes 401 loops)
      localStorage.removeItem('jengabooks_token');
      localStorage.removeItem('jengabooks_refresh_token');

      set({
        user: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          companyId: activeMembership?.companyId || activeCompanyId,
          companyName: activeMembership?.companyName || '',
          role: activeMembership?.role || '',
          memberships: profile.memberships || [],
        },
        isAuthenticated: true,
        isLoading: false,
        token: null, // No Bearer token - rely on the httpOnly cookie
      });
    } catch {
      localStorage.removeItem('jengabooks_company_id');
      localStorage.removeItem('jengabooks_token');
      localStorage.removeItem('jengabooks_refresh_token');
      set({ isAuthenticated: false, isLoading: false, token: null, user: null });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    // Clear any stale tokens before logging in to prevent 401 loops
    localStorage.removeItem('jengabooks_token');
    localStorage.removeItem('jengabooks_refresh_token');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Accept httpOnly cookie from response
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Invalid credentials');
      }

      const data = await response.json();

      // Fetch full profile to get memberships
      const profileRes = await fetch('/api/auth/profile', {
        headers: { Authorization: `Bearer ${data.access_token}` },
        credentials: 'include',
      });
      const profile = profileRes.ok ? await profileRes.json() : { memberships: [] };

      const user: User = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        companyId: data.user.companyId,
        companyName: data.user.companyName,
        memberships: profile.memberships || [{ companyId: data.user.companyId, companyName: data.user.companyName, role: data.user.role }],
      };

      set({
        user,
        token: data.access_token,
        refreshToken: data.refresh_token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Store token and refresh token in localStorage as fallback (primary auth is httpOnly cookie)
      localStorage.setItem('jengabooks_token', data.access_token);
      localStorage.setItem('jengabooks_refresh_token', data.refresh_token);
      localStorage.setItem('jengabooks_company_id', user.companyId);
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Login failed',
      });
    }
  },

  switchCompany: async (companyId: string): Promise<boolean> => {
    const { token, refreshToken } = get();
    if (!token) return false;
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/switch-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ companyId }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to switch company');
      const data = await response.json();
      const currentUser = get().user;
      set({
        user: {
          ...currentUser!,
          companyId: data.user.companyId,
          companyName: data.user.companyName,
          role: data.user.role,
        },
        token: data.access_token,
        isLoading: false,
      });
      localStorage.setItem('jengabooks_token', data.access_token);
      localStorage.setItem('jengabooks_refresh_token', data.refresh_token || refreshToken || '');
      localStorage.setItem('jengabooks_company_id', data.user.companyId);
      return true;
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Switch failed',
      });
      return false;
    }
  },

  logout: async () => {
    try {
      // Notify server to clear cookie
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Server might be unreachable, still logout locally
    }
    localStorage.removeItem('jengabooks_token');
    localStorage.removeItem('jengabooks_refresh_token');
    localStorage.removeItem('jengabooks_company_id');
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  setUser: (user: User) => {
    set({ user });
  },

  clearError: () => {
    set({ error: null });
  },
}));
