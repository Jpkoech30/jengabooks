import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';

export function Register() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    companyName: '',
  });
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<{ access_token: string; user: any }>('/auth/register', {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        companyName: formData.companyName,
      });

      // Auto-login after registration
      await login(formData.email, formData.password);
      navigate('/', { replace: true });
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Registration failed';
      setError(message);
    } finally {
      setLoading(false);
    }
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
            Create your Kenyan accounting account
          </p>
        </div>

        {/* Register Card */}
        <div className="rounded-2xl border border-kenya-green-100 bg-white p-8 shadow-sm dark:border-kenya-green-800 dark:bg-kenya-surface-dark">
          <h2 className="mb-6 text-lg font-semibold text-kenya-green-900 dark:text-kenya-green-50">
            Get started — it's free
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Full Name"
              placeholder="e.g., Jane Wanjiku"
              value={formData.name}
              onChange={handleChange('name')}
              required
              autoComplete="name"
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="you@company.co.ke"
              value={formData.email}
              onChange={handleChange('email')}
              required
              autoComplete="email"
            />

            <Input
              label="Company Name"
              placeholder="e.g., Acme Enterprises Ltd"
              value={formData.companyName}
              onChange={handleChange('companyName')}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              value={formData.password}
              onChange={handleChange('password')}
              required
              autoComplete="new-password"
              minLength={8}
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
              value={formData.confirmPassword}
              onChange={handleChange('confirmPassword')}
              required
              autoComplete="new-password"
            />

            <Button type="submit" size="lg" className="w-full mt-2" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-kenya-green-600 hover:text-kenya-green-700 dark:text-kenya-green-400">
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-4 rounded-lg bg-kenya-green-50 p-4 text-xs text-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300">
            <p className="font-medium mb-1">🏗️ What you get:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Double-entry accounting for Kenyan businesses</li>
              <li>KRA eTIMS invoice compliance</li>
              <li>M-Pesa transaction import & categorization</li>
              <li>XP rewards & gamification as you learn</li>
              <li>Instant KES 50 XP on signup!</li>
            </ul>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          &copy; {new Date().getFullYear()} JengaBooks. All rights reserved.
        </p>
      </div>
    </div>
  );
}
