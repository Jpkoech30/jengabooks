import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../components/ui/card';
import ConfidenceBadge from '../components/ai/confidence-badge';
import XpBar from '../components/ui/xp-bar';
import { api } from '../lib/api-client';

const SEGMENTS = ['Pending', 'In Progress', 'Resolved'];

interface HitlTask {
  id: string;
  category: string;
  description: string;
  status: string;
  assignedUser?: { id: string; name: string } | null;
  createdAt: string;
}

export default function HITLScreen() {
  const [tasks, setTasks] = useState<HitlTask[]>([]);
  const [activeSegment, setActiveSegment] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<{ items: HitlTask[]; total: number }>('/hitl');
      setTasks(data.items);
    } catch (e) {
      setError('Failed to load review items');
      console.error('Failed to load HITL tasks:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, []);

  const resolveTask = async (taskId: string) => {
    setResolvingId(taskId);
    try {
      await api.post(`/hitl/${taskId}/resolve`, { resolution: 'Resolved via mobile' });
      Alert.alert('Resolved', 'Task has been resolved successfully!');
      loadTasks();
    } catch (e) {
      Alert.alert('Error', 'Failed to resolve task. Please try again.');
      console.error('Failed to resolve:', e);
    } finally {
      setResolvingId(null);
    }
  };

  const filteredItems = tasks.filter((item) => {
    if (activeSegment === 'Pending') return item.status === 'PENDING';
    if (activeSegment === 'In Progress') return item.status === 'IN_PROGRESS';
    return item.status === 'RESOLVED';
  });

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-kenya-surface-light">
      <View className="px-4 pt-3 pb-4">
        <View className="flex-row bg-gray-100 rounded-xl p-1">
          {SEGMENTS.map((seg) => (
            <TouchableOpacity
              key={seg}
              onPress={() => setActiveSegment(seg)}
              className={`flex-1 py-2 rounded-lg min-h-[40px] items-center ${
                activeSegment === seg ? 'bg-white shadow-sm' : ''
              }`}
            >
              <Text className={`text-sm font-semibold ${activeSegment === seg ? 'text-kenya-green-500' : 'text-gray-500'}`}>
                {seg}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView className="flex-1 px-4">
        {loading ? (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color="#0A5C36" />
            <Text className="text-gray-400 mt-3">Loading review items...</Text>
          </View>
        ) : error ? (
          <View className="mx-4 bg-red-50 rounded-xl p-4 border border-red-200">
            <Text className="text-red-700 text-sm font-medium">{error}</Text>
            <TouchableOpacity
              className="mt-3 bg-red-100 rounded-lg py-2 px-4 items-center min-h-[40px]"
              onPress={loadTasks}
            >
              <Text className="text-red-700 font-semibold text-sm">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : filteredItems.length === 0 ? (
          <View className="items-center py-20">
            <Text className="text-4xl mb-3">🎉</Text>
            <Text className="text-gray-400 text-lg">No items in this category</Text>
          </View>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} className="mb-3">
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-xs font-bold text-kenya-green-500 uppercase tracking-wide">
                  {item.category.replace(/_/g, ' ')}
                </Text>
                <ConfidenceBadge percentage={85} />
              </View>
              <Text className="text-sm text-gray-700 leading-5 mb-3">{item.description}</Text>
              {item.status !== 'RESOLVED' && (
                <TouchableOpacity
                  className="bg-kenya-green-500 rounded-lg py-3 px-4 items-center min-h-[44px] flex-row justify-center"
                  onPress={() => resolveTask(item.id)}
                  disabled={resolvingId === item.id}
                >
                  {resolvingId === item.id ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Text className="text-white font-semibold text-sm mr-2">✓</Text>
                      <Text className="text-white font-semibold text-sm">Resolve — +50 XP</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              {item.status === 'RESOLVED' && (
                <View className="bg-gray-100 rounded-lg py-3 px-4">
                  <Text className="text-gray-500 text-sm text-center">✅ Resolved</Text>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
