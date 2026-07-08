import React from 'react';
import { useCompanyRefresh } from '../hooks/use-company-refresh';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { PageShell } from '../components/layout/page-shell';
import { PageState } from '../components/ui/page-state';
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

export function ETIMS() {
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<'invoices' | 'create'>('invoices');
  const [formData, setFormData] = React.useState({
    customerName: '',
    customerPin: '',
    customerEmail: '',
    lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
    taxCode: 'S',
    dueDate: '',
    notes: '',
  });

  React.useEffect(() => {
    if (activeTab === 'invoices') {
      loadInvoices();
    }
  }, [activeTab]);

  async function loadInvoices() {
    setLoading(true);
    try {
      const data = await api.get<Invoice[]>('/etims/invoices');
      setInvoices(data);
    } catch (e) {
      console.error('Failed to load invoices:', e);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/etims/invoices', {
        ...formData,
        lineItems: formData.lineItems.filter((i) => i.description),
      });
      setActiveTab('invoices');
      loadInvoices();
    } catch (e) {
      console.error('Failed to create invoice:', e);
    }
  };

  const handleSubmitToKra = async (invoiceId: string) => {
    try {
      await api.post(`/etims/submissions/${invoiceId}/submit`);
      loadInvoices();
    } catch (e) {
      console.error('Failed to submit to KRA:', e);
    }
  };

  const formatKES = (amount: number) =>
    `KES ${amount.toLocaleString('en-KE')}`;

  const statusVariant = (invoice: Invoice): 'success' | 'warning' | 'error' | 'neutral' => {
    const etimsStatus = invoice.etimsSubmission?.status;
    if (etimsStatus === 'ACCEPTED') return 'success';
    if (etimsStatus === 'PENDING' || etimsStatus === 'SUBMITTED') return 'warning';
    if (etimsStatus === 'FAILED') return 'error';
    return 'neutral';
  };

  const statusLabel = (invoice: Invoice): string => {
    const etimsStatus = invoice.etimsSubmission?.status;
    if (etimsStatus === 'ACCEPTED') return 'Synced';
    if (etimsStatus === 'PENDING') return 'Pending';
    if (etimsStatus === 'SUBMITTED') return 'Submitted';
    if (etimsStatus === 'FAILED') return 'Failed';
    return invoice.status;
  };

  return (
    <PageShell
      title="eTIMS Integration"
      subtitle="Kenya Revenue Authority tax compliance"
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="success" size="md">KRA Connected</Badge>
          <Button variant="secondary" size="sm" onClick={loadInvoices}>Refresh</Button>
        </div>
      }
    >

      {/* Tabs */}
      <div className="flex gap-2 border-b border-kenya-green-100 dark:border-kenya-green-800">
        <button onClick={() => setActiveTab('invoices')} className={`touch-target px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'invoices' ? 'border-kenya-green-500 text-kenya-green-700 dark:text-kenya-green-300' : 'border-transparent text-gray-500 hover:text-kenya-green-600'}`}>
          Invoice History
        </button>
        <button onClick={() => setActiveTab('create')} className={`touch-target px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'create' ? 'border-kenya-green-500 text-kenya-green-700 dark:text-kenya-green-300' : 'border-transparent text-gray-500 hover:text-kenya-green-600'}`}>
          Create Invoice
        </button>
      </div>

      {activeTab === 'invoices' && (
        <Card>
          <CardHeader>
            <CardTitle>eTIMS Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <PageState
              state={loading ? 'loading' : invoices.length === 0 ? 'empty' : 'ready'}
              icon="🧾"
              title="No invoices yet"
              description="Create your first eTIMS invoice."
              skeletonRows={4}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-kenya-green-100 dark:border-kenya-green-800">
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Invoice #</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Customer</th>
                      <th className="text-right py-3 px-3 font-medium text-gray-500">Amount</th>
                      <th className="text-left py-3 px-3 font-medium text-gray-500">Date</th>
                      <th className="text-center py-3 px-3 font-medium text-gray-500">Status</th>
                      <th className="text-center py-3 px-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-kenya-green-50 dark:border-kenya-green-900 last:border-0 hover:bg-kenya-green-50/50 dark:hover:bg-kenya-green-900/30">
                        <td className="py-3 px-3 font-mono text-xs text-kenya-green-700 dark:text-kenya-green-300">{inv.invoiceNumber}</td>
                        <td className="py-3 px-3 text-kenya-green-900 dark:text-kenya-green-50">{inv.customerName}</td>
                        <td className="py-3 px-3 text-right font-mono text-sm font-medium">{formatKES(inv.total)}</td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{new Date(inv.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant={statusVariant(inv)} size="sm">{statusLabel(inv)}</Badge>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="sm" onClick={() => handleSubmitToKra(inv.id)}>Submit to KRA</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PageState>
          </CardContent>
        </Card>
      )}

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>New eTIMS Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateInvoice} className="flex flex-col gap-5">
                <Input label="Customer Name" placeholder="e.g., Tech Corp Kenya" value={formData.customerName} onChange={(e) => setFormData({ ...formData, customerName: e.target.value })} required />
                <Input label="Customer PIN (optional)" placeholder="KRA PIN" value={formData.customerPin} onChange={(e) => setFormData({ ...formData, customerPin: e.target.value })} />
                <Input label="Customer Email (optional)" type="email" placeholder="email@example.com" value={formData.customerEmail} onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Tax Code</label>
                  <select value={formData.taxCode} onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })} className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark">
                    <option value="S">Standard (16% VAT)</option>
                    <option value="E">Exempt</option>
                    <option value="Z">Zero-rated</option>
                  </select>
                </div>
                <Input label="Due Date" type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
                <Input label="Notes (optional)" placeholder="Additional notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                <div className="flex gap-3 pt-2">
                  <Button type="submit" size="lg" className="flex-1">Create Invoice</Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>KRA Compliance Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between rounded-lg bg-kenya-green-50 p-4 dark:bg-kenya-green-900/30">
                  <span className="text-sm text-kenya-green-700 dark:text-kenya-green-300">Total Invoices</span>
                  <span className="text-sm font-bold text-kenya-green-900 dark:text-kenya-green-50">{invoices.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-kenya-green-50 p-4 dark:bg-kenya-green-900/30">
                  <span className="text-sm text-kenya-green-700 dark:text-kenya-green-300">Synced to KRA</span>
                  <Badge variant="success">{invoices.filter((i) => i.etimsSubmission?.status === 'ACCEPTED').length}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-kenya-amber-50 p-4 dark:bg-kenya-amber-900/30">
                  <span className="text-sm text-kenya-amber-700 dark:text-kenya-amber-300">Pending Sync</span>
                  <Badge variant="warning">{invoices.filter((i) => !i.etimsSubmission || i.etimsSubmission.status === 'PENDING').length}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-red-50 p-4 dark:bg-red-900/30">
                  <span className="text-sm text-red-700 dark:text-red-300">Failed Syncs</span>
                  <Badge variant="error">{invoices.filter((i) => i.etimsSubmission?.status === 'FAILED').length}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
