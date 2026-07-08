import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';
import { Skeleton, TableSkeleton } from '../components/ui/skeleton';
import { Toggle } from '../components/ui/toggle';
import { SlideOutPanel } from '../components/ui/slide-out-panel';
import { Input } from '../components/ui/input';
import { Modal } from '../components/ui/modal';
import { api } from '../lib/api-client';
import { formatKES } from '../lib/utils';
import { showToast } from '../stores/ui-store';
import {
  Download,
  Printer,
  AlertTriangle,
  Users,
  Wallet,
  Banknote,
  Receipt,
  Plus,
  Lock,
  FileText,
  Trash2,
  PlayCircle,
  FileSpreadsheet,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PayrollRun {
  id: string;
  period: string;          // e.g. "2026-06"
  status: string;          // e.g. "COMPLETED", "DRAFT", "LOCKED", "FILED"
  totalEmployees: number;
  grossPay: number;
  netPay: number;
  paye: number;
  entries?: PayrollEntry[];
  createdAt: string;
}

interface PayrollEntry {
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

interface PayrollRunsResponse {
  items: PayrollRun[];
  total: number;
}

interface CalculatePayload {
  basicSalary: number;
  housingAllowance: number;
}

interface CalculateResponse {
  paye: number;
  nhif: number;
  nssf: number;
  housingLevy: number;
  grossPay: number;
  netPay: number;
}

// ─── Translations ──────────────────────────────────────────────────────────

type Lang = 'en' | 'sw';

const translations: Record<string, { en: string; sw: string }> = {
  payroll: { en: 'Payroll', sw: 'Malipo ya Wafanyakazi' },
  payslip: { en: 'Payslip', sw: 'Slip ya Mshahara' },
  employee: { en: 'Employee', sw: 'Mfanyakazi' },
  employees: { en: 'Employees', sw: 'Wafanyakazi' },
  grossPay: { en: 'Gross Pay', sw: 'Malipo ya Jumla' },
  netPay: { en: 'Net Pay', sw: 'Malipo Halisi' },
  basicSalary: { en: 'Basic Salary', sw: 'Mshahara wa Msingi' },
  earnings: { en: 'Earnings', sw: 'Mapato' },
  deductions: { en: 'Deductions', sw: 'Makato' },
  paye: { en: 'PAYE', sw: 'Kodi ya Mapato (PAYE)' },
  nhif: { en: 'NHIF', sw: 'Bima ya Afya (NHIF)' },
  nssf: { en: 'NSSF', sw: 'Hifadhi ya Jamii (NSSF)' },
  housingLevy: { en: 'Housing Levy', sw: 'Kodi ya Nyumba' },
  department: { en: 'Department', sw: 'Idara' },
  period: { en: 'Period', sw: 'Kipindi' },
  downloadPdf: { en: 'Download PDF', sw: 'Pakua PDF' },
  total: { en: 'Total', sw: 'Jumla' },
  allowance: { en: 'Allowance', sw: 'Posho' },
  payslipFor: { en: 'Payslip for', sw: 'Slip ya Mshahara ya' },
  selectPeriod: { en: 'Select Period', sw: 'Chagua Kipindi' },
  runYourFirstPayroll: { en: 'Run your first payroll', sw: 'Fanya malipo ya kwanza ya wafanyakazi' },
  noPayrollRunsYet: { en: 'No payroll runs yet', sw: 'Bado hakuna malipo ya wafanyakazi' },
  noPayrollRunsDescription: { en: 'Get started by running payroll for your employees. All computations are KRA-compliant.', sw: 'Anza kwa kufanya malipo ya wafanyakazi wako. Hesabu zote zinafuata sheria za KRA.' },
  startPayroll: { en: 'Start Payroll', sw: 'Anza Malipo' },
  kraPin: { en: 'KRA PIN', sw: 'KRA PIN' },
  missingKraPin: { en: 'Missing KRA PIN', sw: 'Hakuna KRA PIN' },
  noEmployeesInPeriod: { en: 'No employees in this period', sw: 'Hakuna wafanyakazi katika kipindi hiki' },
  noEmployeesDescription: { en: 'There are no payroll entries for the selected period.', sw: 'Hakuna malipo ya wafanyakazi kwa kipindi ulichochagua.' },
  print: { en: 'Print', sw: 'Chapisha' },
  companyName: { en: 'JENGA BOOKS LTD', sw: 'JENGA BOOKS LTD' },
  amount: { en: 'Amount', sw: 'Kiasi' },
  preview: { en: 'Preview', sw: 'Onyesha' },
  calculate: { en: 'Calculate', sw: 'Hesabu' },
  // Run Management translations
  runManagement: { en: 'Run Management', sw: 'Usimamizi wa Malipo' },
  payslips: { en: 'Payslips', sw: 'Slips za Mshahara' },
  payrollRuns: { en: 'Payroll Runs', sw: 'Malipo ya Wafanyakazi' },
  newRun: { en: 'New Run', sw: 'Malipo Mpya' },
  totalRuns: { en: 'Total Runs', sw: 'Jumla ya Malipo' },
  draft: { en: 'Draft', sw: 'Rasimu' },
  locked: { en: 'Locked', sw: 'Imefungwa' },
  filed: { en: 'Filed', sw: 'Imewasilishwa' },
  createPayrollRun: { en: 'Create Payroll Run', sw: 'Unda Malipo Mpya' },
  periodStart: { en: 'Period Start', sw: 'Mwanzo wa Kipindi' },
  periodEnd: { en: 'Period End', sw: 'Mwisho wa Kipindi' },
  cancel: { en: 'Cancel', sw: 'Ghairi' },
  create: { en: 'Create', sw: 'Unda' },
  deleteRun: { en: 'Delete Run', sw: 'Futa Malipo' },
  deleteRunConfirmation: { en: 'Delete run for', sw: 'Futa malipo ya' },
  deleteRunWarning: { en: 'This cannot be undone.', sw: 'Hii haiwezi kutenguliwa.' },
  deleteDisabledLocked: { en: 'Cannot delete a locked run', sw: 'Haiwezi kufuta malipo yaliyofungwa' },
  deleteDisabledFiled: { en: 'Cannot delete a filed run', sw: 'Haiwezi kufuta malipo yaliyowasilishwa' },
  view: { en: 'View', sw: 'Angalia' },
  calculateAll: { en: 'Calculate All', sw: 'Hesabu Zote' },
  lock: { en: 'Lock', sw: 'Funga' },
  prepareFiling: { en: 'Prepare Filing', sw: 'Andaa Uwasilishaji' },
  noRunsYet: { en: 'No payroll runs yet', sw: 'Bado hakuna malipo ya wafanyakazi' },
  noRunsDescription: { en: 'Create your first payroll run to get started.', sw: 'Anza kwa kuunda malipo ya kwanza ya wafanyakazi.' },
  createFirstRun: { en: 'Create First Run', sw: 'Unda Malipo ya Kwanza' },
  deleting: { en: 'Deleting...', sw: 'Inafuta...' },
  creating: { en: 'Creating...', sw: 'Inaunda...' },
};

function t(key: string, lang: Lang): string {
  return translations[key]?.[lang] ?? key;
}

// ─── Bilingual Toggle ──────────────────────────────────────────────────────

const LANG_STORAGE_KEY = 'payslip_lang';

function useLanguage(): [Lang, (lang: Lang) => void] {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return stored === 'sw' ? 'sw' : 'en';
  });

  const updateLang = useCallback((newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem(LANG_STORAGE_KEY, newLang);
  }, []);

  return [lang, updateLang];
}

