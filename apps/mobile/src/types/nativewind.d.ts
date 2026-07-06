// Type declarations for React Native components with className support (NativeWind)
import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    className?: string;
  }
  interface TextProps {
    className?: string;
  }
  interface TextInputProps {
    className?: string;
  }
  interface TouchableOpacityProps {
    className?: string;
  }
  interface ScrollViewProps {
    className?: string;
  }
  interface FlatListProps<ItemT> {
    className?: string;
  }
  interface KeyboardAvoidingViewProps {
    className?: string;
  }
  interface RefreshControlProps {
    className?: string;
  }
  interface SwitchProps {
    className?: string;
  }
  interface ImageProps {
    className?: string;
  }
  interface ActivityIndicatorProps {
    className?: string;
  }
  interface PressableProps {
    className?: string;
  }
}

// SafeAreaView from react-native-safe-area-context
declare module 'react-native-safe-area-context' {
  interface NativeSafeAreaViewProps {
    className?: string;
  }
}
