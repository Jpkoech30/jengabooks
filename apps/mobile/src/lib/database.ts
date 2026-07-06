/**
 * Local database layer for JengaBooks Mobile.
 *
 * Provides offline-capable storage using React Native's built-in
 * AsyncStorage-style key-value store. This can be replaced with
 * WatermelonDB or SQLite when full offline sync is required.
 *
 * Currently serves as a cache layer for the API-first architecture.
 */

export const DB_VERSION = 2;

export interface StoredTransaction {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  description: string;
  amount: number;
  direction: 'DEBIT' | 'CREDIT';
  entryDate: string;
  status: 'verified' | 'pending' | 'flagged';
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredAccount {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
  balance: number;
  isActive: boolean;
}

// In-memory cache for offline availability
// In production, this would use AsyncStorage or WatermelonDB
let offlineCache: {
  transactions: StoredTransaction[];
  accounts: StoredAccount[];
} = {
  transactions: [],
  accounts: [],
};

export function getDatabaseStatus(): { initialized: boolean; version: number } {
  return {
    initialized: true,
    version: DB_VERSION,
  };
}

export function getCachedTransactions(): StoredTransaction[] {
  return [...offlineCache.transactions];
}

export function getCachedAccounts(): StoredAccount[] {
  return [...offlineCache.accounts];
}

export function updateTransactionCache(transactions: StoredTransaction[]): void {
  offlineCache.transactions = transactions;
}

export function updateAccountCache(accounts: StoredAccount[]): void {
  offlineCache.accounts = accounts;
}

export function clearCache(): void {
  offlineCache = { transactions: [], accounts: [] };
}
