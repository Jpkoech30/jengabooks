import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';
type SyncStatus = 'live' | 'syncing' | 'offline';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  read: boolean;
  timestamp: string;
}

interface UIState {
  theme: Theme;
  syncStatus: SyncStatus;
  notifications: Notification[];
  activeTab: string;
  setTheme: (theme: Theme) => void;
  setSyncStatus: (status: SyncStatus) => void;
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  setActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'light',
  syncStatus: 'live',
  notifications: [],
  activeTab: 'index',

  setTheme: (theme: Theme) => set({ theme }),
  setSyncStatus: (status: SyncStatus) => set({ syncStatus: status }),

  addNotification: (notification: Notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),

  markNotificationRead: (id: string) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),

  clearNotifications: () => set({ notifications: [] }),
  setActiveTab: (tab: string) => set({ activeTab: tab }),
}));
