import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useAccounts, useCreateIncome } from '../../hooks/use-api';

const incomeSchema = z.object({
  accountId: z.string().min(1, 'Please select an income account'),
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  reference: z.string().optional(),
  entryDate: z.string().min(1, 'Date is required'),
});

type IncomeFormData = z.infer<typeof incomeSchema>;

interface IncomeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function IncomeForm({ isOpen, onClose, onSuccess }: IncomeFormProps) {
  const { data: accounts = [] } = useAccounts();
  const createIncome = useCreateIncome();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IncomeFormData>({
    resolver: zodResolver(incomeSchema),
    defaultValues: { entryDate: new Date().toISOString().split('T')[0] },
  });

  useEffect(() => {
    if (isOpen) reset({ entryDate: new Date().toISOString().split('T')[0] });
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = async (data: IncomeFormData) => {
    await createIncome.mutateAsync({
      ...data,
      entryDate: new Date(data.entryDate).toISOString(),
    });
    onSuccess();
    onClose();
    reset();
  };

  const incomeAccounts = accounts.filter((a) => a.type === 'INCOME');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl border border-kenya-green-100 bg-white p-6 shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-kenya-green-900 dark:text-kenya-green-50">
            Record Income
          </h2>
          <button onClick={onClose} className="text-xl text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50">
              Income Account
            </label>
            <select
              {...register('accountId')}
              className="touch-target h-12 rounded-lg border border-kenya-green-200 bg-white px-4 text-sm dark:border-kenya-green-700 dark:bg-kenya-surface-dark"
            >
              <option value="">Select account...</option>
              {incomeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
            {errors.accountId && <p className="text-xs text-red-500">{errors.accountId.message}</p>}
          </div>

          <Input label="Description" placeholder="e.g., Consulting fees" {...register('description')} error={errors.description?.message} />
          <Input label="Amount (KES)" type="number" min="0" step="0.01" placeholder="10000" {...register('amount')} error={errors.amount?.message} />
          <Input label="Reference (optional)" placeholder="Inv #INV-001" {...register('reference')} />
          <Input label="Date" type="date" {...register('entryDate')} error={errors.entryDate?.message} />

          <div className="mt-2 flex gap-3">
            <Button type="button" variant="ghost" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="lg" className="flex-1" isLoading={createIncome.isPending}>
              Record Income
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
