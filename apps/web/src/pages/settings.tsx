import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Toggle } from '../components/ui/toggle';
import { XPBar } from '../components/ui/xp-bar';
import { Modal } from '../components/ui/modal';
import { EmptyState } from '../components/ui/empty-state';
import { PageShell } from '../components/layout/page-shell';
import { useAuthStore } from '../stores/auth-store';
import { useUiStore, showToast } from '../stores/ui-store';
import { useGamificationProfile } from '../hooks/use-api';
import { api } from '../lib/api-client';

// ─── Tabs ─────────────────────────────────────────────────────────────────
type Tab = 'profile' | 'preferences' | 'billing' | 'danger-zone';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'preferences', label: 'Preferences', icon: '⚙️' },
  { key: 'billing', label: 'Billing', icon: '💳' },
  { key: 'danger-zone', label: 'Danger Zone', icon: '⚠️' },
];

// ─── Danger Zone: Clear Imported Data Confirmation ───────────────────────
interface ClearDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isClearing: boolean;
}

function ClearDataModal({ isOpen, onClose, onConfirm, isClearing }: ClearDataModalProps) {
  const [typedText, setTypedText] = React.useState('');
  const expectedText = 'DELETE';

  React.useEffect(() => {
    if (!isOpen) {
      setTypedText('');
    }
  }, [isOpen]);

  const isConfirmed = typedText === expectedText;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Clear All Imported Data"
      size="md"
      footer={
        <div className="flex w-full gap-3">
          <Button variant="secondary" size="md" className="flex-1" onClick={onClose} disabled={isClearing}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="md"
            className="flex-1"
            disabled={!isConfirmed || isClearing}
            onClick={onConfirm}
          >
            {isClearing ? 'Clearing...' : 'Clear All Data'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            This action cannot be undone. All imported M-Pesa transactions, categorisation data,
            and reconciled entries will be permanently removed.
          </p>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          To confirm, type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE</span> below:
        </p>

        <Input
          label="Type DELETE to confirm"
          placeholder="DELETE"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          autoComplete="off"
        />
      </div>
    </Modal>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────
function ProfileTab() {
  const user = useAuthStore((state) => state.user);
  const [companyName, setCompanyName] = React.useState(user?.companyName || '');
  const [saving, setSaving] = React.useState(false);

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

  const memberships = user?.memberships || [];
  const hasMultipleCompanies = memberships.length > 1;

  return (
    <div className="space-y-6">
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

            {/* Company switcher indicator for multi-company users */}
            {hasMultipleCompanies && (
              <div className="rounded-lg bg-kenya-green-50 p-3 dark:bg-kenya-green-900/20">
                <p className="text-xs text-kenya-green-700 dark:text-kenya-green-300">
                  You have access to {memberships.length} companies. Use the company switcher in the header to switch between them.
                </p>
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <Button type="submit" size="lg" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Account Information */}
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
    </div>
  );
}

// ─── Preferences Tab ──────────────────────────────────────────────────────
function PreferencesTab() {
  const darkMode = useUiStore((state) => state.darkMode);
  const toggleDarkMode = useUiStore((state) => state.toggleDarkMode);
  const showGamification = useUiStore((state) => state.showGamification);
  const setShowGamification = useUiStore((state) => state.setShowGamification);
  const { data: gamification } = useGamificationProfile();

  return (
    <div className="space-y-6">
      {/* Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Display Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5 max-w-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Dark Mode</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Switch between light and dark theme</p>
              </div>
              <Toggle
                checked={darkMode}
                onChange={toggleDarkMode}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Gamification</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Show XP badges, levels, and gamification elements</p>
              </div>
              <Toggle
                checked={showGamification}
                onChange={setShowGamification}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gamification Progress (only when enabled) */}
      {showGamification && gamification && (
        <Card>
          <CardHeader>
            <CardTitle>Gamification & Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 max-w-md">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⭐</span>
                <div>
                  <p className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">
                    Level {gamification.level} — {gamification.levelTitle}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {gamification.score} XP total
                  </p>
                </div>
              </div>
              <XPBar
                current={gamification.score}
                max={gamification.score + gamification.xpToNextLevel}
                label="Progress to next level"
              />
              {gamification.recentActivity && gamification.recentActivity.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Activity</p>
                  <div className="space-y-1.5">
                    {gamification.recentActivity.slice(0, 5).map((activity, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-xs font-medium text-kenya-amber-600">+{activity.points} XP</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{activity.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────
function BillingTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon="💳"
          title="Billing information coming soon"
          description="Subscription management, payment methods, and invoices will be available in a future update."
          action={{ label: 'Contact Support', onClick: () => window.open('mailto:support@jengabooks.com') }}
          helpLink={{ label: 'Learn about JengaBooks pricing', href: '#' }}
        />
      </CardContent>
    </Card>
  );
}

// ─── Danger Zone Tab ──────────────────────────────────────────────────────
function DangerZoneTab() {
  const [showClearModal, setShowClearModal] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);

  const handleClearData = async () => {
    setIsClearing(true);
    try {
      await api.delete('/mpesa');
      showToast('success', 'Data cleared', 'All imported M-Pesa data has been permanently removed');
      setShowClearModal(false);
    } catch (err: any) {
      showToast('error', 'Failed to clear data', err?.response?.data?.message || 'Please try again');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <>
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="text-red-700 dark:text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Clear Imported Data */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">Clear All Imported Data</p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  Permanently remove all M-Pesa transactions, categorisation, and reconciled entries.
                </p>
              </div>
              <Button
                variant="destructive"
                size="md"
                onClick={() => setShowClearModal(true)}
                className="shrink-0"
              >
                Clear Data
              </Button>
            </div>

            {/* Danger Zone information */}
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <strong>⚠️ Warning:</strong> Actions in this section are permanent and cannot be undone.
                Always ensure you have a backup before proceeding with destructive operations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ClearDataModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearData}
        isClearing={isClearing}
      />
    </>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────
export function Settings() {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = React.useState<Tab>('profile');

  const hasCompany = !!user?.companyId;
  const memberships = user?.memberships || [];

  // ── Edge case: No company ─────────────────────────────────────────────
  if (!hasCompany) {
    return (
      <PageShell
        title="Settings"
        subtitle="Manage your account, preferences, and company settings"
      >
        <Card>
          <CardContent>
            <EmptyState
              icon="🏢"
              title="No company selected"
              description="You are not currently associated with any company. Create a new company or join an existing one to get started."
              action={{
                label: 'Create New Company',
                onClick: () => {
                  // The company creation flow is in the header company switcher,
                  // so navigate to header or open a company creation flow.
                  // For now, show a toast directing users to the header.
                  showToast('info', 'Create a Company', 'Use the company switcher in the header to create or join a company.');
                },
              }}
              helpLink={{ label: 'Learn about companies in JengaBooks', href: '#' }}
            />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Settings"
      subtitle="Manage your account, preferences, and company settings"
    >
      {/* Tabs navigation */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-0 overflow-x-auto" aria-label="Settings tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`tabpanel-${tab.key}`}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`touch-target inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-kenya-green-500 text-kenya-green-700 dark:border-kenya-green-400 dark:text-kenya-green-300'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200'
              }`}
            >
              <span aria-hidden="true" className="text-base">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === 'profile' && <ProfileTab />}
        {activeTab === 'preferences' && <PreferencesTab />}
        {activeTab === 'billing' && <BillingTab />}
        {activeTab === 'danger-zone' && <DangerZoneTab />}
      </div>
    </PageShell>
  );
}
