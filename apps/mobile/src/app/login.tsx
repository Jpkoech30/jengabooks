import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, User } from '../stores/auth-store';
import { api } from '../lib/api-client';

type AuthMode = 'login' | 'register';

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { login: storeLogin, isLoading } = useAuthStore();

  const handleSubmit = async () => {
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('Email is required');
      return;
    }
    if (!password || password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }
    if (mode === 'register') {
      if (!name.trim()) {
        setLocalError('Name is required');
        return;
      }
      if (!companyName.trim()) {
        setLocalError('Company name is required');
        return;
      }
    }

    setLocalLoading(true);
    try {
      if (mode === 'login') {
        await storeLogin(email, password);
      } else {
        // Register via API
        const response = await api.post<{ access_token: string; user: User }>('/auth/register', {
          email,
          password,
          name,
          companyName,
        });

        // Set user in store (login will be called automatically via hydrate)
        const { setUser } = useAuthStore.getState();
        setUser(response.user);

        // Also store token
        const { login: loginAction } = useAuthStore.getState();
        // The store's login does the actual API call, so we need a different approach
        // Manually set the auth state since register returns token directly
        await useAuthStore.getState().login(email, password);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLocalLoading(false);
    }
  };

  const effectiveLoading = localLoading || isLoading;

  return (
    <SafeAreaView className="flex-1 bg-kenya-surface-light">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo & Brand */}
          <View className="items-center mb-10">
            <View className="w-20 h-20 rounded-2xl bg-kenya-green-500 items-center justify-center mb-4">
              <Text className="text-white text-4xl font-bold">J</Text>
            </View>
            <Text className="text-3xl font-bold text-gray-800">JengaBooks</Text>
            <Text className="text-sm text-gray-500 mt-1">
              {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </Text>
          </View>

          {/* Form */}
          <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            {mode === 'register' && (
              <>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1">Full Name</Text>
                  <TextInput
                    className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 min-h-[48px]"
                    placeholder="James Ochieng"
                    placeholderTextColor="#9CA3AF"
                    value={name}
                    onChangeText={setName}
                    style={{ fontSize: 16 }}
                    autoCapitalize="words"
                  />
                </View>
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1">Company Name</Text>
                  <TextInput
                    className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 min-h-[48px]"
                    placeholder="Acme Enterprises Ltd"
                    placeholderTextColor="#9CA3AF"
                    value={companyName}
                    onChangeText={setCompanyName}
                    style={{ fontSize: 16 }}
                  />
                </View>
              </>
            )}

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 min-h-[48px]"
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                style={{ fontSize: 16 }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
              <TextInput
                className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 min-h-[48px]"
                placeholder="At least 8 characters"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                style={{ fontSize: 16 }}
                secureTextEntry
              />
            </View>

            {localError && (
              <View className="bg-red-50 rounded-xl p-3 mb-4 border border-red-200">
                <Text className="text-red-700 text-sm font-medium">{localError}</Text>
              </View>
            )}

            <TouchableOpacity
              className="bg-kenya-green-500 rounded-xl py-4 items-center min-h-[52px]"
              onPress={handleSubmit}
              disabled={effectiveLoading}
              activeOpacity={0.7}
            >
              {effectiveLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-white font-bold text-base">
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Mode Toggle */}
            <TouchableOpacity
              className="mt-4 items-center py-2 min-h-[40px]"
              onPress={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setLocalError(null);
              }}
              disabled={effectiveLoading}
            >
              <Text className="text-sm text-gray-500">
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <Text className="text-kenya-green-500 font-semibold">Register</Text>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <Text className="text-kenya-green-500 font-semibold">Sign In</Text>
                  </>
                )}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text className="text-center text-xs text-gray-400 mt-8 mb-4">
            By continuing, you agree to the Terms of Service and Privacy Policy
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
