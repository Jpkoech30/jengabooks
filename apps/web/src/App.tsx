import { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth-store';
import { useAuth } from './hooks/use-auth';
import { useUiStore, showToast } from './stores/ui-store';
import { ToastContainer, Toast } from './components/ui/toast';
import { ErrorBoundary } from './components/ui/error-boundary';
import { connectSocket, disconnectSocket } from './lib/socket-client';
import { Sidebar } from './components/layout/sidebar';
import { Header } from './components/layout/header';
import { SyncStatusBanner } from './components/layout/sync-status-banner';

// Lazy-loaded page components — only loaded when their route is visited
const Dashboard = lazy(() => import('./pages/dashboard').then((m) => ({ default: m.Dashboard })));
const Login = lazy(() => import('./pages/login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/register').then((m) => ({ default: m.Register })));
const NotFound = lazy(() => import('./pages/not-found').then((m) => ({ default: m.NotFound })));
const Ledger = lazy(() => import('./pages/ledger').then((m) => ({ default: m.Ledger })));
const Accounts = lazy(() => import('./pages/accounts').then((m) => ({ default: m.Accounts })));
const ETIMS = lazy(() => import('./pages/etims').then((m) => ({ default: m.ETIMS })));
const MpesaImport = lazy(() => import('./pages/mpesa').then((m) => ({ default: m.MpesaImport })));
const HitlHub = lazy(() => import('./pages/hitl-hub').then((m) => ({ default: m.HitlHub })));
const Reports = lazy(() => import('./pages/reports').then((m) => ({ default: m.Reports })));
const Workflow = lazy(() => import('./pages/workflow').then((m) => ({ default: m.Workflow })));
const Team = lazy(() => import('./pages/team').then((m) => ({ default: m.Team })));
const Settings = lazy(() => import('./pages/settings').then((m) => ({ default: m.Settings })));
const Help = lazy(() => import('./pages/help').then((m) => ({ default: m.Help })));
const Payroll = lazy(() => import('./pages/payroll').then((m) => ({ default: m.Payroll })));
const Employees = lazy(() => import('./pages/employees').then((m) => ({ default: m.Employees })));
const PracticeHub = lazy(() => import('./pages/practice').then((m) => ({ default: m.PracticeHub })));
const Tasks = lazy(() => import('./pages/tasks').then((m) => ({ default: m.Tasks })));
const Audit = lazy(() => import('./pages/audit').then((m) => ({ default: m.Audit })));
const Documents = lazy(() => import('./pages/documents').then((m) => ({ default: m.Documents })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30s before refetch
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Loading indicator shown while lazy-loaded page chunks are fetched */
function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-kenya-surface-light dark:bg-kenya-surface-dark">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-kenya-green-500 text-2xl shadow-lg animate-fadeIn">
          <svg className="h-8 w-8 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-gray-500 dark:text-gray-400">Loading page...</p>
      </div>
    </div>
  );
}

function App() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const { isLoading } = useAuth();

  const toasts = useUiStore((state) => state.toasts);
  const removeToast = useUiStore((state) => state.removeToast);
  const companyId = useAuthStore((state) => state.user?.companyId);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Listen for auth:logout events from the API client interceptor
  // This avoids hard page reloads that cause auth loops
  useEffect(() => {
    const handleAuthLogout = () => {
      logout();
    };
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, [logout]);

  // Connect socket.io when authenticated
  const handleNotification = useCallback((data: { title: string; message: string; variant: string }) => {
    showToast(
      data.variant === 'error' ? 'error' : data.variant === 'warning' ? 'warning' : 'info',
      data.title,
      data.message,
    );
  }, []);

  useEffect(() => {
    if (isAuthenticated && companyId) {
      const socket = connectSocket(companyId);

      socket.on('notification', handleNotification);

      return () => {
        socket.off('notification', handleNotification);
        disconnectSocket();
      };
    }
  }, [isAuthenticated, companyId, handleNotification]);

  if (isLoading) {
    return <PageLoading />;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Redirect root to login when not authenticated */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* Proper 404 for unknown routes instead of silently redirecting to login */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
    <div className="flex h-screen">
      {/* Skip-to-content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-kenya-green-500 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <SyncStatusBanner />
        <main id="main-content" key={location.pathname} className="flex-1 overflow-y-auto p-6 scroll-smooth animate-fadeIn" tabIndex={-1}>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/ledger" element={<Ledger />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/etims" element={<ETIMS />} />
              <Route path="/mpesa" element={<MpesaImport />} />
              <Route path="/hitl" element={<HitlHub />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/:category" element={<Reports />} />
              <Route path="/workflow" element={<Workflow />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/team" element={<Team />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/help" element={<Help />} />
              <Route path="/payroll" element={<Payroll />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/practice" element={<PracticeHub />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Toast notifications */}
      <ToastContainer>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            variant={toast.variant}
            title={toast.title}
            message={toast.message}
            duration={toast.duration || 5000}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </ToastContainer>
    </div>
    </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
