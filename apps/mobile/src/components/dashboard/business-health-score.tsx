import { View, Text } from 'react-native';

interface BusinessHealthScoreProps {
  score: number;
  maxScore?: number;
  className?: string;
}

export default function BusinessHealthScore({
  score,
  maxScore = 5,
  className = '',
}: BusinessHealthScoreProps) {
  const percentage = (score / maxScore) * 100;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getGrade = (s: number) => {
    if (s >= 4.5) return { label: 'Excellent', color: '#0A5C36' };
    if (s >= 3.5) return { label: 'Good', color: '#E8A317' };
    if (s >= 2.5) return { label: 'Fair', color: '#F59E0B' };
    return { label: 'Needs Attention', color: '#BB1E10' };
  };

  const grade = getGrade(score);

  return (
    <View className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 ${className}`}>
      <Text className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
        Business Health Score
      </Text>
      <View className="items-center">
        <View className="relative w-24 h-24 items-center justify-center">
          {/* Background circle */}
          <View className="absolute w-24 h-24 rounded-full border-[6px] border-gray-100" />
          {/* Progress circle using overlay approach */}
          <View
            className="absolute w-24 h-24 rounded-full border-[6px]"
            style={{
              borderColor: grade.color,
              borderLeftColor: 'transparent',
              borderBottomColor: 'transparent',
              transform: [{ rotate: '-45deg' }],
            }}
          />
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800">{score}</Text>
            <Text className="text-xs text-gray-400">/{maxScore}</Text>
          </View>
        </View>
        <View className="flex-row items-center mt-3">
          <Text className="text-base font-bold" style={{ color: grade.color }}>
            {grade.label}
          </Text>
        </View>
        <View className="flex-row mt-2 space-x-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Text key={i} className="text-lg">
              {i < Math.round(score) ? '⭐' : '☆'}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}
