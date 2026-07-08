import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Modal } from '../components/ui/modal';
import { PageShell } from '../components/layout/page-shell';
import { PageState } from '../components/ui/page-state';
import { useAuthStore } from '../stores/auth-store';
import { showToast } from '../stores/ui-store';
import { api } from '../lib/api-client';

interface Member {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  user: { id: string; email: string; name: string };
}

const ROLE_OPTIONS: Record<string, string> = {
  SME_OWNER: 'Owner',
  ACCOUNTANT: 'Accountant',
  VIEWER: 'Viewer',
  AUDITOR: 'Auditor',
};

const ROLE_LIST = ['ACCOUNTANT', 'VIEWER', 'AUDITOR'] as const;

export function Team() {
  const companyId = useAuthStore((state) => state.user?.companyId);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showInvite, setShowInvite] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState('ACCOUNTANT');
  const [inviteName, setInviteName] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [changingRole, setChangingRole] = React.useState<string | null>(null);

  const loadMembers = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await api.get<Member[]>(`/companies/${companyId}/members`);
      setMembers(data);
    } catch (err: any) {
      showToast('error', 'Failed to load team', err?.response?.data?.message || 'Could not load team members');
    } finally { setLoading(false); }
  };

  React.useEffect(() => { loadMembers(); }, [companyId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSending(true);
    try {
      await api.post(`/companies/${companyId}/members/invite`, {
        email: inviteEmail,
        role: inviteRole,
        name: inviteName || undefined,
      });
      showToast('success', 'Invitation sent', `${inviteEmail} has been added to the team`);
      setShowInvite(false);
      setInviteEmail('');
      setInviteName('');
      loadMembers();
    } catch (err: any) {
      showToast('error', 'Invitation failed', err?.response?.data?.message || 'Could not invite user');
    } finally { setSending(false); }
  };

  const handleRoleChange = async (userId: string, newRole: string, name: string) => {
    if (!companyId) return;
    setChangingRole(userId);
    try {
      await api.patch(`/companies/${companyId}/members/${userId}`, { role: newRole });
      showToast('success', 'Role updated', `${name}'s role has been changed to ${ROLE_OPTIONS[newRole] || newRole}`);
      loadMembers();
    } catch (err: any) {
      showToast('error', 'Failed to update role', err?.response?.data?.message || 'Please try again');
    } finally { setChangingRole(null); }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!companyId) return;
    try {
      await api.delete(`/companies/${companyId}/members/${userId}`);
      showToast('success', 'Member removed', `${name} has been removed from the team`);
      loadMembers();
    } catch { showToast('error', 'Failed to remove member'); }
  };

  return (
    <PageShell
      title="Team"
      subtitle="Manage your team members and their roles"
      actions={
        <Button size="sm" onClick={() => setShowInvite(true)}>+ Invite Member</Button>
      }
    >
      {/* Invite Modal - using shared Modal component with focus trapping and keyboard escape */}
      <Modal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite Team Member"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button type="button" variant="ghost" size="md" className="flex-1" onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
            <Button type="submit" size="md" className="flex-1" disabled={sending} form="invite-form">
              {sending ? 'Inviting...' : 'Send Invitation'}
            </Button>
          </div>
        }
      >
        <form id="invite-form" onSubmit={handleInvite} className="flex flex-col gap-4">
          <Input label="Email Address" type="email" placeholder="colleague@company.co.ke" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
          <Input label="Full Name (optional)" placeholder="e.g., Mary Wanjiku" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">Role</label>
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark">
              <option value="ACCOUNTANT">Accountant</option>
              <option value="VIEWER">Viewer (read-only)</option>
              <option value="AUDITOR">Auditor</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <PageState
            state={loading ? 'loading' : members.length === 0 ? 'empty' : 'ready'}
            icon="👥"
            title="No team members yet"
            description="Invite someone to collaborate."
            skeletonRows={3}
          >
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-xl border border-kenya-green-100 p-4 dark:border-kenya-green-800">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kenya-green-100 text-sm font-bold text-kenya-green-700 dark:bg-kenya-green-900 dark:text-kenya-green-300">
                      {member.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50">{member.user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Role badge with change dropdown for non-owners */}
                    {member.role === 'SME_OWNER' ? (
                      <Badge variant="success" size="sm">Owner</Badge>
                    ) : (
                      <div className="relative">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.userId, e.target.value, member.user.name)}
                          disabled={changingRole === member.userId || member.userId === currentUserId}
                          className={`text-xs rounded-lg border px-3 py-2 pr-8 appearance-none cursor-pointer ${
                            member.role === 'ACCOUNTANT'
                              ? 'border-kenya-green-200 bg-kenya-green-50 text-kenya-green-700 dark:border-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300'
                              : member.role === 'VIEWER'
                              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'border-kenya-amber-200 bg-kenya-amber-50 text-kenya-amber-700 dark:border-kenya-amber-700 dark:bg-kenya-amber-900/30 dark:text-kenya-amber-300'
                          }`}
                        >
                          {ROLE_LIST.map((role) => (
                            <option key={role} value={role}>{ROLE_OPTIONS[role]}</option>
                          ))}
                        </select>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs pointer-events-none" aria-hidden="true">▾</span>
                      </div>
                    )}
                    {member.role !== 'SME_OWNER' && (
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(member.userId, member.user.name)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </PageState>
        </CardContent>
      </Card>
    </PageShell>
  );
}
