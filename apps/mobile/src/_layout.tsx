import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function useProtectedRoute() {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    hydrate().then(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to the login page
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to the app
      router.replace('/app');
    }
  }, [isAuthenticated, hydrated, segments]);
}

export default function RootLayout() {
  const { isLoading, isAuthenticated } = useAuthStore();

  useProtectedRoute();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-kenya-surface-light">
        <ActivityIndicator size="large" color="#0A5C36" />
        <Text className="mt-4 text-gray-500 text-sm">Loading JengaBooks...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={isAuthenticated ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="app" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
