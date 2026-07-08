// Mock the API client module — must be before any imports that use it
vi.mock('../lib/api-client', () => {
  const mockGet = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/dashboard/summary')) {
      return Promise.resolve({
        entries: {
          total: 25,
          recent: [
            {
              id: '1',
              description: 'M-Pesa payment from ABC',
              amount: 5000,
              direction: 'CREDIT',
              entryDate: '2026-06-12T10:00:00.000Z',
              account: { code: '4000', name: 'Sales Revenue' },
            },
            {
              id: '2',
              description: 'Rent expense',
              amount: 50000,
              direction: 'DEBIT',
              entryDate: '2026-06-11T10:00:00.000Z',
              account: { code: '6000', name: 'Rent Expense' },
            },
          ],
        },
        monthlySummary: {
          totalIncome: 75000,
          totalExpenses: 25000,
          netProfit: 50000,
        },
        mpesaUncleaned: 2,
        gamification: {
          score: 500,
          level: 2,
          xpToNextLevel: 500,
        },
        healthScore: {
          overallScore: 75,
          pillars: [],
        },
        wizard: {
          percentage: 80,
          completedSteps: 8,
          totalSteps: 10,
          nextStep: { label: 'Categorize 12 entries' },
          isComplete: false,
        },
      });
    }
    if (url.includes('/companies/firm/dashboard')) {
      return Promise.resolve({
        totalClients: 5,
        needingAttention: 2,
        totalPendingReviews: 3,
        totalFailedEtims: 0,
        clients: [],
      });
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

// Mock the auth store to provide a logged-in user
const mockSwitchCompany = vi.fn().mockResolvedValue(true);

vi.mock('../stores/auth-store', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'SME_OWNER',
        companyId: 'company-1',
        companyName: 'Test Company',
        memberships: [{ companyId: 'company-1', companyName: 'Test Company', role: 'SME_OWNER' }],
      },
      token: null,
      refreshToken: null,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      switchCompany: mockSwitchCompany,
      login: vi.fn(),
      logout: vi.fn(),
      setUser: vi.fn(),
      clearError: vi.fn(),
      hydrateFromToken: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

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
    // The skeleton renders role="status" elements
    const skeletons = screen.getAllByRole('status');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render KPI cards after loading', async () => {
    renderWithProviders(React.createElement(Dashboard));
    // Wait for data to load — KPI card labels
    const incomeLabel = await screen.findByText('Income');
    expect(incomeLabel).toBeInTheDocument();
    const expensesLabel = await screen.findByText('Expenses');
    expect(expensesLabel).toBeInTheDocument();
    const netProfitLabel = await screen.findByText('Net Profit');
    expect(netProfitLabel).toBeInTheDocument();
  });

  it('should show M-Pesa uncleaned count in KPI cards', async () => {
    renderWithProviders(React.createElement(Dashboard));
    // The M-Pesa card shows link text when there are uncleaned transactions
    const mpesaLink = await screen.findByText('M-Pesa to map');
    expect(mpesaLink).toBeInTheDocument();
  });

  it('should render recent activity after loading', async () => {
    renderWithProviders(React.createElement(Dashboard));
    // Wait for recent activity section
    const activityTitle = await screen.findByText('Recent Activity');
    expect(activityTitle).toBeInTheDocument();
    // One of the recent entries should be visible
    const paymentDesc = await screen.findByText('M-Pesa payment from ABC');
    expect(paymentDesc).toBeInTheDocument();
  });

  it('should show Month-End Progress section', async () => {
    renderWithProviders(React.createElement(Dashboard));
    // Month-End Progress should be visible
    const monthEndTitle = await screen.findByText('📋 Month-End Progress');
    expect(monthEndTitle).toBeInTheDocument();
  });

  it('should handle API failures gracefully without crashing', async () => {
    const { api } = await import('../lib/api-client');
    vi.mocked(api.get).mockRejectedValue(new Error('API Error'));

    renderWithProviders(React.createElement(Dashboard));
    // Should not crash — fallback data should render with the welcome title
    // When API fails, summary falls back to { total: 0, recent: [] } which shows the new user state
    const welcomeTitle = await screen.findByText('Welcome to JengaBooks');
    expect(welcomeTitle).toBeInTheDocument();
  });
});
