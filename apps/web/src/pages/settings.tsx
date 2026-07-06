import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthStore } from '../stores/auth-store';
import { showToast } from '../stores/ui-store';
import { api } from '../lib/api-client';

export function Settings() {
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const [companyName, setCompanyName] = React.useState(user?.companyName || '');
  const [saving, setSaving] = React.useState(false);

  // Create company state
  const [showCreateCompany, setShowCreateCompany] = React.useState(false);
  const [newCompanyName, setNewCompanyName] = React.useState('');
  const [newCompanyTier, setNewCompanyTier] = React.useState('BRONZE');
  const [newCompanyKraPin, setNewCompanyKraPin] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.companyId) return;
    setSaving(true);
    try {
      await api.patch(`/companies/${user.companyId}`, { name: companyName });
      showToast('success', 'Company updated', 'Company name has been updated successfully');
    } catch (err: any) {
      showToast('error', 'Update failed', err?.response?.data?.message || 'Could not update company');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const company = await api.post<{ id: string; name: string; tier: string }>('/companies', {
        name: newCompanyName,
        tier: newCompanyTier,
        kraPin: newCompanyKraPin || undefined,
      });

      // Add current user as SME_OWNER
      await api.post(`/companies/${company.id}/members`, {
        userId: user!.id,
        role: 'SME_OWNER',
      });

      showToast('success', 'Company created', `${newCompanyName} has been created. Switch to it to start working.`);
      setShowCreateCompany(false);
      setNewCompanyName('');
      setNewCompanyKraPin('');
      setNewCompanyTier('BRONZE');
    } catch (err: any) {
      showToast('error', 'Failed to create company', err?.response?.data?.message || 'Please try again');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage your account and company settings</p>
      </div>

      {/* Company Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateCompany} className="flex flex-col gap-4 max-w-md">
            <Input
              label="Company Name"
              placeholder="Your company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p><strong>Company ID:</strong> {user?.companyId || '-'}</p>
              <p><strong>Your Role:</strong> {user?.role?.replace(/_/g, ' ') || '-'}</p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button type="submit" size="lg" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 max-w-md">
            <div className="rounded-lg bg-kenya-green-50 p-4 dark:bg-kenya-green-900/30">
              <p className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">{user?.name || 'N/A'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email || 'N/A'}</p>
            </div>
            <p className="text-xs text-gray-400">
              Profile management and password change will be available in a future update.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Create New Company */}
      <Card>
        <CardHeader>
          <CardTitle>Client Onboarding</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Create a new company to manage a different set of books. You can switch between companies
            using the company switcher in the header.
          </p>
          {showCreateCompany ? (
            <form onSubmit={handleCreateCompany} className="flex flex-col gap-4 max-w-md">
              <Input
                label="Company Name"
                placeholder="e.g., Acme Enterprises Ltd"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                required
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Tier</label>
                <select
                  value={newCompanyTier}
                  onChange={(e) => setNewCompanyTier(e.target.value)}
                  className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
                >
                  <option value="BRONZE">Bronze</option>
                  <option value="GOLD">Gold</option>
                  <option value="PLATINUM">Platinum</option>
                </select>
              </div>
              <Input
                label="KRA PIN (optional)"
                placeholder="P051234567A"
                maxLength={11}
                value={newCompanyKraPin}
                onChange={(e) => setNewCompanyKraPin(e.target.value.toUpperCase())}
              />
              <div className="flex gap-3 mt-2">
                <Button type="button" variant="ghost" size="lg" className="flex-1" onClick={() => setShowCreateCompany(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="lg" className="flex-1" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Company'}
                </Button>
              </div>
            </form>
          ) : (
            <Button size="lg" onClick={() => setShowCreateCompany(true)}>
              + Create New Company
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
