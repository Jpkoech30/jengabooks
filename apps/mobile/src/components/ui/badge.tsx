import { View, Text } from 'react-native';

interface BadgeProps {
  status: 'pending' | 'submitted' | 'accepted' | 'failed' | 'verified' | 'flagged';
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
  submitted: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Submitted' },
  accepted: { bg: 'bg-green-100', text: 'text-green-700', label: 'Accepted' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
  verified: { bg: 'bg-green-100', text: 'text-green-700', label: 'Verified' },
  flagged: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Flagged' },
};

export default function Badge({ status }: BadgeProps) {
  const config = statusConfig[status];

  if (!config) {
    return null;
  }

  return (
    <View className={`${config.bg} rounded-full px-3 py-1`}>
      <Text className={`${config.text} text-xs font-bold`}>{config.label}</Text>
    </View>
  );
}
