import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-kenya-surface-light dark:bg-kenya-surface-dark">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-kenya-red-100 dark:bg-kenya-red-900/30">
          <span className="text-5xl">📋</span>
        </div>
        <h1 className="mb-2 text-6xl font-bold text-gray-900 dark:text-white">404</h1>
        <p className="mb-2 text-xl text-gray-600 dark:text-gray-400">Page not found</p>
        <p className="mb-8 text-sm text-gray-500 dark:text-gray-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" onClick={() => navigate(-1)}>
            ← Go Back
          </Button>
          <Button onClick={() => navigate('/')}>
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
