import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { showToast } from '../stores/ui-store';
import { api } from '../lib/api-client';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  parentId?: string | null;
  children?: Account[];
  parent?: { id: string; code: string; name: string } | null;
}

const TYPE_COLORS: Record<string, string> = {
  ASSET: 'success',
  LIABILITY: 'warning',
  EQUITY: 'info',
  INCOME: 'success',
  EXPENSE: 'error',
} as const;

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const;

export function Accounts() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null);
  const [formData, setFormData] = React.useState({ code: '', name: '', type: 'EXPENSE', parentId: '' });
  const [saving, setSaving] = React.useState(false);

  async function loadAccounts() {
    setLoading(true);
    try {
      const data = await api.get<Account[]>('/ledger/accounts');
      setAccounts(data);
    } catch (e) {
      console.error('Failed to load accounts:', e);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadAccounts(); }, []);

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId || '',
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/ledger/accounts', {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        parentId: formData.parentId || undefined,
      });
      setShowCreateForm(false);
      setFormData({ code: '', name: '', type: 'EXPENSE', parentId: '' });
      showToast('success', 'Account created', `Account ${formData.code} has been created`);
      loadAccounts();
    } catch (err: any) {
      showToast('error', 'Failed to create account', err?.response?.data?.message || 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setSaving(true);
    try {
      await api.patch(`/ledger/accounts/${editingAccount.id}`, {
        name: formData.name,
        parentId: formData.parentId || undefined,
      });
      setEditingAccount(null);
      setFormData({ code: '', name: '', type: 'EXPENSE', parentId: '' });
      showToast('success', 'Account updated', `Account ${formData.name} has been updated`);
      loadAccounts();
    } catch (err: any) {
      showToast('error', 'Failed to update account', err?.response?.data?.message || 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    try {
      await api.patch(`/ledger/accounts/${id}`, { isActive: false });
      showToast('warning', 'Account deactivated', `${name} has been deactivated`);
      loadAccounts();
    } catch (err: any) {
      showToast('error', 'Failed to deactivate account', err?.response?.data?.message || 'Please try again');
    }
  };

  const handleReactivate = async (id: string, name: string) => {
    try {
      await api.patch(`/ledger/accounts/${id}`, { isActive: true });
      showToast('success', 'Account reactivated', `${name} is now active`);
      loadAccounts();
    } catch (err: any) {
      showToast('error', 'Failed to reactivate account', err?.response?.data?.message || 'Please try again');
    }
  };

  const rootAccounts = accounts.filter((a) => !a.parentId);
  const getChildren = (parentId: string) => accounts.filter((a) => a.parentId === parentId);

  const renderAccountRow = (account: Account, depth: number = 0) => (
    <React.Fragment key={account.id}>
      <tr className="border-b border-kenya-green-50 dark:border-kenya-green-900 last:border-0 hover:bg-kenya-green-50/50 dark:hover:bg-kenya-green-900/30">
        <td className="py-3 px-3" style={{ paddingLeft: `${16 + depth * 24}px` }}>
          <span className="font-mono text-xs text-kenya-green-700 dark:text-kenya-green-300">{account.code}</span>
        </td>
        <td className="py-3 px-3 text-kenya-green-900 dark:text-kenya-green-50 font-medium">{account.name}</td>
        <td className="py-3 px-3">
          <Badge variant={(TYPE_COLORS[account.type] || 'neutral') as any} size="sm">
            {account.type}
          </Badge>
        </td>
        <td className="py-3 px-3">
          <Badge variant={account.isActive ? 'success' : 'neutral'} size="sm">
            {account.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </td>
        <td className="py-3 px-3 text-right">
          <div className="flex gap-1 justify-end">
            <Button variant="ghost" size="sm" onClick={() => openEdit(account)}>
              Edit
            </Button>
            {account.isActive ? (
              <Button variant="ghost" size="sm" onClick={() => handleDeactivate(account.id, account.name)}>
                Deactivate
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => handleReactivate(account.id, account.name)}>
                Reactivate
              </Button>
            )}
          </div>
        </td>
      </tr>
      {getChildren(account.id).map((child) => renderAccountRow(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">Chart of Accounts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage your chart of accounts</p>
        </div>
        <Button size="sm" onClick={() => setShowCreateForm(true)}>+ New Account</Button>
      </div>

      {/* Create Account Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl border border-kenya-green-100 bg-white p-6 shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-kenya-green-900 dark:text-kenya-green-50">Create Account</h2>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <Input label="Account Code" placeholder="e.g., 5001" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} required />
              <Input label="Account Name" placeholder="e.g., Advertising" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Type</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark">
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Parent Account (optional)</label>
                <select value={formData.parentId} onChange={(e) => setFormData({ ...formData, parentId: e.target.value })} className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark">
                  <option value="">None (Top Level)</option>
                  {accounts.filter((a) => a.isActive).map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="ghost" size="lg" className="flex-1" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                <Button type="submit" size="lg" className="flex-1" disabled={saving}>{saving ? 'Creating...' : 'Create Account'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl border border-kenya-green-100 bg-white p-6 shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-kenya-green-900 dark:text-kenya-green-50">Edit Account</h2>
              <button onClick={() => setEditingAccount(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handleUpdate} className="flex flex-col gap-4">
              <Input label="Account Code" value={formData.code} disabled className="bg-gray-50 dark:bg-kenya-green-900/30" />
              <Input label="Account Name" placeholder="e.g., Advertising" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Type</label>
                <select value={editingAccount.type} disabled className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-gray-50 px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-green-900/30 text-gray-500">
                  <option value={editingAccount.type}>{editingAccount.type.charAt(0) + editingAccount.type.slice(1).toLowerCase()}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Parent Account (optional)</label>
                <select value={formData.parentId} onChange={(e) => setFormData({ ...formData, parentId: e.target.value })} className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark">
                  <option value="">None (Top Level)</option>
                  {accounts.filter((a) => a.isActive && a.id !== editingAccount.id).map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="ghost" size="lg" className="flex-1" onClick={() => setEditingAccount(null)}>Cancel</Button>
                <Button type="submit" size="lg" className="flex-1" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Accounts ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center"><p className="text-gray-500">Loading accounts...</p></div>
          ) : accounts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-3xl mb-2">📒</p>
              <p className="text-gray-500 dark:text-gray-400">No accounts yet. Create your first account to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-kenya-green-100 dark:border-kenya-green-800">
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Code</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Name</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Type</th>
                    <th className="text-left py-3 px-3 font-medium text-gray-500">Status</th>
                    <th className="text-right py-3 px-3 font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rootAccounts.map((account) => renderAccountRow(account))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
