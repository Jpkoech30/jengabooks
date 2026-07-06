import React from 'react';
import { clsx } from 'clsx';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';

type PeriodStatus = 'closed' | 'pending' | 'errors' | 'none';

interface TenantPeriod {
  tenant: string;
  periods: { label: string; status: PeriodStatus }[];
}

const mockData: TenantPeriod[] = [
  {
    tenant: 'Tech Corp',
    periods: [
      { label: 'Jan', status: 'closed' },
      { label: 'Feb', status: 'closed' },
      { label: 'Mar', status: 'closed' },
      { label: 'Apr', status: 'pending' },
      { label: 'May', status: 'errors' },
      { label: 'Jun', status: 'pending' },
    ],
  },
  {
    tenant: 'Safari Hotel',
    periods: [
      { label: 'Jan', status: 'closed' },
      { label: 'Feb', status: 'pending' },
      { label: 'Mar', status: 'errors' },
      { label: 'Apr', status: 'errors' },
      { label: 'May', status: 'pending' },
      { label: 'Jun', status: 'none' },
    ],
  },
  {
    tenant: 'M-Changa',
    periods: [
      { label: 'Jan', status: 'closed' },
      { label: 'Feb', status: 'closed' },
      { label: 'Mar', status: 'closed' },
      { label: 'Apr', status: 'closed' },
      { label: 'May', status: 'closed' },
      { label: 'Jun', status: 'closed' },
    ],
  },
];

const statusColorMap: Record<PeriodStatus, string> = {
  closed: 'bg-kenya-green-500',
  pending: 'bg-kenya-amber-500',
  errors: 'bg-kenya-red',
  none: 'bg-gray-200 dark:bg-gray-700',
};

const statusLabelMap: Record<PeriodStatus, string> = {
  closed: 'Closed',
  pending: 'Pending',
  errors: 'Errors',
  none: 'No data',
};

export function PortfolioHeatmap() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Overview</CardTitle>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-kenya-green-500" /> Closed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-kenya-amber-500" /> Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-kenya-red" /> Errors
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Tenant</th>
                {mockData[0]!.periods.map((p) => (
                  <th key={p.label} className="text-center text-xs font-medium text-gray-500 pb-2 px-1 w-12">
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockData.map((row) => (
                <tr key={row.tenant}>
                  <td className="text-sm font-medium text-kenya-green-900 dark:text-kenya-green-50 py-2 pr-4">
                    {row.tenant}
                  </td>
                  {row.periods.map((period) => (
                    <td key={period.label} className="px-1 py-2">
                      <div className="group relative flex justify-center">
                        <div
                          className={clsx(
                            'h-8 w-8 rounded-md transition-transform hover:scale-110 cursor-default',
                            statusColorMap[period.status],
                          )}
                        />
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                            {row.tenant} - {period.label}: {statusLabelMap[period.status]}
                          </div>
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
