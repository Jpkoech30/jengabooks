import React from 'react';
import { z } from 'zod';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { PageState } from '../components/ui/page-state';
import { Badge } from '../components/ui/badge';
import { Modal } from '../components/ui/modal';
import { PageShell } from '../components/layout/page-shell';
import { showToast } from '../stores/ui-store';
import { api } from '../lib/api-client';
import { createAccountSchema } from '@jengabooks/shared/schemas';

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

/** Highlights matching search text with a yellow background */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-700/50 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function Accounts() {
  const queryClient = useQueryClient();
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null);
  const [formData, setFormData] = React.useState({ code: '', name: '', type: 'EXPENSE', parentId: '' });
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});

  const invalidateAccounts = () => {
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    loadAccounts();
  };

  const createMutation = useMutation({
    mutationFn: (data: { code: string; name: string; type: string; parentId?: string }) =>
      api.post('/ledger/accounts', data),
    onSuccess: () => {
      setShowCreateForm(false);
      setFormData({ code: '', name: '', type: 'EXPENSE', parentId: '' });
      showToast('success', 'Account created', `Account ${formData.code} has been created`);
      invalidateAccounts();
    },
    onError: (err: any) => {
      showToast('error', 'Failed to create account', err?.response?.data?.message || 'Please try again');
    },
    onSettled: () => setSaving(false),
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; name: string; parentId?: string }) =>
      api.patch(`/ledger/accounts/${data.id}`, { name: data.name, parentId: data.parentId }),
    onSuccess: () => {
      setEditingAccount(null);
      setFormData({ code: '', name: '', type: 'EXPENSE', parentId: '' });
      showToast('success', 'Account updated', `Account ${formData.name} has been updated`);
      invalidateAccounts();
    },
    onError: (err: any) => {
      showToast('error', 'Failed to update account', err?.response?.data?.message || 'Please try again');
    },
    onSettled: () => setSaving(false),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (data: { id: string; isActive: boolean; name: string }) =>
      api.patch(`/ledger/accounts/${data.id}`, { isActive: data.isActive }),
    onSuccess: (_data, variables) => {
      showToast(variables.isActive ? 'success' : 'warning', `${variables.isActive ? 'Reactivated' : 'Deactivated'}`, `${variables.name} has been ${variables.isActive ? 'reactivated' : 'deactivated'}`);
      invalidateAccounts();
    },
    onError: (err: any) => {
      showToast('error', 'Failed to update account', err?.response?.data?.message || 'Please try again');
    },
  });

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

  // Client-side search across code and name
  const filteredAccounts = search
    ? accounts.filter(
        (a) =>
          a.code.toLowerCase().includes(search.toLowerCase()) ||
          a.name.toLowerCase().includes(search.toLowerCase()),
      )
    : accounts;
  const filteredRootAccounts = filteredAccounts.filter((a) => !a.parentId);
  const filteredGetChildren = (parentId: string) =>
    filteredAccounts.filter((a) => a.parentId === parentId);

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      type: account.type,
      parentId: account.parentId || '',
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    const result = createAccountSchema.safeParse({
      code: formData.code,
      name: formData.name,
      type: formData.type,
      parentId: formData.parentId || undefined,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        errors[issue.path[0] as string] = issue.message;
      });
      setFormErrors(errors);
      return;
    }
    setSaving(true);
    createMutation.mutate(result.data);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setSaving(true);
    updateMutation.mutate({
      id: editingAccount.id,
      name: formData.name,
      parentId: formData.parentId || undefined,
    });
  };

  const handleDeactivate = (id: string, name: string) => {
    toggleActiveMutation.mutate({ id, isActive: false, name });
  };

  const handleReactivate = (id: string, name: string) => {
    toggleActiveMutation.mutate({ id, isActive: true, name });
  };

  const rootAccounts = accounts.filter((a) => !a.parentId);
  const getChildren = (parentId: string) => accounts.filter((a) => a.parentId === parentId);

  const renderAccountRow = (account: Account, depth: number = 0) => (
    <React.Fragment key={account.id}>
      <tr className={`border-b border-kenya-green-50 dark:border-kenya-green-900 last:border-0 hover:bg-kenya-green-50/50 dark:hover:bg-kenya-green-900/30 ${
        depth % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-kenya-green-50/20 dark:bg-kenya-green-900/10'
      }`}>
        <td className="py-3 px-3" style={{ paddingLeft: `${16 + depth * 24}px` }}>
          <span className="font-mono text-xs text-kenya-green-700 dark:text-kenya-green-300">
            {highlightText(account.code, search)}
          </span>
        </td>
        <td className="py-3 px-3 text-kenya-green-900 dark:text-kenya-green-50 font-medium">
          {highlightText(account.name, search)}
        </td>
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
      {filteredGetChildren(account.id).map((child) => renderAccountRow(child, depth + 1))}
    </React.Fragment>
  );

  const accountOptions = accounts.filter((a) => a.isActive).map((a) => (
    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
  ));

  return (
    <PageShell
      title="Chart of Accounts"
      subtitle="Manage your chart of accounts"
      actions={
        <Button size="sm" onClick={() => setShowCreateForm(true)}>+ New Account</Button>
      }
    >
      {/* Create Account Modal */}
      <Modal
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        title="Create Account"
        size="md"
        footer={
          <div className="flex gap-3 w-full">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => setShowCreateForm(false)}>Cancel</Button>
            <Button type="submit" size="md" className="flex-1" disabled={saving} form="create-account-form">{saving ? 'Creating...' : 'Create Account'}</Button>
          </div>
        }
      >
        <form id="create-account-form" onSubmit={handleCreate} className="flex flex-col gap-4">
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
              {accountOptions}
            </select>
          </div>
        </form>
      </Modal>

      {/* Edit Account Modal */}
      <Modal
        isOpen={editingAccount !== null}
        onClose={() => setEditingAccount(null)}
        title="Edit Account"
        size="md"
        footer={
          <div className="flex gap-3 w-full">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => setEditingAccount(null)}>Cancel</Button>
            <Button type="submit" size="md" className="flex-1" disabled={saving} form="edit-account-form">{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        }
      >
        <form id="edit-account-form" onSubmit={handleUpdate} className="flex flex-col gap-4">
          <Input label="Account Code" value={formData.code} disabled className="bg-gray-50 dark:bg-kenya-green-900/30" />
          <Input label="Account Name" placeholder="e.g., Advertising" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Type</label>
            <select value={editingAccount?.type || ''} disabled className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-gray-50 px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-green-900/30 text-gray-500">
              <option value={editingAccount?.type || ''}>{editingAccount ? editingAccount.type.charAt(0) + editingAccount.type.slice(1).toLowerCase() : ''}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Parent Account (optional)</label>
            <select value={formData.parentId} onChange={(e) => setFormData({ ...formData, parentId: e.target.value })} className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark">
              <option value="">None (Top Level)</option>
              {accounts.filter((a) => a.isActive && a.id !== editingAccount?.id).map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full gap-3">
            <CardTitle className="shrink-0">All Accounts ({filteredAccounts.length})</CardTitle>
            <div className="flex-1 max-w-xs">
              <Input
                placeholder="Search by code or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PageState
            state={loading ? 'loading' : accounts.length === 0 ? 'empty' : 'ready'}
            icon="📒"
            title="No accounts yet"
            description="Create your first account to get started with the chart of accounts."
            action={{ label: 'Create your first account', onClick: () => setShowCreateForm(true) }}
            skeletonRows={5}
          >
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
                  {filteredRootAccounts.map((account) => renderAccountRow(account))}
                </tbody>
              </table>
            </div>
          </PageState>
        </CardContent>
      </Card>
    </PageShell>
  );
}
