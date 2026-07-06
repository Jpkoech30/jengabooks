import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuthStore } from '../stores/auth-store';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const { login, isLoading, error, clearError, isAuthenticated } = useAuthStore();

  // Redirect to dashboard when authentication succeeds
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-kenya-surface-light p-4 dark:bg-kenya-surface-dark">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-kenya-green-500 text-2xl shadow-lg">
            📚
          </div>
          <h1 className="text-2xl font-bold text-kenya-green-900 dark:text-kenya-green-50">
            JengaBooks
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kenyan Accounting Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-kenya-green-100 bg-white p-8 shadow-sm dark:border-kenya-green-800 dark:bg-kenya-surface-dark">
          <h2 className="mb-6 text-lg font-semibold text-kenya-green-900 dark:text-kenya-green-50">
            Sign in to your account
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@company.co.ke"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input type="checkbox" className="h-4 w-4 rounded border-kenya-green-300 text-kenya-green-500" />
                Remember me
              </label>
              <button type="button" className="text-sm font-medium text-kenya-green-600 hover:text-kenya-green-700 dark:text-kenya-green-400">
                Forgot password?
              </button>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-kenya-green-600 hover:text-kenya-green-700 dark:text-kenya-green-400">
                Create one
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          &copy; {new Date().getFullYear()} JengaBooks. All rights reserved.
        </p>
      </div>
    </div>
  );
}
