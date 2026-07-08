// Mock the API client module — must be before any imports that use it
vi.mock('../lib/api-client', () => {
  const mockGet = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/ledger/trial-balance')) {
      return Promise.resolve({ totalDebits: 1000, totalCredits: 1000, balanced: true });
    }
    if (url.includes('/ledger/entries')) {
      return Promise.resolve({ items: [], total: 0 });
    }
    if (url.includes('/gamification/profile')) {
      return Promise.resolve({ score: 100, level: 2, xpToNextLevel: 200 });
    }
    if (url.includes('/health-score')) {
      return Promise.resolve({ overallScore: 75, pillars: [] });
    }
    if (url.includes('/wizard/progress')) {
      return Promise.resolve({ percentage: 50, completedSteps: 5, totalSteps: 10, nextStep: { label: 'Test' }, isComplete: false });
    }
    if (url.includes('/gamification/badges')) {
      return Promise.resolve({ earned: [], available: [] });
    }
    return Promise.reject(new Error('Unknown URL'));
  });

  return {
    api: {
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    apiClient: {
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    },
  };
});

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const { Dashboard } = await import('../pages/dashboard');

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render skeleton on initial load', () => {
    renderWithProviders(React.createElement(Dashboard));
    // The skeleton renders aria-label="Loading" elements
    const skeletons = screen.getAllByRole('status');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render dashboard data after loading', async () => {
    renderWithProviders(React.createElement(Dashboard));
    // Wait for data to load — "Transactions" label from KPI card
    const transactionsLabel = await screen.findByText('Transactions');
    expect(transactionsLabel).toBeInTheDocument();
  });

  it('should show trial balance summary', async () => {
    renderWithProviders(React.createElement(Dashboard));
    // Wait for data to load — KPI cards render
    const debitsLabel = await screen.findByText('Debits');
    expect(debitsLabel).toBeInTheDocument();
    const creditsLabel = await screen.findByText('Credits');
    expect(creditsLabel).toBeInTheDocument();
  });

  it('should handle API failures gracefully without crashing', async () => {
    const { api } = await import('../lib/api-client');
    vi.mocked(api.get).mockRejectedValue(new Error('API Error'));

    renderWithProviders(React.createElement(Dashboard));
    // Should not crash — fallback data should render
    const entriesLabel = await screen.findByText('Transactions');
    expect(entriesLabel).toBeInTheDocument();
  });
});
