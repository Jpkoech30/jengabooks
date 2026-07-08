import { create } from 'zustand';

export type ViewMode = 'firm' | 'client';

interface ActiveClient {
  id: string;
  name: string;
}

interface ViewModeState {
  mode: ViewMode;
  activeClient: ActiveClient | null;
  setMode: (mode: ViewMode) => void;
  setActiveClient: (client: ActiveClient | null) => void;
}

export const useViewModeStore = create<ViewModeState>((set) => ({
  mode: 'client',
  activeClient: null,
  setMode: (mode) => {
    set({ mode });
    // Persist in URL without full page reload
    const url = new URL(window.location.href);
    if (mode === 'firm') {
      url.searchParams.set('view', 'firm');
    } else {
      url.searchParams.delete('view');
    }
    window.history.replaceState({}, '', url.toString());
  },
  setActiveClient: (client) => set({ activeClient: client }),
}));

/**
 * Initialize view mode from URL params on app load.
 * Call this once during App initialization.
 */
export function initViewModeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'firm') {
    useViewModeStore.getState().setMode('firm');
  }
}
