import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: 'WORKFLOW',
    items: [
      { to: '/workflow', label: 'Monthly Workflow', icon: '📋' },
    ],
  },
  {
    label: 'MAIN',
    items: [
      { to: '/', label: 'Dashboard', icon: '📊' },
      { to: '/ledger', label: 'Ledger', icon: '📒' },
      { to: '/accounts', label: 'Chart of Accounts', icon: '📋' },
    ],
  },
  {
    label: 'COMPLIANCE',
    items: [
      { to: '/etims', label: 'eTIMS', icon: '🧾' },
      { to: '/mpesa', label: 'M-Pesa', icon: '📱' },
      { to: '/hitl', label: 'HITL Hub', icon: '🛡️' },
    ],
  },
  {
    label: 'REPORTS',
    items: [
      { to: '/reports#financial', label: 'Financial Statements', icon: '📈' },
      { to: '/reports#tax', label: 'Tax & Compliance', icon: '🧾' },
      { to: '/reports#accounting', label: 'Accounting', icon: '📋' },
      { to: '/reports#audit', label: 'Audit & Controls', icon: '🔍' },
    ],
  },
  {
    label: 'TEAM',
    items: [
      { to: '/team', label: 'Team', icon: '👥' },
      { to: '/settings', label: 'Settings', icon: '⚙️' },
      { to: '/help', label: 'Help & Support', icon: '❓' },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-full w-64 flex-col bg-kenya-green-500 text-white">
      {/* Brand header */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-kenya-green-400/30">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg">
          📚
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">JengaBooks</h1>
          <p className="text-xs text-kenya-green-200">Accounting SaaS</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {sections.map((section) => (
          <div key={section.label} className="mb-4">
            <p className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-kenya-green-300">
              {section.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const isActive = item.to.startsWith('/reports')
                  ? location.pathname === '/reports' && location.hash === item.to.split('#')[1]
                  : item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to);

                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      className={clsx(
                        'touch-target flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                        {
                          'bg-white/20 text-white shadow-sm': isActive,
                          'text-kenya-green-100 hover:bg-white/10 hover:text-white': !isActive,
                        },
                      )}
                    >
                      <span className="text-lg" aria-hidden="true">{item.icon}</span>
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
