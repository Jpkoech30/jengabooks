import { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TransactionItem from '../components/ledger/transaction-item';
import { api } from '../lib/api-client';

const FILTERS = ['All', 'Debits', 'Credits'];

interface LedgerEntry {
  id: string;
  description: string;
  amount: number;
  direction: string;
  entryDate: string;
  account: { code: string; name: string };
}

export default function LedgerScreen() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadEntries = useCallback(async (pageNum: number = 1) => {
    setError(null);
    try {
      const data = await api.get<{ items: LedgerEntry[]; total: number; totalPages: number }>(
        `/ledger/entries?page=${pageNum}&limit=20`,
      );
      setEntries(data.items);
      setTotalPages(data.totalPages);
    } catch (e) {
      setError('Failed to load transactions');
      console.error('Failed to load entries:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEntries(page); }, [page]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEntries(1);
    setPage(1);
    setRefreshing(false);
  }, [loadEntries]);

  const filteredEntries = entries.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(search.toLowerCase()) ||
      (tx.account?.code || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === 'All' ||
      (activeFilter === 'Credits' && tx.direction === 'CREDIT') ||
      (activeFilter === 'Debits' && tx.direction === 'DEBIT');
    return matchesSearch && matchesFilter;
  });

  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

  if (loading && entries.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} className="flex-1 bg-kenya-surface-light items-center justify-center">
        <ActivityIndicator size="large" color="#0A5C36" />
        <Text className="mt-3 text-gray-400">Loading transactions...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-kenya-surface-light">
      <View className="px-4 pt-3 pb-2">
        <TextInput
          className="bg-white rounded-lg px-4 py-3 text-base border border-gray-200"
          placeholder="Search transactions..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          style={{ fontSize: 16 }}
        />
      </View>

      <View className="flex-row px-4 pb-3 space-x-2">
        {FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            onPress={() => setActiveFilter(filter)}
            className={`px-4 py-2 rounded-full min-h-[36px] min-w-[60px] ${
              activeFilter === filter ? 'bg-kenya-green-500' : 'bg-white border border-gray-200'
            }`}
          >
            <Text className={`text-sm font-medium ${activeFilter === filter ? 'text-white' : 'text-gray-600'}`}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && (
        <View className="mx-4 mb-2 bg-red-50 rounded-xl p-3 border border-red-200">
          <Text className="text-red-700 text-sm font-medium">{error}</Text>
        </View>
      )}

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionItem
            account={`${item.account?.code} ${item.account?.name}`}
            description={item.description}
            amount={formatKES(item.amount)}
            type={item.direction === 'DEBIT' ? 'debit' : 'credit'}
            date={new Date(item.entryDate).toLocaleDateString()}
            status="verified"
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A5C36" />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-gray-400 text-lg">
              {loading ? 'Loading...' : 'No transactions found'}
            </Text>
          </View>
        }
        ListFooterComponent={
          totalPages > 1 ? (
            <View className="flex-row justify-center items-center py-4 space-x-4">
              <TouchableOpacity
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 min-h-[36px]"
              >
                <Text className={`text-sm font-medium ${page <= 1 ? 'text-gray-300' : 'text-gray-600'}`}>← Prev</Text>
              </TouchableOpacity>
              <Text className="text-sm text-gray-500">{page} / {totalPages}</Text>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-4 py-2 rounded-lg bg-white border border-gray-200 min-h-[36px]"
              >
                <Text className={`text-sm font-medium ${page >= totalPages ? 'text-gray-300' : 'text-gray-600'}`}>Next →</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
