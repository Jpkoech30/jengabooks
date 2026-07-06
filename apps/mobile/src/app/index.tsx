import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, RefreshControl, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SyncStatus from '../components/ui/sync-status';
import SummaryCard from '../components/dashboard/summary-card';
import BusinessHealthScore from '../components/dashboard/business-health-score';
import TransactionItem from '../components/ledger/transaction-item';
import { api } from '../lib/api-client';
import { useUIStore } from '../stores/ui-store';

interface DashboardData {
  totalEntries: number;
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
  recentEntries: Array<{
    id: string;
    description: string;
    amount: number;
    direction: string;
    entryDate: string;
    account: { code: string; name: string };
  }>;
  healthScore?: { overallScore: number };
  xpScore?: { score: number; level: number };
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { syncStatus } = useUIStore();

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [entries, trialBalance, healthScore] = await Promise.all([
        api.get<any>('/ledger/entries?limit=5').catch(() => ({ items: [], total: 0 })),
        api.get<any>('/ledger/trial-balance').catch(() => ({ totalDebits: 0, totalCredits: 0, balanced: true })),
        api.get<any>('/health-score').catch(() => null),
      ]);

      setData({
        totalEntries: entries.total || 0,
        totalDebits: trialBalance.totalDebits || 0,
        totalCredits: trialBalance.totalCredits || 0,
        balanced: trialBalance.balanced || false,
        recentEntries: entries.items?.slice(0, 5) || [],
        healthScore: healthScore ? { overallScore: healthScore.overallScore } : undefined,
      });
    } catch (e) {
      setError('Failed to load dashboard data');
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

  if (loading) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-kenya-surface-light items-center justify-center">
        <ActivityIndicator size="large" color="#0A5C36" />
        <Text className="mt-3 text-gray-400">Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-kenya-surface-light">
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A5C36" />
        }
      >
        <SyncStatus status={syncStatus} />

        {error && (
          <View className="bg-red-50 rounded-xl p-3 mt-2 border border-red-200">
            <Text className="text-red-700 text-sm font-medium">{error}</Text>
          </View>
        )}

        <View className="flex-row flex-wrap justify-between mt-2">
          <SummaryCard
            title="Total Debits"
            value={formatKES(data?.totalDebits || 0)}
            trend={data?.balanced ? 'up' : 'neutral'}
            className="w-[48%]"
          />
          <SummaryCard
            title="Total Credits"
            value={formatKES(data?.totalCredits || 0)}
            trend="up"
            className="w-[48%]"
          />
          <SummaryCard
            title="Transactions"
            value={String(data?.totalEntries || 0)}
            trend="neutral"
            className="w-[48%] mt-3"
          />
          <SummaryCard
            title="Trial Balance"
            value={data?.balanced ? 'Balanced' : 'Unbalanced'}
            trend={data?.balanced ? 'up' : 'down'}
            className="w-[48%] mt-3"
          />
        </View>

        {data?.healthScore && (
          <View className="mt-6 mb-4">
            <BusinessHealthScore score={data.healthScore.overallScore / 20} maxScore={5} />
          </View>
        )}

        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-800 mb-3">
            Recent Transactions
          </Text>
          {(data?.recentEntries || []).length === 0 ? (
            <View className="py-8 items-center">
              <Text className="text-gray-400">No transactions yet</Text>
            </View>
          ) : (
            data?.recentEntries.map((entry) => (
              <TransactionItem
                key={entry.id}
                account={`${entry.account?.code} ${entry.account?.name}`}
                description={entry.description}
                amount={formatKES(entry.amount)}
                type={entry.direction === 'DEBIT' ? 'debit' : 'credit'}
                date={new Date(entry.entryDate).toLocaleDateString()}
                status="verified"
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
