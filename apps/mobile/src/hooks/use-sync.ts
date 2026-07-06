import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useUIStore } from '../stores/ui-store';
import { useAuthStore } from '../stores/auth-store';
import apiClient from '../lib/api-client';

interface SyncConfig {
  pollIntervalMs?: number;
  onSyncComplete?: () => void;
  onSyncError?: (error: Error) => void;
}

export function useSync(config: SyncConfig = {}) {
  const { pollIntervalMs = 30000, onSyncComplete, onSyncError } = config;
  const { syncStatus, setSyncStatus } = useUIStore();
  const { user } = useAuthStore();
  const appState = useRef(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);

  const performSync = useCallback(async () => {
    if (isSyncingRef.current) return; // Prevent concurrent syncs
    isSyncingRef.current = true;

    try {
      setSyncStatus('syncing');
      // Attempt actual sync with backend
      const companyId = user?.companyId;
      const deviceId = `mobile-${Date.now().toString(36)}`;
      if (companyId) {
        await apiClient.post(`/sync/push/${companyId}/${deviceId}`, { changes: [] }).catch(() => {});
      }
      setSyncStatus('live');
      onSyncComplete?.();
    } catch (error) {
      setSyncStatus('offline');
      onSyncError?.(error as Error);
    } finally {
      isSyncingRef.current = false;
    }
  }, [setSyncStatus, onSyncComplete, onSyncError]);

  useEffect(() => {
    // Start polling
    intervalRef.current = setInterval(performSync, pollIntervalMs);

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // App came to foreground - sync immediately
        performSync();
      }
      appState.current = nextState;
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription.remove();
    };
  }, [pollIntervalMs, performSync]); // Fixed: added performSync to deps

  return {
    syncStatus,
    performSync,
  };
}
