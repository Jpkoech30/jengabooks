import { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface ThinkingBubbleProps {
  message?: string;
  className?: string;
}

export default function ThinkingBubble({
  message = 'AI Processing...',
  className = '',
}: ThinkingBubbleProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <View className={`bg-kenya-green-50 rounded-xl p-4 border border-kenya-green-100 ${className}`}>
      <View className="flex-row items-center">
        <Animated.View
          className="w-8 h-8 rounded-full bg-kenya-green-200 items-center justify-center mr-3"
          style={{ opacity }}
        >
          <Text className="text-sm">🤖</Text>
        </Animated.View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-kenya-green-700">{message}</Text>
          <View className="flex-row mt-1">
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                className="w-2 h-2 rounded-full bg-kenya-green-400 mx-0.5"
                style={{
                  opacity: opacity.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [0.3 + i * 0.2, 1 - i * 0.2],
                  }),
                }}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
