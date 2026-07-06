import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth-store';
import { useGamificationProfile } from '../../hooks/use-api';

export function Header() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showCompanySwitcher, setShowCompanySwitcher] = React.useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const switchCompany = useAuthStore((state) => state.switchCompany);
  const { data: gamification } = useGamificationProfile();

  const unreadCount = 0;
  const xpProgress = gamification ? Math.round((gamification.score / (gamification.score + gamification.xpToNextLevel)) * 100) : 0;
  const userInitials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '?';

  const memberships = user?.memberships || [];
  const currentCompanyId = user?.companyId;

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleSwitchCompany = async (companyId: string) => {
    setShowCompanySwitcher(false);
    const success = await switchCompany(companyId);
    if (success) {
      // Invalidate all React Query caches so data refetches for the new company
      queryClient.invalidateQueries();
      navigate('/', { replace: true });
    }
  };

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    if (!showUserMenu && !showCompanySwitcher) return;
    const handleClick = () => {
      setShowUserMenu(false);
      setShowCompanySwitcher(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showUserMenu, showCompanySwitcher]);

  return (
    <header className="flex h-16 items-center justify-between border-b border-kenya-green-100 bg-white px-6 dark:border-kenya-green-800 dark:bg-kenya-surface-dark">
      {/* Left: Page title area */}
      <div className="flex items-center gap-4">
        <button
          className="touch-target flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-kenya-green-50 dark:hover:bg-kenya-green-900 lg:hidden"
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <div>
          <h2 className="text-lg font-semibold text-kenya-green-900 dark:text-kenya-green-50">
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ' back'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowNotifications(!showNotifications); setShowCompanySwitcher(false); }}
            className="touch-target relative flex h-12 w-12 items-center justify-center rounded-lg text-gray-500 hover:bg-kenya-green-50 dark:hover:bg-kenya-green-900"
            aria-label={`Notifications (${unreadCount} unread)`}
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-kenya-red px-1 text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Company Switcher */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowCompanySwitcher(!showCompanySwitcher); setShowUserMenu(false); }}
            className="touch-target flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-kenya-green-700 hover:bg-kenya-green-50 dark:text-kenya-green-300 dark:hover:bg-kenya-green-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-kenya-amber-500 text-sm font-bold text-black">
              {user?.companyName?.charAt(0) || '?'}
            </span>
            <span className="max-w-[120px] truncate">{user?.companyName || 'Select Company'}</span>
            <span className="text-xs">▾</span>
          </button>

          {showCompanySwitcher && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl border border-kenya-green-100 bg-white shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-kenya-green-100 dark:border-kenya-green-800">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Switch Company</p>
              </div>
              <div className="py-1 max-h-64 overflow-y-auto">
                {memberships.map((m) => (
                  <button
                    key={m.companyId}
                    onClick={() => handleSwitchCompany(m.companyId)}
                    className={`touch-target flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      m.companyId === currentCompanyId
                        ? 'bg-kenya-green-50 text-kenya-green-900 dark:bg-kenya-green-900/30 dark:text-kenya-green-50'
                        : 'text-kenya-green-700 hover:bg-kenya-green-50 dark:text-kenya-green-300 dark:hover:bg-kenya-green-900/30'
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      m.companyId === currentCompanyId
                        ? 'bg-kenya-amber-500 text-black'
                        : 'bg-kenya-green-100 text-kenya-green-700 dark:bg-kenya-green-800 dark:text-kenya-green-300'
                    }`}>
                      {m.companyName.charAt(0)}
                    </span>
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
              <div className="border-t border-kenya-green-100 dark:border-kenya-green-800 py-1">
                <button
                  onClick={() => { setShowCompanySwitcher(false); navigate('/settings'); }}
                  className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-kenya-green-700 hover:bg-kenya-green-50 dark:text-kenya-green-300 dark:hover:bg-kenya-green-900/30"
                >
                  <span className="text-base">➕</span>
                  <span>Create New Company</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* XP Badge */}
        {gamification && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-kenya-amber-50 border border-kenya-amber-200 dark:bg-kenya-amber-900/20 dark:border-kenya-amber-700"
            title={`Level ${gamification.level} ${gamification.levelTitle} — ${gamification.score} XP total`}
          >
            <span className="text-sm">⭐</span>
            <span className="text-xs font-bold text-kenya-amber-700 dark:text-kenya-amber-300">
              Lv.{gamification.level}
            </span>
            <div className="w-12 h-1.5 bg-kenya-amber-200 dark:bg-kenya-amber-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-kenya-amber-500 rounded-full transition-all"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); setShowCompanySwitcher(false); }}
            className="touch-target flex h-12 w-12 items-center justify-center rounded-full bg-kenya-green-100 text-sm font-bold text-kenya-green-700 hover:bg-kenya-green-200 dark:bg-kenya-green-800 dark:text-kenya-green-300"
            aria-label="User profile"
            title={user?.email || ''}
          >
            {userInitials}
          </button>

          {showUserMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-kenya-green-100 bg-white shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark overflow-hidden"
            >
              {/* User Info */}
              <div className="px-4 py-4 border-b border-kenya-green-100 dark:border-kenya-green-800">
                <p className="text-sm font-semibold text-kenya-green-900 dark:text-kenya-green-50 truncate">
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

              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={() => { navigate('/profile'); setShowUserMenu(false); }}
                  className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-kenya-green-900 hover:bg-kenya-green-50 dark:text-kenya-green-50 dark:hover:bg-kenya-green-900/30"
                >
                  <span className="text-base">👤</span>
                  <span>My Profile</span>
                </button>
                <button
                  onClick={() => { navigate('/team'); setShowUserMenu(false); }}
                  className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-kenya-green-900 hover:bg-kenya-green-50 dark:text-kenya-green-50 dark:hover:bg-kenya-green-900/30"
                >
                  <span className="text-base">👥</span>
                  <span>Team Management</span>
                </button>
                <button
                  onClick={() => { navigate('/settings'); setShowUserMenu(false); }}
                  className="touch-target flex w-full items-center gap-3 px-4 py-3 text-sm text-kenya-green-900 hover:bg-kenya-green-50 dark:text-kenya-green-50 dark:hover:bg-kenya-green-900/30"
                >
                  <span className="text-base">⚙️</span>
                  <span>Settings</span>
                </button>
              </div>

              {/* Logout */}
              <div className="border-t border-kenya-green-100 dark:border-kenya-green-800 py-1">
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
