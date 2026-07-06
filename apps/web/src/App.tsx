import { useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth-store';
import { useAuth } from './hooks/use-auth';
import { useUiStore, showToast } from './stores/ui-store';
import { ToastContainer, Toast } from './components/ui/toast';
import { ErrorBoundary } from './components/ui/error-boundary';
import { connectSocket, disconnectSocket } from './lib/socket-client';
import { Dashboard } from './pages/dashboard';
import { Login } from './pages/login';
import { Register } from './pages/register';
import { NotFound } from './pages/not-found';
import { Ledger } from './pages/ledger';
import { Accounts } from './pages/accounts';
import { ETIMS } from './pages/etims';
import { MpesaImport } from './pages/mpesa';
import { HitlHub } from './pages/hitl-hub';
import { Reports } from './pages/reports';
import { Team } from './pages/team';
import { Settings } from './pages/settings';
import { Help } from './pages/help';
import { Sidebar } from './components/layout/sidebar';
import { Header } from './components/layout/header';
import { SyncStatusBanner } from './components/layout/sync-status-banner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30s before refetch
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const { isLoading } = useAuth();

  const toasts = useUiStore((state) => state.toasts);
  const removeToast = useUiStore((state) => state.removeToast);
  const companyId = useAuthStore((state) => state.user?.companyId);

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
    return (
      <div className="flex min-h-screen items-center justify-center bg-kenya-surface-light dark:bg-kenya-surface-dark">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-kenya-green-500 text-2xl shadow-lg animate-pulse">
            📚
          </div>
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* Proper 404 for unknown routes instead of silently redirecting to login */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <SyncStatusBanner />
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/ledger" element={<Ledger />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/etims" element={<ETIMS />} />
            <Route path="/mpesa" element={<MpesaImport />} />
            <Route path="/hitl" element={<HitlHub />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/team" element={<Team />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
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