// ─── API Hooks ─────────────────────────────────────────────────────────────

function usePayrollRuns() {
  return useQuery<PayrollRunsResponse>({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs'),
  });
}

function usePayrollRun(id: string | null) {
  return useQuery<PayrollRun>({
    queryKey: ['payroll-run', id],
    queryFn: () => api.get(`/payroll/runs/${id}`),
    enabled: !!id,
  });
}

function useCalculatePay() {
  return useMutation<CalculateResponse, Error, CalculatePayload>({
    mutationFn: (data) => api.post('/payroll/calculate', data),
  });
}

function useCreatePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation<
    PayrollRun,
    Error,
    { periodStart: string; periodEnd: string }
  >({
    mutationFn: (data) =>
      api.post('/payroll/runs', {
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      showToast('success', 'Payroll Run Created', 'The payroll run has been created successfully.');
    },
    onError: (error) => {
      showToast('error', 'Creation Failed', error.message);
    },
  });
}

function useLockPayrollRun() {
  const queryClient = useQueryClient();
  return useMutation<PayrollRun, Error, string>({
    mutationFn: (id) => api.post(`/payroll/runs/${id}/lock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      showToast('success', 'Run Locked', 'The payroll run has been locked successfully.');
    },
    onError: (error) => {
      showToast('error', 'Lock Failed', error.message);
    },
  });
}

function useCalculateAllPayrollRun() {
  const queryClient = useQueryClient();
  return useMutation<PayrollRun, Error, string>({
    mutationFn: (id) => api.post(`/payroll/runs/${id}/calculate-all`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      showToast('success', 'Calculations Complete', 'All payroll calculations have been completed.');
    },
    onError: (error) => {
      showToast('error', 'Calculation Failed', error.message);
    },
  });
}

function usePrepareFiling() {
  const queryClient = useQueryClient();
  return useMutation<PayrollRun, Error, string>({
    mutationFn: (id) => api.post(`/payroll/runs/${id}/prepare-filing`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      showToast('success', 'Filing Prepared', 'Filing data has been prepared successfully.');
    },
    onError: (error) => {
      showToast('error', 'Filing Preparation Failed', error.message);
    },
  });
}

function useDeletePayrollRun() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => api.delete(`/payroll/runs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
      showToast('success', 'Run Deleted', 'The payroll run has been deleted.');
    },
    onError: (error) => {
      showToast('error', 'Delete Failed', error.message);
    },
  });
}

