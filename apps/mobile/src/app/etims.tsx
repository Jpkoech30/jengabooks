import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, RefreshControl, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Badge from '../components/ui/badge';
import { api } from '../lib/api-client';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  createdAt: string;
  status: string;
  etimsSubmission?: { status: string } | null;
}

export default function ETIMSScreen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadInvoices = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get<Invoice[]>('/etims/invoices');
      setInvoices(data);
    } catch (e) {
      setError('Failed to load invoices');
      console.error('Failed to load invoices:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInvoices(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  }, [loadInvoices]);

  const statusVariant = (inv: Invoice): 'submitted' | 'accepted' | 'pending' | 'failed' => {
    const s = inv.etimsSubmission?.status;
    if (s === 'ACCEPTED') return 'accepted';
    if (s === 'PENDING' || s === 'SUBMITTED') return 'submitted';
    if (s === 'FAILED') return 'failed';
    return 'pending';
  };

  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-kenya-surface-light items-center justify-center">
        <ActivityIndicator size="large" color="#0A5C36" />
        <Text className="mt-3 text-gray-400">Loading invoices...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-kenya-surface-light">
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A5C36" />}
      >
        <View className="px-4 pt-4 pb-2">
          <TouchableOpacity
            className="bg-kenya-green-500 rounded-xl py-4 px-6 flex-row items-center justify-center min-h-[52px]"
            activeOpacity={0.7}
          >
            <Text className="text-white font-bold text-base mr-2">➕</Text>
            <Text className="text-white font-bold text-base">Create Invoice</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View className="mx-4 mb-2 bg-red-50 rounded-xl p-3 border border-red-200">
            <Text className="text-red-700 text-sm font-medium">{error}</Text>
          </View>
        )}

        <View className="px-4 py-3">
          <View className="bg-kenya-green-50 rounded-xl p-4 border border-kenya-green-200">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-kenya-green-800 font-bold text-sm">Compliance Shield</Text>
                <Text className="text-kenya-green-600 text-xs mt-1">
                  {invoices.filter((i) => i.etimsSubmission?.status === 'ACCEPTED').length} of {invoices.length} synced
                </Text>
              </View>
              <View className="w-10 h-10 rounded-full bg-kenya-green-500 items-center justify-center">
                <Text className="text-white text-lg">✓</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="px-4 pt-2 pb-4">
          <Text className="text-lg font-bold text-gray-800 mb-3">Invoices</Text>
          {invoices.length === 0 ? (
            <View className="py-12 items-center">
              <Text className="text-gray-400">No invoices yet</Text>
            </View>
          ) : (
            invoices.map((inv) => (
              <View key={inv.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-800">{inv.invoiceNumber}</Text>
                    <Text className="text-base text-gray-600 mt-1">{inv.customerName}</Text>
                    <Text className="text-lg font-bold text-kenya-green-500 mt-1">{formatKES(inv.total)}</Text>
                  </View>
                  <Badge status={statusVariant(inv)} />
                </View>
                <Text className="text-xs text-gray-400 mt-2">{new Date(inv.createdAt).toLocaleDateString()}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
