import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { showToast } from '../stores/ui-store';
import type {
  Account,
  JournalEntry,
  PaginatedResponse,
  Invoice,
  MpesaTransaction,
  HitlTask,
  TrialBalance,
  ProfitLoss,
  BalanceSheet,
  GamificationProfile,
  HealthScore,
  WizardProgress,
  CompanyMember,
  Notification,
  CollaborationTask,
} from '../lib/types';

// ─── Ledger ─────────────────────────────────────────────────────────────

export function useAccounts() {
  return useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => api.get('/ledger/accounts'),
  });
}

export function useJournalEntries(page = 1, search?: string) {
  const params: Record<string, unknown> = { page, limit: 20 };
  if (search) params.search = search;
  return useQuery<PaginatedResponse<JournalEntry>>({
    queryKey: ['journal-entries', page, search],
    queryFn: () => api.get('/ledger/entries', params),
  });
}

export function useTrialBalance() {
  return useQuery<TrialBalance>({
    queryKey: ['trial-balance'],
    queryFn: () => api.get('/ledger/trial-balance'),
  });
}

export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { accountId: string; description: string; amount: number; reference?: string; entryDate: string }) =>
      api.post('/ledger/transactions/income', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal-entries'] });
      qc.invalidateQueries({ queryKey: ['trial-balance'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      showToast('success', 'Income recorded', 'Transaction has been posted successfully');
    },
    onError: (err: any) => {
      showToast('error', 'Failed to record income', err?.response?.data?.message || 'Please try again');
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { accountId: string; description: string; amount: number; reference?: string; entryDate: string }) =>
      api.post('/ledger/transactions/expense', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journal-entries'] });
      qc.invalidateQueries({ queryKey: ['trial-balance'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      showToast('success', 'Expense recorded', 'Transaction has been posted successfully');
    },
    onError: (err: any) => {
      showToast('error', 'Failed to record expense', err?.response?.data?.message || 'Please try again');
    },
  });
}

// ─── eTIMS ──────────────────────────────────────────────────────────────

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: () => api.get('/etims/invoices'),
  });
}

