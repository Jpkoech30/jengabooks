import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useViewModeStore } from '../../stores/view-mode-store';

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
      { to: '/reports/financial', label: 'Financial Statements', icon: '📈' },
      { to: '/reports/tax', label: 'Tax & Compliance', icon: '🧾' },
      { to: '/reports/accounting', label: 'Accounting', icon: '📋' },
      { to: '/reports/audit', label: 'Audit & Controls', icon: '🔍' },
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

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const viewMode = useViewModeStore((state) => state.mode);
  const setMode = useViewModeStore((state) => state.setMode);
  const activeClient = useViewModeStore((state) => state.activeClient);

  const handleNavClick = () => {
    // Close sidebar on mobile after navigation
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const handleBackToFirm = () => {
    setMode('firm');
    navigate('/');
  };

  const sidebarContent = (
    <>
      {/* Brand header */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-kenya-green-400/30">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg">
          <span aria-hidden="true">📚</span>
        </div>
        <div>
          <h1 className="text-lg font-bold leading-tight">JengaBooks</h1>
          <p className="text-xs text-kenya-green-200">
            {viewMode === 'client' && activeClient
              ? activeClient.name
              : 'Accounting SaaS'}
          </p>
        </div>
      </div>

      {/* Dual-mode navigation */}
      {viewMode === 'client' && activeClient && (
        <div className="px-3 pt-3">
          <button
            onClick={handleBackToFirm}
            className="touch-target flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-kenya-green-100 hover:bg-white/10 hover:text-white transition-colors"
          >
            <span aria-hidden="true">←</span>
            <span>Back to Firm Overview</span>
          </button>
        </div>
      )}

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
                    ? location.pathname.startsWith('/reports') && location.pathname === item.to
                    : item.to === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.to);

                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={handleNavClick}
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
    </>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: fixed on mobile (slide-in), static on desktop */}
      <aside
        className={clsx(
          'flex h-full flex-col bg-kenya-green-500 text-white transition-transform duration-200',
          // Mobile: fixed overlay, slides in from left
          'fixed left-0 top-0 z-50 w-64 lg:static lg:z-auto',
          // Mobile: hidden when closed
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
