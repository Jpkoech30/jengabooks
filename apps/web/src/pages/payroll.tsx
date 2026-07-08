import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';
import { Skeleton, TableSkeleton } from '../components/ui/skeleton';
import { Toggle } from '../components/ui/toggle';
import { SlideOutPanel } from '../components/ui/slide-out-panel';
import { api } from '../lib/api-client';
import { formatKES } from '../lib/utils';
import { showToast } from '../stores/ui-store';
import { Download, Printer, AlertTriangle, Users, Wallet, Banknote, Receipt } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PayrollRun {
  id: string;
  period: string;          // e.g. "2026-06"
  status: string;          // e.g. "COMPLETED", "DRAFT"
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

// ─── Main Page Component ───────────────────────────────────────────────────

export function Payroll() {
  const [lang, setLang] = useLanguage();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const runsQuery = usePayrollRuns();
  const selectedRunQuery = usePayrollRun(selectedRunId);

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

  // ── Loading state ──
  if (runsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
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
  if (!runsQuery.isLoading && runs.length === 0) {
    return (
      <div className="flex flex-col gap-6">
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
          {/* Language Toggle */}
          <div className="shrink-0">
            <Toggle
              label={lang === 'en' ? 'English' : 'Kiswahili'}
              checked={lang === 'sw'}
              onChange={(c) => setLang(c ? 'sw' : 'en')}
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
