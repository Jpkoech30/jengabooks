import { View, Text } from 'react-native';

interface SummaryCardProps {
  title: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

const trendConfig: Record<string, { icon: string; color: string }> = {
  up: { icon: '↑', color: 'text-green-600' },
  down: { icon: '↓', color: 'text-kenya-red' },
  neutral: { icon: '→', color: 'text-gray-400' },
};

export default function SummaryCard({
  title,
  value,
  trend,
  className = '',
}: SummaryCardProps) {
  const trendInfo = trend ? trendConfig[trend] : null;

  return (
    <View className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 ${className}`}>
      <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {title}
      </Text>
      <Text className="text-xl font-bold text-gray-800 mt-1">{value}</Text>
      {trendInfo && (
        <View className="flex-row items-center mt-1">
          <Text className={`${trendInfo.color} text-sm font-bold mr-1`}>
            {trendInfo.icon}
          </Text>
          <Text className={`${trendInfo.color} text-xs`}>
            {trend === 'up' ? '+12%' : trend === 'down' ? '-3%' : '0%'}
          </Text>
        </View>
      )}
    </View>
  );
}
