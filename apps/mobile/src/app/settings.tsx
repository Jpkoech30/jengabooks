import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../components/ui/card';
import { useAuthStore } from '../stores/auth-store';
import { useUIStore } from '../stores/ui-store';
import { getInitials } from '../lib/utils';

const THEME_OPTIONS = ['Light', 'Dark', 'System'];

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const { syncStatus, setSyncStatus } = useUIStore();
  const [selectedTheme, setSelectedTheme] = useState('Light');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const initials = user?.name ? getInitials(user.name) : '??';

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  };

  const handleSyncNow = async () => {
    setSyncStatus('syncing');
    // Simulate sync
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSyncStatus('live');
    Alert.alert('Sync Complete', 'All data has been synchronized successfully.');
  };

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-kenya-surface-light">
      <ScrollView className="flex-1 px-4">
        {/* Profile Section */}
        <Card className="mt-4">
          <View className="items-center py-2">
            <View className="w-20 h-20 rounded-full bg-kenya-green-500 items-center justify-center mb-3">
              <Text className="text-white text-3xl font-bold">{initials}</Text>
            </View>
            <Text className="text-xl font-bold text-gray-800">{user?.name || 'User'}</Text>
            <Text className="text-sm text-gray-500">{user?.email || ''}</Text>
            <View className="bg-kenya-green-50 rounded-full px-4 py-1 mt-2">
              <Text className="text-xs font-bold text-kenya-green-600">
                {user?.companyName || 'Your Company'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Tenant Switcher */}
        <Card className="mt-4">
          <Text className="font-bold text-gray-800 mb-2">Current Tenant</Text>
          <TouchableOpacity className="flex-row items-center justify-between py-2 min-h-[48px]">
            <Text className="text-gray-600">{user?.companyName || 'No company'}</Text>
            <Text className="text-kenya-green-500 text-sm font-medium">Switch ▸</Text>
          </TouchableOpacity>
        </Card>

        {/* Theme */}
        <Card className="mt-4">
          <Text className="font-bold text-gray-800 mb-3">Theme</Text>
          <View className="flex-row space-x-2">
            {THEME_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setSelectedTheme(option)}
                className={`flex-1 py-3 rounded-lg items-center min-h-[44px] ${
                  selectedTheme === option
                    ? 'bg-kenya-green-500'
                    : 'bg-gray-100'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selectedTheme === option ? 'text-white' : 'text-gray-600'
                  }`}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Notifications */}
        <Card className="mt-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="font-bold text-gray-800">Notifications</Text>
              <Text className="text-xs text-gray-500 mt-1">Push notifications for HITL items</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#D1D5DB', true: '#99C3AB' }}
              thumbColor={notificationsEnabled ? '#0A5C36' : '#9CA3AF'}
            />
          </View>
        </Card>

        {/* Sync Status */}
        <Card className="mt-4">
          <Text className="font-bold text-gray-800 mb-2">Sync Status</Text>
          <View className="flex-row items-center mb-3">
            <View
              className={`w-3 h-3 rounded-full mr-2 ${
                syncStatus === 'live' ? 'bg-green-500' :
                syncStatus === 'syncing' ? 'bg-yellow-500' : 'bg-red-500'
              }`}
            />
            <Text className="text-sm text-gray-600">
              {syncStatus === 'live' ? 'Live — All data synced' :
               syncStatus === 'syncing' ? 'Syncing...' : 'Offline — Check connection'}
            </Text>
          </View>
          <TouchableOpacity
            className="bg-kenya-amber-500 rounded-lg py-3 items-center min-h-[44px]"
            onPress={handleSyncNow}
            disabled={syncStatus === 'syncing'}
          >
            <Text className="text-white font-semibold text-sm">
              {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* App Version */}
        <Card className="mt-4">
          <View className="flex-row justify-between items-center">
            <Text className="font-bold text-gray-800">App Version</Text>
            <Text className="text-sm text-gray-500">1.0.0</Text>
          </View>
        </Card>

        {/* Logout */}
        <TouchableOpacity
          className="bg-kenya-red rounded-xl py-4 items-center mt-6 mb-8 min-h-[52px]"
          onPress={handleLogout}
        >
          <Text className="text-white font-bold text-base">Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
