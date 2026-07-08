import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Modal } from '../components/ui/modal';
import { SlideOutPanel } from '../components/ui/slide-out-panel';
import { PageShell } from '../components/layout/page-shell';
import { Table } from '../components/ui/table';
import { EmptyState } from '../components/ui/empty-state';
import { Skeleton, TableSkeleton } from '../components/ui/skeleton';
import { api } from '../lib/api-client';
import { formatKES, formatDate } from '../lib/utils';
import { useAuthStore } from '../stores/auth-store';
import { showToast } from '../stores/ui-store';
import { Plus, Search, X, UserPlus, AlertTriangle, Users, FileText, Clock } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

type EmployeeStatus = 'ACTIVE' | 'TERMINATED' | 'SUSPENDED';
type EmployeeType = 'PERMANENT' | 'CONTRACT' | 'CASUAL' | 'DIRECTOR';
type TaxTreatment = 'STANDARD' | 'SHORT_HOURS' | 'SECONDARY_EMPLOYMENT';

interface BenefitRow {
  name: string;
  amount: number;
  taxable: boolean;
}

interface DeductionRow {
  name: string;
  amount: number;
}

interface SalaryStructure {
  id?: string;
  basicPay: number;
  housingLevyOverride?: number | null;
  benefits: BenefitRow[];
  deductions: DeductionRow[];
}

interface Employee {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  kraPin?: string | null;
  nationalId?: string | null;
  nhifNumber?: string | null;
  nssfNumber?: string | null;
  employeeType: EmployeeType;
  taxTreatment: TaxTreatment;
  hireDate: string;
  status: EmployeeStatus;
  terminationDate?: string | null;
  terminationReason?: string | null;
  salaryStructure?: SalaryStructure | null;
  createdAt: string;
  updatedAt: string;
}

interface EmployeeFormData {
  name: string;
  email: string;
  phone: string;
  kraPin: string;
  nationalId: string;
  nhifNumber: string;
  nssfNumber: string;
  employeeType: EmployeeType;
  taxTreatment: TaxTreatment;
  hireDate: string;
  basicPay: string;
  housingLevyOverride: string;
  benefits: BenefitRow[];
  deductions: DeductionRow[];
}

interface EmployeesResponse {
  items: Employee[];
  total: number;
}

interface TerminatePayload {
  terminationDate: string;
  terminationReason: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const EMPLOYEE_TYPE_OPTIONS = [
  { value: 'PERMANENT', label: 'Permanent' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'CASUAL', label: 'Casual' },
  { value: 'DIRECTOR', label: 'Director' },
];

const TAX_TREATMENT_OPTIONS = [
  { value: 'STANDARD', label: 'Standard' },
  { value: 'SHORT_HOURS', label: 'Short Hours' },
  { value: 'SECONDARY_EMPLOYMENT', label: 'Secondary Employment' },
];

const EMPTY_FORM: EmployeeFormData = {
  name: '',
  email: '',
  phone: '',
  kraPin: '',
  nationalId: '',
  nhifNumber: '',
  nssfNumber: '',
  employeeType: 'PERMANENT',
  taxTreatment: 'STANDARD',
  hireDate: '',
  basicPay: '',
  housingLevyOverride: '',
  benefits: [],
  deductions: [],
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function getStatusBadgeVariant(status: EmployeeStatus): 'success' | 'error' | 'warning' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'TERMINATED': return 'error';
    case 'SUSPENDED': return 'warning';
  }
}

function getStatusLabel(status: EmployeeStatus): string {
  switch (status) {
    case 'ACTIVE': return 'Active';
    case 'TERMINATED': return 'Terminated';
    case 'SUSPENDED': return 'Suspended';
  }
}

function getEmployeeTypeLabel(type: EmployeeType): string {
  const map: Record<EmployeeType, string> = {
    PERMANENT: 'Perm',
    CONTRACT: 'Contr',
    CASUAL: 'Casual',
    DIRECTOR: 'Director',
  };
  return map[type];
}

function getBasicPay(employee: Employee): number {
  return employee.salaryStructure?.basicPay ?? 0;
}

function computeStats(employees: Employee[]) {
  return {
    active: employees.filter((e) => e.status === 'ACTIVE').length,
    contract: employees.filter((e) => e.employeeType === 'CONTRACT').length,
    terminated: employees.filter((e) => e.status === 'TERMINATED').length,
    total: employees.length,
  };
}

