import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'bg-kenya-green-500',
  secondary: 'bg-kenya-amber-500',
  destructive: 'bg-kenya-red',
  outline: 'bg-white border border-kenya-green-500',
};

const textStyles: Record<string, string> = {
  default: 'text-white',
  secondary: 'text-white',
  destructive: 'text-white',
  outline: 'text-kenya-green-500',
};

export default function Button({
  title,
  onPress,
  variant = 'default',
  loading = false,
  disabled = false,
  icon,
  className = '',
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`rounded-xl py-4 px-6 flex-row items-center justify-center min-h-[48px] min-w-[48px] ${variantStyles[variant]} ${disabled ? 'opacity-50' : ''} ${className}`}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <View className="flex-row items-center">
          {icon && <Text className="mr-2">{icon}</Text>}
          <Text className={`font-bold text-base ${textStyles[variant]}`}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
