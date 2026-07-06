import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useUIStore } from '../stores/ui-store';

interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

export function useOffline() {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  });
  const { setSyncStatus } = useUIStore();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      setNetworkState({
        isConnected: connected,
        isInternetReachable: state.isInternetReachable ?? false,
        type: state.type,
      });
      setSyncStatus(connected ? 'live' : 'offline');
    });

    return () => unsubscribe();
  }, [setSyncStatus]);

  return {
    isConnected: networkState.isConnected,
    isInternetReachable: networkState.isInternetReachable,
    connectionType: networkState.type,
  };
}