export function useSubmitToKra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => api.post(`/etims/submissions/${invoiceId}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      showToast('success', 'Submitted to KRA', 'Invoice has been submitted for eTIMS processing');
    },
    onError: (err: any) => showToast('error', 'KRA submission failed', err?.response?.data?.message),
  });
}

// ─── M-Pesa ─────────────────────────────────────────────────────────────

export function useMpesaTransactions() {
  return useQuery<PaginatedResponse<MpesaTransaction>>({
    queryKey: ['mpesa-transactions'],
    queryFn: () => api.get('/mpesa'),
  });
}

export function useImportMpesa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { csvData: string; fileName: string }) =>
      api.post<{ imported: number; categorized: number; message: string }>('/mpesa/import', data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['mpesa-transactions'] });
      showToast('success', 'M-Pesa Imported', data.message);
    },
    onError: (err: any) => showToast('error', 'Import failed', err?.response?.data?.message),
  });
}

// ─── HITL ───────────────────────────────────────────────────────────────

export function useHitlTasks() {
  return useQuery<PaginatedResponse<HitlTask>>({
    queryKey: ['hitl-tasks'],
    queryFn: () => api.get('/hitl'),
  });
}

// useResolveHitlTask was removed — the HITL Hub page calls the API directly
// via api.post() and handles the response inline, which is more flexible.

// ─── Reports ────────────────────────────────────────────────────────────

export function useProfitLoss(from?: string, to?: string) {
  return useQuery<ProfitLoss>({
    queryKey: ['profit-loss', from, to],
    queryFn: () => api.get('/reports/profit-loss', { from, to }),
    enabled: false, // Only fetch on demand
  });
}

export function useBalanceSheet(asOf?: string) {
  return useQuery<BalanceSheet>({
    queryKey: ['balance-sheet', asOf],
    queryFn: () => api.get('/reports/balance-sheet', { asOf }),
    enabled: false,
  });
}

// ─── Gamification ───────────────────────────────────────────────────────

export function useGamificationProfile() {
  return useQuery<GamificationProfile>({
    queryKey: ['gamification'],
    queryFn: () => api.get('/gamification/profile'),
  });
}

export function useHealthScore() {
  return useQuery<HealthScore>({
    queryKey: ['health-score'],
    queryFn: () => api.get('/health-score'),
  });
}

export function useWizardProgress() {
  return useQuery<WizardProgress>({
    queryKey: ['wizard'],
    queryFn: () => api.get('/wizard/progress'),
  });
}

// ─── Team ───────────────────────────────────────────────────────────────

export function useTeamMembers(companyId?: string) {
  return useQuery<CompanyMember[]>({
    queryKey: ['team-members', companyId],
    queryFn: () => api.get(`/companies/${companyId}/members`),
    enabled: !!companyId,
  });
}

// ─── Payroll ──────────────────────────────────────────────────────────────

export interface PayrollRun {
  id: string;
  period: string;
  status: string;
  totalEmployees: number;
  grossPay: number;
  netPay: number;
  paye: number;
  entries?: PayrollEntry[];
  createdAt: string;
}

export interface PayrollEntry {
  id: string;
  employeeName: string;
  kraPin?: string | null;
  department?: string | null;
  basicSalary: number;
  housingAllowance: number;
  paye: number;
  nhif: number;
  nssf: number;
  housingLevy: number;
  grossPay: number;
  netPay: number;
}

export interface PayrollRunsResponse {
  items: PayrollRun[];
  total: number;
}

export interface CalculatePayResponse {
  paye: number;
  nhif: number;
  nssf: number;
  housingLevy: number;
  grossPay: number;
  netPay: number;
}

export function usePayrollRuns() {
  return useQuery<PayrollRunsResponse>({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs'),
  });
}

export function usePayrollRun(id: string | null) {
  return useQuery<PayrollRun>({
    queryKey: ['payroll-run', id],
    queryFn: () => api.get(`/payroll/runs/${id}`),
    enabled: !!id,
  });
}

export function useCalculatePay() {
  return useMutation<CalculatePayResponse, Error, { basicSalary: number; housingAllowance: number }>({
    mutationFn: (data) => api.post('/payroll/calculate', data),
  });
}

// ─── Collaboration: Notifications ──────────────────────────────────────────

export function useNotifications(status?: 'UNREAD' | 'ALL') {
  return useQuery<Notification[]>({
    queryKey: ['notifications', status],
    queryFn: () => api.get('/collab/notifications', { userId: 'me', status: status || 'UNREAD' }),
    refetchInterval: 30_000, // Poll every 30s for new notifications
  });
}

export function useUnreadCount() {
  return useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/collab/notifications/count', { userId: 'me' }),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/collab/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
    onError: (err: any) => {
      showToast('error', 'Failed to mark as read', err?.response?.data?.message || 'Please try again');
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/collab/notifications/mark-all-read'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      showToast('success', 'All notifications marked as read');
    },
    onError: (err: any) => {
      showToast('error', 'Failed to mark all as read', err?.response?.data?.message || 'Please try again');
    },
  });
}

// ─── Collaboration: Tasks ──────────────────────────────────────────────────

export function useCollaborationTasks(params?: { status?: string; search?: string }) {
  return useQuery<CollaborationTask[]>({
    queryKey: ['collab-tasks', params],
    queryFn: () => api.get('/collab/tasks', params as Record<string, unknown>),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<CollaborationTask, 'status' | 'priority' | 'assignedTo'>> }) =>
      api.patch(`/collab/tasks/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collab-tasks'] });
      showToast('success', 'Task updated', 'The task has been updated successfully');
    },
    onError: (err: any) => {
      showToast('error', 'Failed to update task', err?.response?.data?.message || 'Please try again');
    },
  });
}

export function useGenerateTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/collab/tasks/generate'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collab-tasks'] });
      showToast('success', 'Tasks generated', 'New tasks have been generated successfully');
    },
    onError: (err: any) => {
      showToast('error', 'Failed to generate tasks', err?.response?.data?.message || 'Please try again');
    },
  });
}

export function useEscalateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/collab/tasks/${id}/escalate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collab-tasks'] });
      showToast('success', 'Task escalated', 'The task has been escalated');
    },
    onError: (err: any) => {
      showToast('error', 'Failed to escalate task', err?.response?.data?.message || 'Please try again');
    },
  });
}
