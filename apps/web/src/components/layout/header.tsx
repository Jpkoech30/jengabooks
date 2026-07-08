import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth-store';
import { useGamificationProfile } from '../../hooks/use-api';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/ledger': 'General Ledger',
  '/accounts': 'Chart of Accounts',
  '/etims': 'eTIMS Integration',
  '/mpesa': 'M-Pesa Import',
  '/hitl': 'HITL Hub',
  '/reports': 'Reports',
  '/workflow': 'Monthly Workflow',
  '/team': 'Team',
  '/settings': 'Settings',
  '/help': 'Help & Support',
};

export function Header({ onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [showCompanySwitcher, setShowCompanySwitcher] = React.useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const switchCompany = useAuthStore((state) => state.switchCompany);
  const { data: gamification } = useGamificationProfile();

  const currentPath = '/' + location.pathname.split('/').filter(Boolean)[0];
  const pageTitle = PAGE_TITLES[currentPath] || 'Dashboard';

  const memberships = user?.memberships || [];
  const hasMultipleCompanies = memberships.length > 1;
  const currentCompanyId = user?.companyId;
  const currentCompanyName = user?.companyName;

  const recentActivity = gamification?.recentActivity || [];
  const hasNotifications = recentActivity.length > 0;

  const userInitials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '?';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSwitchCompany = async (companyId: string) => {
    setShowCompanySwitcher(false);
    const success = await switchCompany(companyId);
    if (success) {
      queryClient.invalidateQueries();
      navigate('/', { replace: true });
    }
  };

  React.useEffect(() => {
    if (!showProfileMenu && !showCompanySwitcher) return;
    const handleClick = () => {
      setShowProfileMenu(false);
      setShowCompanySwitcher(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showProfileMenu, showCompanySwitcher]);

  return (
    <header className="flex h-16 items-center justify-between border-b border-kenya-gray-200 bg-white px-6 dark:border-kenya-green-800 dark:bg-kenya-surface-dark">
      {/* Left: Hamburger + Page title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="touch-target flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-kenya-gray-50 dark:hover:bg-kenya-green-900 lg:hidden"
          aria-label="Open sidebar menu"
        >
          <span aria-hidden="true">☰</span>
        </button>
        <h2 className="text-lg font-semibold text-kenya-gray-900 dark:text-kenya-green-50">
          {pageTitle}
        </h2>
      </div>

      {/* Right: [company switcher] [notifications + profile menu] */}
      <div className="flex items-center gap-3">
        {/* Company Switcher */}
        <div className="relative">
          {hasMultipleCompanies ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowCompanySwitcher(!showCompanySwitcher); setShowProfileMenu(false); }}
                className="touch-target flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-kenya-gray-700 hover:bg-kenya-gray-50 dark:text-kenya-green-300 dark:hover:bg-kenya-green-900"
                aria-label={`Switch company (current: ${currentCompanyName || 'None'})`}
                aria-expanded={showCompanySwitcher}
                aria-haspopup="true"
              >
                <span className="max-w-[140px] truncate">{currentCompanyName || 'Select Company'}</span>
                <span className="text-xs text-gray-400">▾</span>
              </button>

              {showCompanySwitcher && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-kenya-gray-200 bg-white shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-kenya-gray-200 dark:border-kenya-green-800">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Switch Company</p>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {memberships.map((m) => (
                      <button
                        key={m.companyId}
                        onClick={() => handleSwitchCompany(m.companyId)}
                        className={`touch-target flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors ${m.companyId === currentCompanyId ? 'bg-kenya-gray-100 text-kenya-green-900 dark:bg-kenya-green-900/30 dark:text-kenya-green-50' : 'text-kenya-gray-700 hover:bg-kenya-gray-50 dark:text-kenya-green-300 dark:hover:bg-kenya-green-900/30'}`}
                      >
                        <div className="flex-1 text-left">
                          <p className={`font-medium ${m.companyId === currentCompanyId ? 'font-bold' : ''}`}>
                            {m.companyName}
                            {m.companyId === currentCompanyId && (
                              <span className="ml-2 text-xs text-kenya-green-500">(active)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {m.role?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        {m.companyId === currentCompanyId && (
                          <span className="text-kenya-green-500">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-kenya-gray-200 dark:border-kenya-green-800 py-1">
                    <button
                      onClick={() => { setShowCompanySwitcher(false); navigate('/settings'); }}
                      className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-kenya-gray-700 hover:bg-kenya-gray-50 dark:text-kenya-green-300 dark:hover:bg-kenya-green-900/30"
                    >
                      <span className="text-base">➕</span>
                      <span>Create New Company</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <span className="inline-flex items-center px-3 py-2 text-sm font-medium text-kenya-gray-700 dark:text-kenya-green-300">
              {currentCompanyName || 'JengaBooks'}
            </span>
          )}
        </div>

        {/* Unified Profile Menu (Notifications + User) */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowProfileMenu(!showProfileMenu); setShowCompanySwitcher(false); }}
            className="touch-target flex items-center gap-2 rounded-lg border border-kenya-gray-200 bg-white px-3 py-1.5 hover:bg-kenya-gray-50 dark:border-kenya-green-800 dark:bg-kenya-surface-dark dark:hover:bg-kenya-green-900"
            aria-label={`Profile menu${user?.name ? ' (' + user.name + ')' : ''}`}
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
          >
            {hasNotifications && (
              <span className="text-lg leading-none" aria-hidden="true">🔔</span>
            )}
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-kenya-green-100 text-xs font-bold text-kenya-green-700 dark:bg-kenya-green-800 dark:text-kenya-green-300">
              {userInitials}
            </span>
          </button>

          {showProfileMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-kenya-gray-200 bg-white shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark overflow-hidden"
            >
              {hasNotifications && (
                <>
                  <div className="px-4 py-3 border-b border-kenya-gray-200 dark:border-kenya-green-800">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notifications</p>
                  </div>
                  <div className="py-1 max-h-48 overflow-y-auto">
                    {recentActivity.slice(0, 5).map((activity, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-kenya-gray-900 dark:text-kenya-green-50 hover:bg-kenya-gray-50 dark:hover:bg-kenya-green-900/30"
                      >
                        <span className="text-xs font-medium text-amber-700 shrink-0">+{activity.points} XP</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{activity.reason}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-kenya-gray-200 dark:border-kenya-green-800" />
                </>
              )}

              <div className="px-4 py-4 border-b border-kenya-gray-200 dark:border-kenya-green-800">
                <p className="text-sm font-semibold text-kenya-gray-900 dark:text-kenya-green-50 truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email || ''}
                </p>
                {user?.companyName && (
                  <p className="text-xs text-kenya-green-600 dark:text-kenya-green-400 mt-1">
                    {user.companyName} — {user.role?.replace(/_/g, ' ')}
                  </p>
                )}
              </div>

              <div className="py-1">
                <button
                  onClick={() => { navigate('/profile'); setShowProfileMenu(false); }}
                  className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-kenya-gray-900 hover:bg-kenya-gray-50 dark:text-kenya-green-50 dark:hover:bg-kenya-green-900/30"
                >
                  <span className="text-base">👤</span>
                  <span>My Profile</span>
                </button>
                <button
                  onClick={() => { navigate('/team'); setShowProfileMenu(false); }}
                  className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-kenya-gray-900 hover:bg-kenya-gray-50 dark:text-kenya-green-50 dark:hover:bg-kenya-green-900/30"
                >
                  <span className="text-base">👥</span>
                  <span>Team Management</span>
                </button>
                <button
                  onClick={() => { navigate('/settings'); setShowProfileMenu(false); }}
                  className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-kenya-gray-900 hover:bg-kenya-gray-50 dark:text-kenya-green-50 dark:hover:bg-kenya-green-900/30"
                >
                  <span className="text-base">⚙️</span>
                  <span>Settings</span>
                </button>
              </div>

              <div className="border-t border-kenya-gray-200 dark:border-kenya-green-800 py-1">
                <button
                  onClick={handleLogout}
                  className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <span className="text-base">🚪</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
