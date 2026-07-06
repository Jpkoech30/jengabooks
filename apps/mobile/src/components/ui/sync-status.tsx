import { View, Text } from 'react-native';

interface SyncStatusProps {
  status: 'live' | 'syncing' | 'offline';
  className?: string;
}

const statusConfig: Record<string, { bg: string; dot: string; label: string }> = {
  live: { bg: 'bg-green-100', dot: 'bg-green-500', label: 'Live — All synced' },
  syncing: { bg: 'bg-yellow-100', dot: 'bg-yellow-500', label: 'Syncing...' },
  offline: { bg: 'bg-red-100', dot: 'bg-red-500', label: 'Offline — Check connection' },
};

export default function SyncStatus({ status, className = '' }: SyncStatusProps) {
  const config = statusConfig[status];

  if (!config) {
    return null;
  }

  return (
    <View className={`${config.bg} rounded-lg px-3 py-2 flex-row items-center mt-2 ${className}`}>
      <View className={`w-2.5 h-2.5 rounded-full ${config.dot} mr-2`} />
      <Text className="text-xs font-medium text-gray-700">{config.label}</Text>
    </View>
  );
}