// ─── API Hooks ─────────────────────────────────────────────────────────────

function useEmployees(companyId: string | undefined) {
  return useQuery<EmployeesResponse>({
    queryKey: ['employees', companyId],
    queryFn: () => api.get('/payroll/employees', { companyId }),
    enabled: !!companyId,
  });
}

function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { companyId: string; data: Record<string, unknown> }>({
    mutationFn: ({ companyId, data }) => api.post('/payroll/employees', { companyId, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      showToast('success', 'Employee Added', 'The employee has been created successfully.');
    },
    onError: (err: any) => {
      showToast('error', 'Failed to Add Employee', err?.response?.data?.message || 'Please check your input and try again.');
    },
  });
}

function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) => api.patch(`/payroll/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      showToast('success', 'Employee Updated', 'The employee record has been updated.');
    },
    onError: (err: any) => {
      showToast('error', 'Failed to Update Employee', err?.response?.data?.message || 'Please try again.');
    },
  });
}

function useTerminateEmployee() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; data: TerminatePayload }>({
    mutationFn: ({ id, data }) => api.patch(`/payroll/employees/${id}/terminate`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      showToast('success', 'Employee Terminated', 'Payroll will stop for this employee.');
    },
    onError: (err: any) => {
      showToast('error', 'Failed to Terminate Employee', err?.response?.data?.message || 'Please try again.');
    },
  });
}

// ─── KPI Summary Cards ────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
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

// ─── Employee Form ────────────────────────────────────────────────────────

interface EmployeeFormProps {
  formData: EmployeeFormData;
  onChange: (data: EmployeeFormData) => void;
  errors: Record<string, string>;
}

function EmployeeForm({ formData, onChange, errors }: EmployeeFormProps) {
  const update = useCallback(
    <K extends keyof EmployeeFormData>(field: K, value: EmployeeFormData[K]) => {
      onChange({ ...formData, [field]: value });
    },
    [formData, onChange],
  );

  const addBenefit = useCallback(() => {
    update('benefits', [...formData.benefits, { name: '', amount: 0, taxable: true }]);
  }, [formData, update]);

  const removeBenefit = useCallback(
    (index: number) => {
      const next = formData.benefits.filter((_, i) => i !== index);
      update('benefits', next);
    },
    [formData, update],
  );

  const updateBenefit = useCallback(
    (index: number, field: keyof BenefitRow, value: string | number | boolean) => {
      const next = formData.benefits.map((b, i) =>
        i === index ? { ...b, [field]: value } : b,
      );
      update('benefits', next);
    },
    [formData, update],
  );

  const addDeduction = useCallback(() => {
    update('deductions', [...formData.deductions, { name: '', amount: 0 }]);
  }, [formData, update]);

  const removeDeduction = useCallback(
    (index: number) => {
      const next = formData.deductions.filter((_, i) => i !== index);
      update('deductions', next);
    },
    [formData, update],
  );

  const updateDeduction = useCallback(
    (index: number, field: keyof DeductionRow, value: string | number) => {
      const next = formData.deductions.map((d, i) =>
        i === index ? { ...d, [field]: value } : d,
      );
      update('deductions', next);
    },
    [formData, update],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Personal Information */}
      <div>
        <h4 className="text-sm font-semibold text-kenya-green-800 dark:text-kenya-green-200 mb-3 uppercase tracking-wider">
          Personal Information
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Full Name *"
            placeholder="e.g., John Kamau"
            value={formData.name}
            onChange={(e) => update('name', e.target.value)}
            error={errors.name}
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="john@company.co.ke"
            value={formData.email}
            onChange={(e) => update('email', e.target.value)}
            error={errors.email}
          />
          <Input
            label="Phone"
            placeholder="+254 712 345 678"
            value={formData.phone}
            onChange={(e) => update('phone', e.target.value)}
            error={errors.phone}
          />
          <Input
            label="KRA PIN *"
            placeholder="P051234567Z"
            maxLength={11}
            className="uppercase"
            value={formData.kraPin}
            onChange={(e) => update('kraPin', e.target.value.toUpperCase())}
            error={errors.kraPin}
            helperText="11 characters, uppercase"
            required
          />
          <Input
            label="National ID"
            placeholder="e.g., 12345678"
            value={formData.nationalId}
            onChange={(e) => update('nationalId', e.target.value)}
            error={errors.nationalId}
          />
          <Input
            label="NHIF Number"
            placeholder="e.g., NHIF/12345"
            value={formData.nhifNumber}
            onChange={(e) => update('nhifNumber', e.target.value)}
            error={errors.nhifNumber}
          />
          <Input
            label="NSSF Number"
            placeholder="e.g., NSSF/12345"
            value={formData.nssfNumber}
            onChange={(e) => update('nssfNumber', e.target.value)}
            error={errors.nssfNumber}
          />
        </div>
      </div>

      {/* Employment Details */}
      <div>
        <h4 className="text-sm font-semibold text-kenya-green-800 dark:text-kenya-green-200 mb-3 uppercase tracking-wider">
          Employment Details
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Employee Type *"
            options={EMPLOYEE_TYPE_OPTIONS}
            value={formData.employeeType}
            onChange={(e) => update('employeeType', e.target.value as EmployeeType)}
            error={errors.employeeType}
          />
          <Select
            label="Tax Treatment *"
            options={TAX_TREATMENT_OPTIONS}
            value={formData.taxTreatment}
            onChange={(e) => update('taxTreatment', e.target.value as TaxTreatment)}
            error={errors.taxTreatment}
          />
          <Input
            label="Hire Date *"
            type="date"
            value={formData.hireDate}
            onChange={(e) => update('hireDate', e.target.value)}
            error={errors.hireDate}
            required
          />
        </div>
      </div>

      {/* Salary Structure */}
      <div>
        <h4 className="text-sm font-semibold text-kenya-green-800 dark:text-kenya-green-200 mb-3 uppercase tracking-wider">
          Salary Structure
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Basic Pay (KES) *"
            type="number"
            placeholder="e.g., 150000"
            value={formData.basicPay}
            onChange={(e) => update('basicPay', e.target.value)}
            error={errors.basicPay}
            required
          />
          <Input
            label="Housing Levy Override (KES)"
            type="number"
            placeholder="Leave blank for auto-calc"
            value={formData.housingLevyOverride}
            onChange={(e) => update('housingLevyOverride', e.target.value)}
            error={errors.housingLevyOverride}
            helperText="Manual override for housing levy"
          />
        </div>

        {/* Benefits */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Benefits</label>
            <Button type="button" variant="ghost" size="sm" onClick={addBenefit}>
              + Add Benefit
            </Button>
          </div>
          {formData.benefits.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">No benefits added yet.</p>
          )}
          <div className="space-y-2">
            {formData.benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="Benefit name"
                    value={benefit.name}
                    onChange={(e) => updateBenefit(index, 'name', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={benefit.amount || ''}
                    onChange={(e) => updateBenefit(index, 'amount', parseFloat(e.target.value) || 0)}
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                    <input
                      type="checkbox"
                      checked={benefit.taxable}
                      onChange={(e) => updateBenefit(index, 'taxable', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-kenya-green-600 focus:ring-kenya-green-500"
                    />
                    Taxable
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeBenefit(index)}
                  className="mt-1 shrink-0 rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  aria-label="Remove benefit"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Deductions */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Deductions</label>
            <Button type="button" variant="ghost" size="sm" onClick={addDeduction}>
              + Add Deduction
            </Button>
          </div>
          {formData.deductions.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">No deductions added yet.</p>
          )}
          <div className="space-y-2">
            {formData.deductions.map((deduction, index) => (
              <div key={index} className="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Deduction name"
                    value={deduction.name}
                    onChange={(e) => updateDeduction(index, 'name', e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={deduction.amount || ''}
                    onChange={(e) => updateDeduction(index, 'amount', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeDeduction(index)}
                  className="mt-1 shrink-0 rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  aria-label="Remove deduction"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────

export function Employees() {
  const companyId = useAuthStore((state) => state.user?.companyId);
  const queryClient = useQueryClient();

  // Data
  const { data, isLoading, isError, refetch } = useEmployees(companyId ?? undefined);
  const employees = data?.items ?? [];

  // Mutations
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const terminateMutation = useTerminateEmployee();

  // UI state
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Terminate state
  const [terminatingEmployee, setTerminatingEmployee] = useState<Employee | null>(null);
  const [terminationDate, setTerminationDate] = useState('');
  const [terminationReason, setTerminationReason] = useState('');
  const [isTerminating, setIsTerminating] = useState(false);

  // Details panel
  const [detailsEmployee, setDetailsEmployee] = useState<Employee | null>(null);

  // Stats
  const stats = useMemo(() => computeStats(employees), [employees]);

  // Filter & sort employees
  const filteredEmployees = useMemo(() => {
    const query = search.toLowerCase().trim();
    let result = employees;

    if (query) {
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          (e.kraPin?.toLowerCase() ?? '').includes(query) ||
          (e.email?.toLowerCase() ?? '').includes(query),
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name);
          break;
        case 'kraPin':
          cmp = (a.kraPin ?? '').localeCompare(b.kraPin ?? '');
          break;
        case 'employeeType':
          cmp = a.employeeType.localeCompare(b.employeeType);
          break;
        case 'basicPay':
          cmp = getBasicPay(a) - getBasicPay(b);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        default:
          cmp = a.name.localeCompare(b.name);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [employees, search, sortKey, sortDir]);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  // ─── Form Logic ────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setEditingEmployee(null);
  }, []);

  const openAddPanel = useCallback(() => {
    resetForm();
    setPanelOpen(true);
  }, [resetForm]);

  const openEditPanel = useCallback(
    (employee: Employee) => {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        email: employee.email ?? '',
        phone: employee.phone ?? '',
        kraPin: employee.kraPin ?? '',
        nationalId: employee.nationalId ?? '',
        nhifNumber: employee.nhifNumber ?? '',
        nssfNumber: employee.nssfNumber ?? '',
        employeeType: employee.employeeType,
        taxTreatment: employee.taxTreatment,
        hireDate: employee.hireDate ? employee.hireDate.slice(0, 10) : '',
        basicPay: employee.salaryStructure?.basicPay?.toString() ?? '',
        housingLevyOverride: employee.salaryStructure?.housingLevyOverride?.toString() ?? '',
        benefits: employee.salaryStructure?.benefits ?? [],
        deductions: employee.salaryStructure?.deductions ?? [],
      });
      setFormErrors({});
      setPanelOpen(true);
    },
    [],
  );

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    resetForm();
  }, [resetForm]);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.kraPin.trim()) errors.kraPin = 'KRA PIN is required';
    else if (formData.kraPin.length !== 11) errors.kraPin = 'KRA PIN must be 11 characters';
    if (!formData.basicPay || parseFloat(formData.basicPay) <= 0) errors.basicPay = 'Valid basic pay is required';
    if (!formData.hireDate) errors.hireDate = 'Hire date is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;
    if (!companyId) return;

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        kraPin: formData.kraPin.trim().toUpperCase(),
        nationalId: formData.nationalId.trim() || undefined,
        nhifNumber: formData.nhifNumber.trim() || undefined,
        nssfNumber: formData.nssfNumber.trim() || undefined,
        employeeType: formData.employeeType,
        taxTreatment: formData.taxTreatment,
        hireDate: formData.hireDate,
        salaryStructure: {
          basicPay: parseFloat(formData.basicPay),
          housingLevyOverride: formData.housingLevyOverride
            ? parseFloat(formData.housingLevyOverride)
            : undefined,
          benefits: formData.benefits.filter((b) => b.name.trim()),
          deductions: formData.deductions.filter((d) => d.name.trim()),
        },
      };

      if (editingEmployee) {
        await updateMutation.mutateAsync({ id: editingEmployee.id, data: payload });
      } else {
        await createMutation.mutateAsync({ companyId, data: payload });
      }

      closePanel();
    } finally {
      setIsSaving(false);
    }
  }, [formData, editingEmployee, companyId, validateForm, createMutation, updateMutation, closePanel]);

  // ─── Terminate Logic ───────────────────────────────────────────────────

  const openTerminateModal = useCallback((employee: Employee) => {
    setTerminatingEmployee(employee);
    setTerminationDate(new Date().toISOString().slice(0, 10));
    setTerminationReason('');
  }, []);

  const closeTerminateModal = useCallback(() => {
    setTerminatingEmployee(null);
    setTerminationDate('');
    setTerminationReason('');
  }, []);

  const handleTerminate = useCallback(async () => {
    if (!terminatingEmployee) return;
    if (!terminationDate || !terminationReason.trim()) {
      showToast('warning', 'Missing Information', 'Please provide a termination date and reason.');
      return;
    }

    setIsTerminating(true);
    try {
      await terminateMutation.mutateAsync({
        id: terminatingEmployee.id,
        data: { terminationDate, terminationReason: terminationReason.trim() },
      });
      closeTerminateModal();
    } finally {
      setIsTerminating(false);
    }
  }, [terminatingEmployee, terminationDate, terminationReason, terminateMutation, closeTerminateModal]);

  // ─── Table Columns ─────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Name',
        sortable: true,
        render: (item: Employee) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
            {item.email && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[180px]">{item.email}</p>
            )}
          </div>
        ),
      },
      {
        key: 'kraPin',
        label: 'KRA PIN',
        sortable: true,
        render: (item: Employee) => (
          <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
            {item.kraPin ?? '—'}
          </span>
        ),
      },
      {
        key: 'employeeType',
        label: 'Type',
        sortable: true,
        render: (item: Employee) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {getEmployeeTypeLabel(item.employeeType)}
          </span>
        ),
      },
      {
        key: 'basicPay',
        label: 'Basic Pay',
        sortable: true,
        render: (item: Employee) => (
          <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
            {formatKES(getBasicPay(item))}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (item: Employee) => (
          <Badge variant={getStatusBadgeVariant(item.status)} size="sm">
            {getStatusLabel(item.status)}
          </Badge>
        ),
      },
    ],
    [],
  );

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <PageShell
      title={`Employees (${stats.total})`}
      subtitle="Manage your payroll employees"
      actions={
        <Button size="sm" onClick={openAddPanel}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Employee
        </Button>
      }
    >
      {/* KPI Cards */}
      {isLoading ? (
        <KpiCardsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={<Users className="h-5 w-5" />}
            label="Active"
            value={stats.active}
            colorClass="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          />
          <KpiCard
            icon={<FileText className="h-5 w-5" />}
            label="Contract"
            value={stats.contract}
            colorClass="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
          />
          <KpiCard
            icon={<Clock className="h-5 w-5" />}
            label="Terminated"
            value={stats.terminated}
            colorClass="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          />
          <KpiCard
            icon={<Users className="h-5 w-5" />}
            label="Total"
            value={stats.total}
            colorClass="bg-kenya-green-100 text-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300"
          />
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-kenya-green-500 focus:ring-kenya-green-500 dark:bg-surface-dark dark:text-gray-100 dark:border-gray-700 dark:placeholder-gray-500 min-h-[48px]"
        />
      </div>

      {/* Employee Table */}
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : employees.length === 0 ? (
        <Card>
          <EmptyState
            icon="👥"
            title="No employees yet"
            description="Add your first employee to start managing payroll."
            action={{ label: 'Add Employee', onClick: openAddPanel }}
          />
        </Card>
      ) : (
        <Table<Employee>
          columns={columns}
          data={filteredEmployees}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={(item) => setDetailsEmployee(item)}
          rowKey={(item) => item.id}
          emptyMessage="No employees match your search."
        />
      )}

      {/* ─── Add/Edit SlideOutPanel ──────────────────────────────────── */}
      <SlideOutPanel
        isOpen={panelOpen}
        onClose={closePanel}
        title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
        subtitle={editingEmployee ? `Editing ${editingEmployee.name}` : 'Enter employee details'}
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" size="md" className="flex-1" onClick={closePanel}>
              Cancel
            </Button>
            <Button
              size="md"
              className="flex-1"
              isLoading={isSaving}
              disabled={isSaving}
              onClick={handleSubmit}
            >
              {editingEmployee ? 'Update Employee' : 'Add Employee'}
            </Button>
          </div>
        }
      >
        <EmployeeForm formData={formData} onChange={setFormData} errors={formErrors} />
      </SlideOutPanel>

      {/* ─── Details Panel ───────────────────────────────────────────── */}
      <SlideOutPanel
        isOpen={!!detailsEmployee}
        onClose={() => setDetailsEmployee(null)}
        title={detailsEmployee?.name ?? 'Employee Details'}
        subtitle="Full employee information"
        footer={
          detailsEmployee && detailsEmployee.status !== 'TERMINATED' ? (
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="md"
                className="flex-1"
                onClick={() => {
                  const emp = detailsEmployee;
                  setDetailsEmployee(null);
                  openEditPanel(emp);
                }}
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="md"
                className="flex-1"
                onClick={() => {
                  const emp = detailsEmployee;
                  setDetailsEmployee(null);
                  openTerminateModal(emp);
                }}
              >
                Terminate
              </Button>
            </div>
          ) : undefined
        }
      >
        {detailsEmployee && (
          <div className="space-y-4">
            {/* Status badge */}
            <div>
              <Badge variant={getStatusBadgeVariant(detailsEmployee.status)} size="md">
                {getStatusLabel(detailsEmployee.status)}
              </Badge>
            </div>

            {/* Personal Info */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Personal Information
              </h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Email</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{detailsEmployee.email ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Phone</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{detailsEmployee.phone ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">KRA PIN</dt>
                  <dd className="font-mono text-gray-900 dark:text-gray-100">{detailsEmployee.kraPin ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">National ID</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{detailsEmployee.nationalId ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">NHIF</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{detailsEmployee.nhifNumber ?? '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">NSSF</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{detailsEmployee.nssfNumber ?? '—'}</dd>
                </div>
              </dl>
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Employment Info */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Employment Details
              </h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Type</dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {getEmployeeTypeLabel(detailsEmployee.employeeType)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Tax Treatment</dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {detailsEmployee.taxTreatment === 'STANDARD'
                      ? 'Standard'
                      : detailsEmployee.taxTreatment === 'SHORT_HOURS'
                        ? 'Short Hours'
                        : 'Secondary Employment'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Hire Date</dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {formatDate(detailsEmployee.hireDate)}
                  </dd>
                </div>
                {detailsEmployee.terminationDate && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Termination Date</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {formatDate(detailsEmployee.terminationDate)}
                    </dd>
                  </div>
                )}
                {detailsEmployee.terminationReason && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Termination Reason</dt>
                    <dd className="text-gray-900 dark:text-gray-100">
                      {detailsEmployee.terminationReason}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <hr className="border-gray-200 dark:border-gray-700" />

            {/* Salary Info */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Salary
              </h4>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Basic Pay</dt>
                  <dd className="font-mono text-gray-900 dark:text-gray-100">
                    {formatKES(getBasicPay(detailsEmployee))}
                  </dd>
                </div>
                {detailsEmployee.salaryStructure?.housingLevyOverride != null && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-gray-400">Housing Levy Override</dt>
                    <dd className="font-mono text-gray-900 dark:text-gray-100">
                      {formatKES(detailsEmployee.salaryStructure.housingLevyOverride)}
                    </dd>
                  </div>
                )}
                {detailsEmployee.salaryStructure?.benefits &&
                  detailsEmployee.salaryStructure.benefits.length > 0 && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400 mt-2">Benefits</dt>
                      {detailsEmployee.salaryStructure.benefits.map((b, i) => (
                        <dd key={i} className="flex justify-between text-xs">
                          <span>{b.name}</span>
                          <span className="font-mono">
                            {formatKES(b.amount)}
                            {b.taxable && (
                              <span className="text-gray-400 ml-1">(T)</span>
                            )}
                          </span>
                        </dd>
                      ))}
                    </>
                  )}
                {detailsEmployee.salaryStructure?.deductions &&
                  detailsEmployee.salaryStructure.deductions.length > 0 && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400 mt-2">Deductions</dt>
                      {detailsEmployee.salaryStructure.deductions.map((d, i) => (
                        <dd key={i} className="flex justify-between text-xs">
                          <span>{d.name}</span>
                          <span className="font-mono">{formatKES(d.amount)}</span>
                        </dd>
                      ))}
                    </>
                  )}
              </dl>
            </div>
          </div>
        )}
      </SlideOutPanel>

      {/* ─── Terminate Confirmation Modal ─────────────────────────────── */}
      <Modal
        isOpen={!!terminatingEmployee}
        onClose={closeTerminateModal}
        title="Terminate Employee"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={closeTerminateModal}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="md"
              className="flex-1"
              isLoading={isTerminating}
              disabled={isTerminating || !terminationDate || !terminationReason.trim()}
              onClick={handleTerminate}
            >
              Confirm Termination
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                This will stop payroll for this employee
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {terminatingEmployee?.name} will no longer be included in payroll runs after termination.
              </p>
            </div>
          </div>

          <Input
            label="Termination Date *"
            type="date"
            value={terminationDate}
            onChange={(e) => setTerminationDate(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Termination Reason *
            </label>
            <textarea
              value={terminationReason}
              onChange={(e) => setTerminationReason(e.target.value)}
              placeholder="e.g., Resignation, End of contract, Retirement"
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-kenya-green-500 focus:ring-kenya-green-500 dark:bg-surface-dark dark:text-gray-100 dark:border-gray-700 dark:placeholder-gray-500 min-h-[48px] text-base resize-none"
              required
            />
          </div>
        </div>
      </Modal>
    </PageShell>
  );
}
