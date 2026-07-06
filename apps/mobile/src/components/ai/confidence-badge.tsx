import { View, Text } from 'react-native';

interface ConfidenceBadgeProps {
  percentage: number;
  className?: string;
}

export default function ConfidenceBadge({
  percentage,
  className = '',
}: ConfidenceBadgeProps) {
  const getColor = (pct: number) => {
    if (pct >= 85) return { bg: 'bg-green-100', text: 'text-green-700' };
    if (pct >= 70) return { bg: 'bg-yellow-100', text: 'text-yellow-700' };
    return { bg: 'bg-red-100', text: 'text-red-700' };
  };

  const colors = getColor(percentage);

  return (
    <View className={`${colors.bg} rounded-full px-2.5 py-1 ${className}`}>
      <Text className={`${colors.text} text-xs font-bold`}>
        {percentage}%
      </Text>
    </View>
  );
}
