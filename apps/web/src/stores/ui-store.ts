import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

interface UiState {
  toasts: Toast[];
  darkMode: boolean;
  showGamification: boolean;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  toggleDarkMode: () => void;
  setShowGamification: (show: boolean) => void;
}

const getInitialDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('jengabooks_dark_mode');
  if (stored !== null) return stored === 'true';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const applyDarkMode = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// Apply on load
applyDarkMode(getInitialDarkMode());

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  darkMode: getInitialDarkMode(),
  showGamification: true,

  addToast: (toast) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  toggleDarkMode: () => {
    set((state) => {
      const newDark = !state.darkMode;
      localStorage.setItem('jengabooks_dark_mode', String(newDark));
      applyDarkMode(newDark);
      return { darkMode: newDark };
    });
  },

  setShowGamification: (show) => {
    localStorage.setItem('jengabooks_show_gamification', String(show));
    set({ showGamification: show });
  },
}));

// Helper to add toast from anywhere
export function showToast(variant: ToastVariant, title: string, message?: string) {
  useUiStore.getState().addToast({ variant, title, message: message || '' });
}
