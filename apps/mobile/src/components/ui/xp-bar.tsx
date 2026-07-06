import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface XpBarProps {
  currentXp: number;
  maxXp: number;
  className?: string;
}

export default function XpBar({ currentXp, maxXp, className = '' }: XpBarProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const progress = Math.min(currentXp / maxXp, 1);

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress, animatedWidth]);

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View className={`${className}`}>
      <View className="flex-row justify-between mb-1">
        <Text className="text-xs font-medium text-gray-600">XP Progress</Text>
        <Text className="text-xs font-bold text-kenya-amber-500">
          {currentXp} / {maxXp} XP
        </Text>
      </View>
      <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <Animated.View
          className="h-full rounded-full"
          style={{
            width: widthInterpolated,
            backgroundColor: '#E8A317',
          }}
        />
      </View>
    </View>
  );
}
