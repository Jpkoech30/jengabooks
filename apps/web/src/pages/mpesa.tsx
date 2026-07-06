import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api-client';

interface MpesaTx {
  id: string;
  receiptNo: string | null;
  transactionDate: string;
  description: string;
  amount: number;
  phoneNumber: string | null;
  isReconciled: boolean;
  mappedAccount?: { id: string; code: string; name: string } | null;
  category?: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
}

export function MpesaImport() {
  const [transactions, setTransactions] = React.useState<MpesaTx[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [result, setResult] = React.useState<{ imported: number; categorized: number; message: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: MpesaTx[]; total: number }>('/mpesa/transactions');
      setTransactions(data.items);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const loadAccounts = async () => {
    try {
      const data = await api.get<Account[]>('/ledger/accounts');
      setAccounts(data);
    } catch { /* ignore */ }
  };

  React.useEffect(() => {
    loadTransactions();
    loadAccounts();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const data = await api.post<{ imported: number; categorized: number; message: string }>('/mpesa/import', {
        csvData: text,
        fileName: file.name,
      });
      setResult(data);
      loadTransactions();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCategorize = async (txId: string, accountId: string) => {
    try {
      await api.patch(`/mpesa/transactions/${txId}/categorize`, { accountId });
      loadTransactions();
    } catch { /* ignore */ }
  };

  const formatKES = (amount: number) => `KES ${amount.toLocaleString('en-KE')}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">M-Pesa Import</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Import and categorize M-Pesa business transactions</p>
        </div>
      </div>

      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle>Upload M-Pesa CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed border-kenya-green-200 rounded-xl dark:border-kenya-green-700">
            <span className="text-4xl">📱</span>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Upload your M-Pesa business statement CSV file
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <Button
              variant="secondary"
              size="lg"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? 'Importing...' : 'Choose CSV File'}
            </Button>
            {result && (
              <div className="rounded-lg bg-kenya-green-50 p-4 text-sm text-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300">
                {result.message}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Imported Transactions ({transactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center"><p className="text-gray-500">Loading transactions...</p></div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">📄</p>
              <p className="text-gray-500 dark:text-gray-400">No imported transactions yet. Upload a CSV to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-kenya-green-100 dark:border-kenya-green-800">
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Description</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Amount</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Phone</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Account</th>
                    <th className="text-center py-3 px-3 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-kenya-green-50 dark:border-kenya-green-900 last:border-0 hover:bg-kenya-green-50/50 dark:hover:bg-kenya-green-900/30">
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {new Date(tx.transactionDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-kenya-green-900 dark:text-kenya-green-50">{tx.description}</td>
                      <td className="py-3 px-3 text-right font-mono text-sm font-medium">{formatKES(tx.amount)}</td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{tx.phoneNumber || '-'}</td>
                      <td className="py-3 px-3">
                        {tx.mappedAccount ? (
                          <Badge variant="success" size="sm">{tx.mappedAccount.code}</Badge>
                        ) : (
                          <select
                            className="text-xs rounded border border-kenya-green-200 px-2 py-1 dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
                            onChange={(e) => e.target.value && handleCategorize(tx.id, e.target.value)}
                            defaultValue=""
                          >
                            <option value="" disabled>Categorize...</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant={tx.isReconciled ? 'success' : 'warning'} size="sm">
                          {tx.isReconciled ? 'Mapped' : 'Unmapped'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
