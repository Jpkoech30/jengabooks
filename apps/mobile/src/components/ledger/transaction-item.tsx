import { View, Text } from 'react-native';
import Badge from '../ui/badge';

interface TransactionItemProps {
  account: string;
  description: string;
  amount: string;
  type: 'credit' | 'debit';
  date: string;
  status: 'verified' | 'pending' | 'flagged';
}

export default function TransactionItem({
  account,
  description,
  amount,
  type,
  date,
  status,
}: TransactionItemProps) {
  return (
    <View className="bg-white rounded-xl p-4 mb-2 shadow-sm border border-gray-100">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View
            className={`w-2.5 h-2.5 rounded-full mr-3 ${
              type === 'credit' ? 'bg-green-500' : 'bg-kenya-red'
            }`}
          />
          <View className="flex-1">
            <Text className="font-semibold text-gray-800 text-sm">{account}</Text>
            <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
              {description}
            </Text>
            <Text className="text-xs text-gray-400 mt-0.5">{date}</Text>
          </View>
        </View>
        <View className="items-end ml-2">
          <Text
            className={`font-bold text-sm ${
              type === 'credit' ? 'text-green-600' : 'text-kenya-red'
            }`}
          >
            {type === 'credit' ? '+' : '-'} {amount}
          </Text>
          <View className="mt-1">
            <Badge status={status} />
          </View>
        </View>
      </View>
    </View>
  );
}