// ─── KPI Summary Card ──────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  colorClass?: string;
}

function KpiCard({ icon, label, value, subtext, colorClass }: KpiCardProps) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colorClass ?? 'bg-kenya-green-100 text-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300'}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <p className="mt-0.5 text-lg font-bold text-kenya-green-900 dark:text-kenya-green-50 truncate font-mono">
          {value}
        </p>
        {subtext && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtext}</p>
        )}
      </div>
    </Card>
  );
}

function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Payslip Preview ───────────────────────────────────────────────────────

interface PayslipPreviewProps {
  run: PayrollRun;
  entry: PayrollEntry;
  lang: Lang;
}

function PayslipPreview({ run, entry, lang }: PayslipPreviewProps) {
  return (
    <div id="payslip-preview" className="payslip-container">
      {/* Print-only branding header */}
      <div className="payslip-print-header hidden print:block text-center mb-6">
        <div className="border-b-2 border-kenya-green-700 pb-3 mb-3">
          <h2 className="text-xl font-bold text-kenya-green-800 dark:text-kenya-green-200">
            {t('companyName', lang)}
          </h2>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-surface-dark print:border-2 print:border-gray-300 print:shadow-none">
        {/* Company Header */}
        <div className="border-b border-gray-200 pb-4 mb-4 dark:border-gray-700 print:border-gray-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-kenya-green-800 dark:text-kenya-green-200 uppercase tracking-wide">
                {t('companyName', lang)}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('payslipFor', lang)} — {formatPeriod(run.period)}
              </p>
            </div>
            <Badge variant="info" size="sm" className="print:border print:border-gray-400">
              {run.status}
            </Badge>
          </div>
        </div>

        {/* Employee Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-sm">
          <div>
            <span className="block text-xs text-gray-500 dark:text-gray-400">{t('employee', lang)}</span>
            <span className="block font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
              {entry.employeeName}
              {!entry.kraPin && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-kenya-amber-600 dark:text-kenya-amber-400 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {t('missingKraPin', lang)}
                </span>
              )}
            </span>
          </div>
          {entry.kraPin && (
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{t('kraPin', lang)}</span>
              <span className="block font-mono text-sm text-gray-900 dark:text-gray-100 mt-0.5">{entry.kraPin}</span>
            </div>
          )}
          {entry.department && (
            <div>
              <span className="block text-xs text-gray-500 dark:text-gray-400">{t('department', lang)}</span>
              <span className="block text-gray-900 dark:text-gray-100 mt-0.5">{entry.department}</span>
            </div>
          )}
        </div>

        {/* Earnings & Deductions Table */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 print:border-gray-300">
                <th className="py-2 pr-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('earnings', lang)}
                </th>
                <th className="py-2 px-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('amount', lang)}
                </th>
                <th className="py-2 px-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('deductions', lang)}
                </th>
                <th className="py-2 pl-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('amount', lang)}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100 dark:border-gray-800 print:border-gray-200">
                <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">
                  {t('basicSalary', lang)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-gray-900 dark:text-gray-100">
                  {formatKES(entry.basicSalary)}
                </td>
                <td className="py-2.5 px-4 text-gray-900 dark:text-gray-100">
                  {t('paye', lang)}
                </td>
                <td className="py-2.5 pl-4 text-right font-mono text-gray-900 dark:text-gray-100">
                  {formatKES(entry.paye)}
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800 print:border-gray-200">
                <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">
                  {t('allowance', lang)} ({t('housingLevy', lang).split(' ')[0]})
                </td>
                <td className="py-2.5 px-4 text-right font-mono text-gray-900 dark:text-gray-100">
                  {formatKES(entry.housingAllowance)}
                </td>
                <td className="py-2.5 px-4 text-gray-900 dark:text-gray-100">
                  {t('nhif', lang)}
                </td>
                <td className="py-2.5 pl-4 text-right font-mono text-gray-900 dark:text-gray-100">
                  {formatKES(entry.nhif)}
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800 print:border-gray-200">
                <td className="py-2.5 pr-4" />
                <td className="py-2.5 px-4" />
                <td className="py-2.5 px-4 text-gray-900 dark:text-gray-100">
                  {t('nssf', lang)}
                </td>
                <td className="py-2.5 pl-4 text-right font-mono text-gray-900 dark:text-gray-100">
                  {formatKES(entry.nssf)}
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800 print:border-gray-200">
                <td className="py-2.5 pr-4" />
                <td className="py-2.5 px-4" />
                <td className="py-2.5 px-4 text-gray-900 dark:text-gray-100">
                  {t('housingLevy', lang)}
                </td>
                <td className="py-2.5 pl-4 text-right font-mono text-gray-900 dark:text-gray-100">
                  {formatKES(entry.housingLevy)}
                </td>
              </tr>

              {/* Totals */}
              <tr className="bg-kenya-green-50/50 dark:bg-kenya-green-900/10 print:bg-gray-50">
                <td className="py-3 pr-4 font-semibold text-kenya-green-800 dark:text-kenya-green-200">
                  {t('grossPay', lang)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-kenya-green-800 dark:text-kenya-green-200">
                  {formatKES(entry.grossPay)}
                </td>
                <td className="py-3 px-4 font-semibold text-kenya-red-600 dark:text-kenya-red-400">
                  {t('total', lang)} {t('deductions', lang)}
                </td>
                <td className="py-3 pl-4 text-right font-mono font-bold text-kenya-red-600 dark:text-kenya-red-400">
                  {formatKES(entry.paye + entry.nhif + entry.nssf + entry.housingLevy)}
                </td>
              </tr>
              <tr className="bg-kenya-green-100/50 dark:bg-kenya-green-900/20 print:bg-gray-100">
                <td colSpan={2} className="py-3 pr-4">
                  <span className="text-base font-bold text-kenya-green-800 dark:text-kenya-green-200">
                    {t('netPay', lang)}
                  </span>
                </td>
                <td colSpan={2} className="py-3 pl-4 text-right">
                  <span className="text-lg font-bold font-mono text-kenya-green-700 dark:text-kenya-green-300">
                    {formatKES(entry.netPay)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Action buttons — hidden when printing */}
        {entry.kraPin && (
          <div className="mt-4 flex items-center gap-2 print:hidden">
            <Badge variant="success" size="sm">
              ✓ KRA PIN {entry.kraPin}
            </Badge>
          </div>
        )}
      </div>

      {/* Print-only footer */}
      <div className="payslip-print-footer hidden print:block text-center mt-6 text-xs text-gray-400">
        <p className="border-t border-gray-300 pt-3">
          Generated by JengaBooks — {new Date().toLocaleDateString('en-KE')}
        </p>
      </div>
    </div>
  );
}

function PayslipPreviewSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatPeriod(period: string): string {
  // Convert "2026-06" to "June 2026"
  const parts = period.split('-');
  if (parts.length < 2) return period;
  const yearStr = parts[0] as string;
  const monthStr = parts[1] as string;
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const date = new Date(year, month);
  return date.toLocaleDateString('en-KE', { year: 'numeric', month: 'long' });
}

function periodOptions(runs: PayrollRun[]): Array<{ value: string; label: string }> {
  return runs.map((r) => ({
    value: r.id,
    label: formatPeriod(r.period),
  }));
}

function getNextMonthDate(day: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  // Next month
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  // Ensure the day is valid for the target month
  const lastDayOfMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
  const safeDay = Math.min(day, lastDayOfMonth);
  const result = new Date(nextYear, nextMonth, safeDay);
  return result.toISOString().split('T')[0] as string;
}

function getRunStatusBadgeVariant(status: string): 'warning' | 'info' | 'success' | 'neutral' {
  switch (status) {
    case 'DRAFT':
      return 'warning';
    case 'LOCKED':
      return 'info';
    case 'FILED':
      return 'success';
    default:
      return 'neutral';
  }
}

function getStatusLabel(status: string, lang: Lang): string {
  switch (status) {
    case 'DRAFT':
      return t('draft', lang);
    case 'LOCKED':
      return t('locked', lang);
    case 'FILED':
      return t('filed', lang);
    default:
      return status;
  }
}

// ─── Stats Card for Run Management ─────────────────────────────────────────

interface RunStatCardProps {
  label: string;
  value: number;
  colorClass: string;
}

function RunStatCard({ label, value, colorClass }: RunStatCardProps) {
  return (
    <Card className={`flex flex-col items-center justify-center p-4 text-center ${colorClass}`}>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-mono">{value}</p>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">
        {label}
      </p>
    </Card>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────

export function Payroll() {
  const [lang, setLang] = useLanguage();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'payslips' | 'runs'>('payslips');

  // Run Management state
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PayrollRun | null>(null);
  const [calculatingRunId, setCalculatingRunId] = useState<string | null>(null);

  const runsQuery = usePayrollRuns();
  const selectedRunQuery = usePayrollRun(selectedRunId);

  // Mutations
  const createRunMutation = useCreatePayrollRun();
  const lockRunMutation = useLockPayrollRun();
  const calculateAllMutation = useCalculateAllPayrollRun();
  const prepareFilingMutation = usePrepareFiling();
  const deleteRunMutation = useDeletePayrollRun();

  const runs = runsQuery.data?.items ?? [];
  const selectedRun = selectedRunQuery.data ?? null;
  const entries = selectedRun?.entries ?? [];

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) ?? entries[0] ?? null;

  // Auto-select first run when data loads
  useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      const firstRun = runs[0];
      if (firstRun) setSelectedRunId(firstRun.id);
    }
  }, [runs, selectedRunId]);

  // Auto-select first entry when run data loads
  useEffect(() => {
    if (entries.length > 0 && !selectedEntryId) {
      const firstEntry = entries[0];
      if (firstEntry) setSelectedEntryId(firstEntry.id);
    } else if (entries.length > 0 && selectedEntryId && !entries.find((e) => e.id === selectedEntryId)) {
      const firstEntry = entries[0];
      if (firstEntry) setSelectedEntryId(firstEntry.id);
    }
  }, [entries, selectedEntryId]);

  // Initialize period defaults when create panel opens
  useEffect(() => {
    if (createPanelOpen) {
      setPeriodStart(getNextMonthDate(1));
      setPeriodEnd(getNextMonthDate(0)); // Last day of next month
    }
  }, [createPanelOpen]);

  // Compute run stats
  const totalRuns = runs.length;
  const draftRuns = runs.filter((r) => r.status === 'DRAFT').length;
  const lockedRuns = runs.filter((r) => r.status === 'LOCKED').length;
  const filedRuns = runs.filter((r) => r.status === 'FILED').length;

  // ── KPI summaries from the selected run ──
  const kpiData = selectedRun
    ? [
        {
          icon: <Users className="h-5 w-5" />,
          label: t('employees', lang),
          value: String(selectedRun.totalEmployees),
          subtext: undefined,
          colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        },
        {
          icon: <Wallet className="h-5 w-5" />,
          label: t('grossPay', lang),
          value: formatKES(selectedRun.grossPay),
          subtext: undefined,
          colorClass: 'bg-kenya-green-100 text-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300',
        },
        {
          icon: <Banknote className="h-5 w-5" />,
          label: t('netPay', lang),
          value: formatKES(selectedRun.netPay),
          subtext: undefined,
          colorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        },
        {
          icon: <Receipt className="h-5 w-5" />,
          label: t('paye', lang),
          value: formatKES(selectedRun.paye),
          subtext: undefined,
          colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        },
      ]
    : [];

  const handleRunChange = (value: string) => {
    setSelectedRunId(value);
    setSelectedEntryId(null);
  };

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = useCallback(() => {
    // Trigger print dialog; user can "Save as PDF"
    window.print();
  }, []);

  const handleViewEmployeeDetail = (entry: PayrollEntry) => {
    setSelectedEntryId(entry.id);
    setPanelOpen(true);
  };

  // ── Run Management handlers ──

  const handleCreateRun = () => {
    if (!periodStart || !periodEnd) {
      showToast('warning', 'Validation Error', 'Please provide both period start and end dates.');
      return;
    }
    if (new Date(periodStart) >= new Date(periodEnd)) {
      showToast('warning', 'Validation Error', 'Period start must be before period end.');
      return;
    }
    createRunMutation.mutate(
      { periodStart, periodEnd },
      {
        onSuccess: (newRun) => {
          setCreatePanelOpen(false);
          // Auto-calculate all after creation
          calculateAllMutation.mutate(newRun.id);
        },
      },
    );
  };

  const handleLockRun = (runId: string) => {
    lockRunMutation.mutate(runId);
  };

  const handleCalculateAll = async (runId: string) => {
    setCalculatingRunId(runId);
    calculateAllMutation.mutate(runId, {
      onSettled: () => setCalculatingRunId(null),
    });
  };

  const handlePrepareFiling = (runId: string) => {
    prepareFilingMutation.mutate(runId);
  };

  const handleDeleteRun = () => {
    if (!deleteTarget) return;
    deleteRunMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  };

  const handleOpenCreatePanel = () => {
    setCreatePanelOpen(true);
  };

  // ── Determine action buttons for a run based on status ──

  const renderRunActions = (run: PayrollRun) => {
    const isDraft = run.status === 'DRAFT';
    const isLocked = run.status === 'LOCKED';
    const isFiled = run.status === 'FILED';
    const isCalculating = calculatingRunId === run.id;

    const actions: React.ReactNode[] = [];

    if (isDraft) {
      actions.push(
        <Button
          key="lock"
          variant="ghost"
          size="sm"
          onClick={() => handleLockRun(run.id)}
          disabled={lockRunMutation.isPending}
          leftIcon={<Lock className="h-4 w-4" />}
          title={t('lock', lang)}
          className="min-w-[36px] px-2"
        >
          🔒
        </Button>,
      );
      actions.push(
        <Button
          key="calculate"
          variant="ghost"
          size="sm"
          onClick={() => handleCalculateAll(run.id)}
          disabled={isCalculating}
          leftIcon={
            isCalculating ? (
              <PlayCircle className="h-4 w-4 animate-pulse" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )
          }
          title={t('calculateAll', lang)}
          className="min-w-[36px] px-2"
        >
          📄
        </Button>,
      );
      actions.push(
        <Button
          key="delete"
          variant="ghost"
          size="sm"
          onClick={() => setDeleteTarget(run)}
          disabled={deleteRunMutation.isPending}
          leftIcon={<Trash2 className="h-4 w-4 text-red-500" />}
          title={t('deleteRun', lang)}
          className="min-w-[36px] px-2"
        >
          🗑️
        </Button>,
      );
    } else if (isLocked) {
      actions.push(
        <Button
          key="view"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedRunId(run.id);
            setActiveTab('payslips');
          }}
          leftIcon={<FileText className="h-4 w-4" />}
          title={t('view', lang)}
          className="min-w-[36px] px-2"
        >
          📄
        </Button>,
      );
      actions.push(
        <Button
          key="file"
          variant="ghost"
          size="sm"
          onClick={() => handlePrepareFiling(run.id)}
          disabled={prepareFilingMutation.isPending}
          leftIcon={<FileSpreadsheet className="h-4 w-4" />}
          title={t('prepareFiling', lang)}
          className="min-w-[36px] px-2"
        >
          📄
        </Button>,
      );
      actions.push(
        <Button
          key="delete-disabled"
          variant="ghost"
          size="sm"
          disabled
          leftIcon={<Trash2 className="h-4 w-4 text-gray-300" />}
          title={t('deleteDisabledLocked', lang)}
          className="min-w-[36px] px-2 cursor-not-allowed"
        >
          🗑️
        </Button>,
      );
    } else if (isFiled) {
      actions.push(
        <Button
          key="view"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedRunId(run.id);
            setActiveTab('payslips');
          }}
          leftIcon={<FileText className="h-4 w-4" />}
          title={t('view', lang)}
          className="min-w-[36px] px-2"
        >
          📄
        </Button>,
      );
      actions.push(
        <Button
          key="delete-disabled"
          variant="ghost"
          size="sm"
          disabled
          leftIcon={<Trash2 className="h-4 w-4 text-gray-300" />}
          title={t('deleteDisabledFiled', lang)}
          className="min-w-[36px] px-2 cursor-not-allowed"
        >
          🗑️
        </Button>,
      );
    }

    return <div className="flex items-center gap-1">{actions}</div>;
  };

  // ── Run Management View ──

  const renderRunManagement = () => {
    // Loading state
    if (runsQuery.isLoading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-kenya-green-900 dark:text-kenya-green-50">
            {t('payrollRuns', lang)}
          </h2>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={handleOpenCreatePanel}
          >
            {t('newRun', lang)}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RunStatCard
            label={t('totalRuns', lang)}
            value={totalRuns}
            colorClass="bg-gray-50 dark:bg-gray-800/50"
          />
          <RunStatCard
            label={t('draft', lang)}
            value={draftRuns}
            colorClass="bg-amber-50 dark:bg-amber-900/10"
          />
          <RunStatCard
            label={t('locked', lang)}
            value={lockedRuns}
            colorClass="bg-blue-50 dark:bg-blue-900/10"
          />
          <RunStatCard
            label={t('filed', lang)}
            value={filedRuns}
            colorClass="bg-emerald-50 dark:bg-emerald-900/10"
          />
        </div>

        {/* Run Table or Empty State */}
        {runs.length === 0 ? (
          <EmptyState
            icon="📋"
            title={t('noRunsYet', lang)}
            description={t('noRunsDescription', lang)}
            action={{ label: t('createFirstRun', lang), onClick: handleOpenCreatePanel }}
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('period', lang)}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('grossPay', lang)}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('netPay', lang)}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('paye', lang)}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('total', lang)}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('employees', lang)}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('preview', lang)}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">
                        {formatPeriod(run.period)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-gray-900 dark:text-gray-100">
                        {formatKES(run.grossPay)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-gray-900 dark:text-gray-100">
                        {formatKES(run.netPay)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-gray-900 dark:text-gray-100">
                        {formatKES(run.paye)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <Badge variant={getRunStatusBadgeVariant(run.status)} size="sm">
                          {getStatusLabel(run.status, lang)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-gray-900 dark:text-gray-100">
                        {run.totalEmployees}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {renderRunActions(run)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  };

  // ── Loading state ──
  if (runsQuery.isLoading && activeTab === 'payslips') {
    return (
      <div className="flex flex-col gap-6">
        {/* Tab Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={() => setActiveTab('payslips')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'payslips'
                  ? 'bg-white dark:bg-gray-700 text-kenya-green-700 dark:text-kenya-green-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {t('payslips', lang)}
            </button>
            <button
              onClick={() => setActiveTab('runs')}
              className="rounded-md px-4 py-2 text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              {t('runManagement', lang)}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-40 rounded-lg" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
        <KpiCardsSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-2">
            <PayslipPreviewSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state: No payroll runs ──
  if (!runsQuery.isLoading && runs.length === 0 && activeTab === 'payslips') {
    return (
      <div className="flex flex-col gap-6">
        {/* Tab Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800/50">
            <button
              onClick={() => setActiveTab('payslips')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'payslips'
                  ? 'bg-white dark:bg-gray-700 text-kenya-green-700 dark:text-kenya-green-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {t('payslips', lang)}
            </button>
            <button
              onClick={() => setActiveTab('runs')}
              className="rounded-md px-4 py-2 text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            >
              {t('runManagement', lang)}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">
              {t('payroll', lang)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('payslip', lang)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Toggle
              label={lang === 'en' ? 'English' : 'Kiswahili'}
              checked={lang === 'sw'}
              onChange={(c) => setLang(c ? 'sw' : 'en')}
            />
          </div>
        </div>
        <EmptyState
          icon="📋"
          title={t('noPayrollRunsYet', lang)}
          description={t('noPayrollRunsDescription', lang)}
          action={{ label: t('startPayroll', lang), onClick: () => showToast('info', 'Payroll wizard', 'Coming soon — run payroll from this page') }}
          helpLink={{ label: 'Learn about payroll', href: '/help' }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Tab Navigation ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={() => setActiveTab('payslips')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'payslips'
                ? 'bg-white dark:bg-gray-700 text-kenya-green-700 dark:text-kenya-green-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('payslips', lang)}
          </button>
          <button
            onClick={() => setActiveTab('runs')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'runs'
                ? 'bg-white dark:bg-gray-700 text-kenya-green-700 dark:text-kenya-green-300 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('runManagement', lang)}
          </button>
        </div>
        {activeTab === 'payslips' && (
          <div className="flex items-center gap-3">
            <Toggle
              label={lang === 'en' ? 'English' : 'Kiswahili'}
              checked={lang === 'sw'}
              onChange={(c) => setLang(c ? 'sw' : 'en')}
            />
          </div>
        )}
      </div>

      {/* ── Payslips Tab Content ── */}
      {activeTab === 'payslips' && (
        <>
          {/* ── Header ── */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">
                {t('payroll', lang)}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {t('payslip', lang)} — {selectedRun ? formatPeriod(selectedRun.period) : ''}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Period Selector */}
              <div className="w-48">
                <Select
                  options={periodOptions(runs)}
                  value={selectedRunId ?? ''}
                  onChange={(e) => handleRunChange(e.target.value)}
                  placeholder={t('selectPeriod', lang)}
                />
              </div>
            </div>
          </div>

          {/* ── KPI Summary Cards ── */}
          {selectedRunQuery.isLoading ? (
            <KpiCardsSkeleton />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpiData.map((kpi, idx) => (
                <KpiCard key={idx} {...kpi} />
              ))}
            </div>
          )}

          {/* ── Main Content: Employee List + Payslip Preview ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Employee List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>{t('employees', lang)}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {selectedRunQuery.isLoading ? (
                    <div className="p-4">
                      <TableSkeleton rows={4} />
                    </div>
                  ) : entries.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className="text-2xl mb-2">📭</p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {t('noEmployeesInPeriod', lang)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {t('noEmployeesDescription', lang)}
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800" role="listbox" aria-label={t('employees', lang)}>
                      {entries.map((entry) => (
                        <li key={entry.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedEntryId === entry.id}
                            onClick={() => handleViewEmployeeDetail(entry)}
                            className={`touch-target w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                              selectedEntryId === entry.id
                                ? 'bg-kenya-green-50 dark:bg-kenya-green-900/10 border-l-2 border-kenya-green-500'
                                : 'border-l-2 border-transparent'
                            }`}
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kenya-green-100 text-sm font-bold text-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300">
                              {entry.employeeName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                  {entry.employeeName}
                                </p>
                                {!entry.kraPin && (
                                  <span title={t('missingKraPin', lang)}>
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-kenya-amber-500" />
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('netPay', lang)}: {formatKES(entry.netPay)}
                              </p>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                              {entry.department ?? '—'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Payslip Preview */}
            <div className="lg:col-span-2" ref={printRef}>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>{t('payslip', lang)} — {selectedRun ? formatPeriod(selectedRun.period) : ''}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* PAYE Calculator indicator */}
                    {selectedEntry && !selectedEntry.kraPin && (
                      <Badge variant="warning" size="sm" className="print:hidden">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {t('missingKraPin', lang)}
                      </Badge>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Printer className="h-4 w-4" />}
                      onClick={handlePrint}
                      className="print:hidden"
                    >
                      {t('print', lang)}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Download className="h-4 w-4" />}
                      onClick={handleDownloadPdf}
                      className="print:hidden"
                    >
                      {t('downloadPdf', lang)}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedRunQuery.isLoading ? (
                    <PayslipPreviewSkeleton />
                  ) : !selectedEntry ? (
                    <div className="py-10 text-center">
                      <p className="text-3xl mb-2">📭</p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {t('noEmployeesInPeriod', lang)}
                      </p>
                    </div>
                  ) : selectedRun && selectedEntry ? (
                    <PayslipPreview
                      run={selectedRun}
                      entry={selectedEntry}
                      lang={lang}
                    />
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Employee Detail Slide-Out Panel ── */}
          <SlideOutPanel
            isOpen={!!selectedEntry && panelOpen}
            onClose={() => setPanelOpen(false)}
            title={selectedEntry?.employeeName ?? ''}
            subtitle={`${t('payslip', lang)} — ${selectedRun ? formatPeriod(selectedRun.period) : ''}`}
            footer={
              <div className="flex gap-3">
                <Button variant="secondary" size="md" className="flex-1" onClick={() => setPanelOpen(false)}>
                  {t('print', lang)}
                </Button>
                <Button variant="primary" size="md" className="flex-1" onClick={handleDownloadPdf}>
                  {t('downloadPdf', lang)}
                </Button>
              </div>
            }
          >
            {selectedEntry && selectedRun && (
              <div className="space-y-4">
                {/* Employee Info */}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('employee', lang)}</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedEntry.employeeName}</p>
                  </div>
                  {selectedEntry.kraPin ? (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('kraPin', lang)}</p>
                      <p className="font-mono text-gray-900 dark:text-gray-100">{selectedEntry.kraPin}</p>
                    </div>
                  ) : (
                    <Badge variant="warning">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {t('missingKraPin', lang)}
                    </Badge>
                  )}
                  {selectedEntry.department && (
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('department', lang)}</p>
                      <p className="text-gray-900 dark:text-gray-100">{selectedEntry.department}</p>
                    </div>
                  )}
                </div>

                <hr className="border-gray-200 dark:border-gray-700" />

                {/* Earnings Breakdown */}
                <div>
                  <h4 className="text-sm font-semibold text-kenya-green-800 dark:text-kenya-green-200 mb-2">
                    {t('earnings', lang)}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('basicSalary', lang)}</span>
                      <span className="font-mono font-medium">{formatKES(selectedEntry.basicSalary)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('allowance', lang)}</span>
                      <span className="font-mono font-medium">{formatKES(selectedEntry.housingAllowance)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t border-gray-200 dark:border-gray-700 pt-2">
                      <span className="text-kenya-green-700 dark:text-kenya-green-300">{t('grossPay', lang)}</span>
                      <span className="font-mono text-kenya-green-700 dark:text-kenya-green-300">{formatKES(selectedEntry.grossPay)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions Breakdown */}
                <div>
                  <h4 className="text-sm font-semibold text-kenya-red-600 dark:text-kenya-red-400 mb-2">
                    {t('deductions', lang)}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('paye', lang)}</span>
                      <span className="font-mono">{formatKES(selectedEntry.paye)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('nhif', lang)}</span>
                      <span className="font-mono">{formatKES(selectedEntry.nhif)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('nssf', lang)}</span>
                      <span className="font-mono">{formatKES(selectedEntry.nssf)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{t('housingLevy', lang)}</span>
                      <span className="font-mono">{formatKES(selectedEntry.housingLevy)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t border-gray-200 dark:border-gray-700 pt-2">
                      <span className="text-kenya-red-600 dark:text-kenya-red-400">{t('total', lang)}</span>
                      <span className="font-mono text-kenya-red-600 dark:text-kenya-red-400">
                        {formatKES(selectedEntry.paye + selectedEntry.nhif + selectedEntry.nssf + selectedEntry.housingLevy)}
                      </span>
                    </div>
                  </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-700" />

                {/* Net Pay */}
                <div className="flex justify-between items-center bg-kenya-green-50 dark:bg-kenya-green-900/10 rounded-lg p-4">
                  <span className="text-base font-bold text-kenya-green-800 dark:text-kenya-green-200">
                    {t('netPay', lang)}
                  </span>
                  <span className="text-xl font-bold font-mono text-kenya-green-700 dark:text-kenya-green-300">
                    {formatKES(selectedEntry.netPay)}
                  </span>
                </div>
              </div>
            )}
          </SlideOutPanel>
        </>
      )}

      {/* ── Run Management Tab Content ── */}
      {activeTab === 'runs' && renderRunManagement()}

      {/* ── Create New Run SlideOutPanel ── */}
      <SlideOutPanel
        isOpen={createPanelOpen}
        onClose={() => setCreatePanelOpen(false)}
        title={t('createPayrollRun', lang)}
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() => setCreatePanelOpen(false)}
            >
              {t('cancel', lang)}
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={handleCreateRun}
              isLoading={createRunMutation.isPending}
            >
              {createRunMutation.isPending ? t('creating', lang) : t('create', lang)}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <Input
            label={t('periodStart', lang)}
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
          />
          <Input
            label={t('periodEnd', lang)}
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            After creation, calculations will run automatically.
          </p>
        </div>
      </SlideOutPanel>

      {/* ── Delete Confirmation Modal ── */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t('deleteRun', lang)}
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
            >
              {t('cancel', lang)}
            </Button>
            <Button
              variant="destructive"
              size="md"
              className="flex-1"
              onClick={handleDeleteRun}
              isLoading={deleteRunMutation.isPending}
            >
              {deleteRunMutation.isPending ? t('deleting', lang) : t('deleteRun', lang)}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            {t('deleteRunConfirmation', lang)}{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {deleteTarget ? formatPeriod(deleteTarget.period) : ''}
            </span>
            ?
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            {t('deleteRunWarning', lang)}
          </p>
        </div>
      </Modal>

      {/* ── Print Stylesheet ── */}
      <style>{`
        @media print {
          /* Hide everything except the payslip preview */
          body * {
            visibility: hidden;
          }
          #payslip-preview,
          #payslip-preview * {
            visibility: visible;
          }
          #payslip-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            padding: 0.5in;
          }
          .payslip-print-header {
            display: block !important;
          }
          .payslip-print-footer {
            display: block !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            margin: 0.5in;
            size: A4 portrait;
          }
        }
      `}</style>
    </div>
  );
}
