import React, { useState, useCallback } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { useViewModeStore } from '../../stores/view-mode-store';
import { useAuthStore } from '../../stores/auth-store';
import { CompanyRole } from '@jengabooks/shared';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavSection {
  label: string;
  id: string;
  items: NavItem[];
}

// ── Navigation Data ──────────────────────────────────────────────────────────
// Reduced from 5 groups (14 items) to 3 groups (8 items).
// Workflow → shown on Dashboard as a Month-End wizard widget
// Reports → accessible via Dashboard card (sub-page)
// Help → moved out of sidebar (accessible from the profile menu)

const sections: NavSection[] = [
  {
    label: 'MAIN',
    id: 'main',
    items: [
      { to: '/', label: 'Dashboard', icon: '📊' },
      { to: '/ledger', label: 'Ledger', icon: '📒' },
      { to: '/accounts', label: 'Accounts', icon: '📋' },
      { to: '/tasks', label: 'Tasks', icon: '✅' },
    ],
  },
  {
    label: 'PAYROLL',
    id: 'payroll',
    items: [
      { to: '/employees', label: 'Employees', icon: '👤' },
      { to: '/payroll', label: 'Payroll', icon: '💰' },
    ],
  },
  {
    label: 'PRACTICE',
    id: 'practice',
    items: [
      { to: '/practice', label: 'Practice Hub', icon: '🏢' },
      { to: '/audit', label: 'Audit & Compliance', icon: '🛡️' },
    ],
  },
  {
    label: 'COMPLIANCE',
    id: 'compliance',
    items: [
      { to: '/etims', label: 'eTIMS', icon: '🧾' },
      { to: '/mpesa', label: 'M-Pesa', icon: '📱' },
      { to: '/hitl', label: 'HITL Hub', icon: '🛡️' },
    ],
  },
  {
    label: 'SETTINGS',
    id: 'settings',
    items: [
      { to: '/documents', label: 'Documents', icon: '📄' },
      { to: '/team', label: 'Team', icon: '👥' },
      { to: '/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

/** Roles that are allowed to access M-Pesa features */
const MPESA_ALLOWED_ROLES: string[] = [
  CompanyRole.SUPER_ADMIN,
  CompanyRole.FIRM_OWNER,
  CompanyRole.TENANT_ADMIN,
  CompanyRole.ACCOUNTANT,
  CompanyRole.SME_OWNER,
];

// ── localStorage helpers for collapsible state ───────────────────────────────

const STORAGE_KEY = 'jengabooks_sidebar_collapsed';

function loadCollapsed(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as string[];
      return new Set(parsed);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

function persistCollapsed(collapsed: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...collapsed]));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed());

  const toggle = useCallback((sectionId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      persistCollapsed(next);
      return next;
    });
  }, []);

  return { collapsed, toggle };
}

// ── Component ────────────────────────────────────────────────────────────────

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
  const user = useAuthStore((state) => state.user);
  const { collapsed, toggle } = useSidebarCollapse();

  const userRole = user?.role ?? '';

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
          <p className="text-xs text-kenya-green-100">
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
            className="touch-target flex w-full items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:bg-white/10 hover:text-white transition-colors"
          >
            <span aria-hidden="true">←</span>
            <span>Back to Firm Overview</span>
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {sections.map((section) => {
          // Filter items by role — Auditor should not see M-Pesa
          const visibleItems = section.items.filter((item) => {
            if (item.to === '/mpesa') {
              return MPESA_ALLOWED_ROLES.includes(userRole);
            }
            return true;
          });

          // Skip section entirely if no visible items
          if (visibleItems.length === 0) return null;

          const isExpanded = !collapsed.has(section.id);

          return (
            <div key={section.id} className="mb-4">
              {/* Collapsible section header */}
              <button
                onClick={() => toggle(section.id)}
                className="touch-target flex w-full items-center justify-between rounded-lg px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-kenya-green-200 hover:text-white transition-colors"
                aria-expanded={isExpanded}
                aria-controls={`sidebar-section-${section.id}`}
              >
                <span>{section.label}</span>
                <svg
                  className={clsx(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    isExpanded && 'rotate-180',
                  )}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {/* Collapsible items list */}
              <ul
                id={`sidebar-section-${section.id}`}
                className={clsx(
                  'flex flex-col gap-0.5 overflow-hidden transition-all duration-200',
                  isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0',
                )}
              >
                {visibleItems.map((item) => {
                  const isActive =
                    item.to === '/'
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
                            'bg-white/25 text-white shadow-sm': isActive,
                            'text-white hover:bg-white/10 hover:text-white': !isActive,
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
          );
        })}
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
