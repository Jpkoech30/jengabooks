import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Card from '../components/ui/card';
import { api } from '../lib/api-client';

const REPORT_TYPES = [
  { id: 'profit-loss', title: 'Profit & Loss', icon: '📊', description: 'Revenue, expenses, and net income', endpoint: '/reports/profit-loss' },
  { id: 'balance', title: 'Balance Sheet', icon: '🏛️', description: 'Assets, liabilities, and equity', endpoint: '/reports/balance-sheet' },
  { id: 'cashflow', title: 'Cash Flow', icon: '💵', description: 'Cash inflows and outflows', endpoint: '/reports/cash-flow' },
  { id: 'tax', title: 'Trial Balance', icon: '🧾', description: 'All account balances', endpoint: '/reports/trial-balance' },
];

interface ReportData {
  title: string;
  data: Record<string, unknown>;
}

export default function ReportsScreen() {
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-07-03');
  const [generating, setGenerating] = useState(false);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (report: typeof REPORT_TYPES[0]) => {
    setGenerating(true);
    setError(null);
    setActiveReport(report.id);
    setReportData(null);

    try {
      const params: Record<string, string> = {};
      if (report.id === 'profit-loss' || report.id === 'cashflow') {
        params.from = new Date(startDate).toISOString();
        params.to = new Date(endDate).toISOString();
      } else {
        params.asOf = new Date(endDate).toISOString();
      }
      const result = await api.get<Record<string, unknown>>(report.endpoint, params);
      setReportData(result);
    } catch (e) {
      setError('Failed to generate report. The server may be unavailable.');
      Alert.alert('Error', 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const renderReportResult = () => {
    if (!reportData || !activeReport) return null;

    return (
      <View className="mt-4 mb-6">
        <Text className="text-lg font-bold text-gray-800 mb-2">
          {REPORT_TYPES.find((r) => r.id === activeReport)?.title} Results
        </Text>
        <Card>
          {Object.entries(reportData).map(([key, value]) => (
            <View key={key} className="flex-row justify-between py-2 border-b border-gray-100 last:border-b-0">
              <Text className="text-sm text-gray-600 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </Text>
              <Text className="text-sm font-semibold text-gray-800">
                {typeof value === 'number'
                  ? `KES ${value.toLocaleString('en-KE')}`
                  : String(value)}
              </Text>
            </View>
          ))}
        </Card>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-kenya-surface-light">
      <ScrollView className="flex-1 px-4">
        <View className="pt-4 pb-3">
          <View className="flex-row space-x-2">
            <View className="flex-1">
              <Text className="text-xs font-medium text-gray-500 mb-1">From</Text>
              <TextInput
                className="bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm"
                value={startDate}
                onChangeText={setStartDate}
                style={{ fontSize: 16 }}
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-medium text-gray-500 mb-1">To</Text>
              <TextInput
                className="bg-white rounded-lg px-3 py-2 border border-gray-200 text-sm"
                value={endDate}
                onChangeText={setEndDate}
                style={{ fontSize: 16 }}
              />
            </View>
          </View>
        </View>

        <Text className="text-lg font-bold text-gray-800 mb-3">Report Types</Text>

        <View className="flex-row flex-wrap justify-between">
          {REPORT_TYPES.map((report) => (
            <TouchableOpacity
              key={report.id}
              className="w-[48%] bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100 min-h-[100px]"
              onPress={() => handleGenerate(report)}
              disabled={generating}
              activeOpacity={0.7}
            >
              {generating && activeReport === report.id ? (
                <View className="items-center justify-center py-2">
                  <ActivityIndicator size="small" color="#0A5C36" />
                  <Text className="text-xs text-gray-400 mt-1">Generating...</Text>
                </View>
              ) : (
                <>
                  <Text className="text-2xl mb-2">{report.icon}</Text>
                  <Text className="font-bold text-gray-800 text-sm">{report.title}</Text>
                  <Text className="text-xs text-gray-500 mt-1">{report.description}</Text>
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <View className="bg-red-50 rounded-xl p-3 mb-4 border border-red-200">
            <Text className="text-red-700 text-sm font-medium">{error}</Text>
          </View>
        )}

        {renderReportResult()}
      </ScrollView>
    </SafeAreaView>
  );
}
