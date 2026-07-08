import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth-store';
import { useUiStore } from '../../stores/ui-store';
import { t } from '../../lib/plain-english';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../hooks/use-api';
import { timeAgo, cn } from '../../lib/utils';
import type { Notification, NotificationType } from '../../lib/types';

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
  '/tasks': 'Tasks',
};

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  MENTION: '📝',
  DEADLINE: '⏰',
  STATUS_CHANGE: '🔄',
  BANK_FEED: '🔴',
  TASK_ASSIGNED: '📋',
  SYSTEM: '🔔',
};

/** Click-outside hook for dropdowns */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  React.useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handler();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, handler]);
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [showCompanySwitcher, setShowCompanySwitcher] = React.useState(false);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const switchCompany = useAuthStore((state) => state.switchCompany);
  const plainEnglish = useUiStore((state) => state.plainEnglish);
  const togglePlainEnglish = useUiStore((state) => state.togglePlainEnglish);

  // Notifications
  const { data: notifications = [], isLoading: notifLoading } = useNotifications('UNREAD');
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const currentPath = '/' + location.pathname.split('/').filter(Boolean)[0];
  const pageTitle = t(PAGE_TITLES[currentPath] || 'Dashboard', plainEnglish);

  const memberships = user?.memberships || [];
  const hasMultipleCompanies = memberships.length > 1;
  const currentCompanyId = user?.companyId;
  const currentCompanyName = user?.companyName;

  const userInitials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || '?';

  // Refs for click-outside handling
  const notifRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);
  const companyRef = React.useRef<HTMLDivElement>(null);

  useClickOutside(notifRef, () => setShowNotifications(false));
  useClickOutside(profileRef, () => setShowProfileMenu(false));
  useClickOutside(companyRef, () => setShowCompanySwitcher(false));

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

  const handleNotificationClick = (notification: Notification) => {
    markRead.mutate(notification.id);
    setShowNotifications(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
    setShowNotifications(false);
  };

  const unreadCount = notifications.length;

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

      {/* Right: [plain english toggle] [company switcher] [notifications] [profile menu] */}
      <div className="flex items-center gap-3">
        {/* Plain English Toggle Pill */}
        <button
          onClick={togglePlainEnglish}
          className={cn(
            'touch-target inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
            plainEnglish
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ring-1 ring-emerald-400/50'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
          aria-label={`Plain English mode: ${plainEnglish ? 'on' : 'off'}`}
          aria-pressed={plainEnglish}
          title={`Plain English mode: ${plainEnglish ? 'on' : 'off'}`}
        >
          <span aria-hidden="true" className="text-sm leading-none">📖</span>
          <span>Plain English</span>
        </button>
        {/* Company Switcher */}
        <div ref={companyRef} className="relative">
          {hasMultipleCompanies ? (
            <>
              <button
                onClick={() => { setShowCompanySwitcher(!showCompanySwitcher); setShowProfileMenu(false); setShowNotifications(false); }}
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

        {/* Notification Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); setShowCompanySwitcher(false); }}
            className="touch-target relative flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-kenya-gray-50 dark:text-kenya-green-300 dark:hover:bg-kenya-green-900"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <span className="text-lg leading-none" aria-hidden="true">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-kenya-surface-dark">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-2 z-50 w-[380px] rounded-xl border border-kenya-gray-200 bg-white shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-kenya-gray-200 dark:border-kenya-green-800">
                <p className="text-sm font-semibold text-kenya-gray-900 dark:text-kenya-green-50">
                  Notifications
                </p>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-xs font-medium text-kenya-green-600 hover:text-kenya-green-700 dark:text-kenya-green-400 dark:hover:text-kenya-green-300 transition-colors"
                  >
                    ✓ All
                  </button>
                )}
              </div>

              {/* Loading state */}
              {notifLoading && (
                <div className="px-4 py-8 text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-kenya-green-500 border-t-transparent" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Loading notifications...</p>
                </div>
              )}

              {/* Zero state */}
              {!notifLoading && unreadCount === 0 && (
                <div className="flex flex-col items-center px-4 py-8 text-center">
                  <span className="mb-2 text-2xl" aria-hidden="true">🔔</span>
                  <p className="text-sm font-medium text-kenya-gray-900 dark:text-kenya-green-50">
                    No notifications
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    You're all caught up!
                  </p>
                </div>
              )}

              {/* Notification list (last 5) */}
              {!notifLoading && unreadCount > 0 && (
                <div className="max-h-80 overflow-y-auto">
                  {notifications.slice(0, 5).map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className="touch-target flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-kenya-gray-50 dark:hover:bg-kenya-green-900/30 transition-colors border-b border-kenya-gray-100 dark:border-kenya-green-800/50 last:border-0"
                    >
                      <span className="mt-0.5 text-base shrink-0" aria-hidden="true">
                        {NOTIFICATION_ICONS[notification.type] || '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-kenya-gray-900 dark:text-kenya-green-50 truncate">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-kenya-green-500" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}

              {/* View all link */}
              <div className="border-t border-kenya-gray-200 dark:border-kenya-green-800 py-1">
                <button
                  onClick={() => { navigate('/tasks'); setShowNotifications(false); }}
                  className="touch-target flex w-full items-center justify-center gap-1 px-4 py-2.5 text-sm font-medium text-kenya-green-600 hover:bg-kenya-gray-50 dark:text-kenya-green-400 dark:hover:bg-kenya-green-900/30 transition-colors"
                >
                  <span>View all notifications</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); setShowCompanySwitcher(false); }}
            className="touch-target flex items-center gap-2 rounded-lg border border-kenya-gray-200 bg-white px-3 py-1.5 hover:bg-kenya-gray-50 dark:border-kenya-green-800 dark:bg-kenya-surface-dark dark:hover:bg-kenya-green-900"
            aria-label={`Profile menu${user?.name ? ' (' + user.name + ')' : ''}`}
            aria-expanded={showProfileMenu}
            aria-haspopup="true"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-kenya-green-100 text-xs font-bold text-kenya-green-700 dark:bg-kenya-green-800 dark:text-kenya-green-300">
              {userInitials}
            </span>
          </button>

          {showProfileMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-kenya-gray-200 bg-white shadow-lg dark:border-kenya-green-800 dark:bg-kenya-surface-dark overflow-hidden"
            >
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
