// ─── Mocks — must be before any imports for vitest hoisting ──────────────
vi.mock('../stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../stores/ui-store', () => ({
  useUiStore: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../hooks/use-api', () => ({
  useGamificationProfile: vi.fn(() => ({ data: null })),
}));

vi.mock('../lib/api-client', () => ({
  api: {
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock PageShell to render children directly
vi.mock('../components/layout/page-shell', () => ({
  PageShell: ({ title, subtitle, children }: any) => (
    <div data-testid="page-shell">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
}));

// Mock Card components
vi.mock('../components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className}>{children}</h3>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
}));

// Mock EmptyState
vi.mock('../components/ui/empty-state', () => ({
  EmptyState: ({ icon, title, description, action, helpLink }: any) => (
    <div data-testid="empty-state">
      <span>{icon}</span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <button onClick={action.onClick}>{action.label}</button>}
      {helpLink && <a href={helpLink.href}>{helpLink.label}</a>}
    </div>
  ),
}));

// Mock Modal
vi.mock('../components/ui/modal', () => ({
  Modal: ({ isOpen, title, children, footer }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="modal" role="dialog">
        <h2>{title}</h2>
        {children}
        {footer}
      </div>
    );
  },
}));

// ─── Imports ─────────────────────────────────────────────────────────────
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Settings } from '../pages/settings';
import { useAuthStore } from '../stores/auth-store';
import { useUiStore } from '../stores/ui-store';

const mockUserWithCompany = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'SME_OWNER',
  companyId: 'company-1',
  companyName: 'Acme Ltd',
  memberships: [
    { companyId: 'company-1', companyName: 'Acme Ltd', role: 'SME_OWNER' },
  ],
};

const mockUserWithMultipleCompanies = {
  ...mockUserWithCompany,
  memberships: [
    { companyId: 'company-1', companyName: 'Acme Ltd', role: 'SME_OWNER' },
    { companyId: 'company-2', companyName: 'Beta Corp', role: 'ACCOUNTANT' },
  ],
};

const mockUserNoCompany = {
  id: 'user-2',
  email: 'new@example.com',
  name: 'New User',
  role: '',
  companyId: '',
  companyName: '',
  memberships: [],
};

const defaultUiStore = {
  darkMode: false,
  toggleDarkMode: vi.fn(),
  showGamification: true,
  setShowGamification: vi.fn(),
};

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useUiStore as any).mockImplementation((selector: any) => {
      const state = defaultUiStore;
      return selector ? selector(state) : state;
    });
  });

  // ─── Tab Navigation ─────────────────────────────────────────────────

  it('renders all four tab buttons', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
  });

  it('shows Profile tab content by default', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);

    expect(screen.getByText('Company Profile')).toBeInTheDocument();
    expect(screen.getByText('Account Information')).toBeInTheDocument();
  });

  it('switches to Preferences tab when clicked', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);

    fireEvent.click(screen.getByText('Preferences'));
    expect(screen.getByText('Display Preferences')).toBeInTheDocument();
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    expect(screen.getByText('Gamification')).toBeInTheDocument();
  });

  it('switches to Billing tab when clicked', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);

    fireEvent.click(screen.getByText('Billing'));
    expect(screen.getByText('Billing & Subscription')).toBeInTheDocument();
    expect(screen.getByText('Billing information coming soon')).toBeInTheDocument();
  });

  it('switches to Danger Zone tab when clicked', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);

    fireEvent.click(screen.getByText('Danger Zone'));
    expect(screen.getByText('Clear All Imported Data')).toBeInTheDocument();
    expect(screen.getByText('Clear Data')).toBeInTheDocument();
  });

  // ─── Preferences Tab: Toggles ──────────────────────────────────────

  it('renders dark mode toggle in Preferences', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);
    fireEvent.click(screen.getByText('Preferences'));

    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    expect(screen.getByText('Gamification')).toBeInTheDocument();
  });

  it('calls toggleDarkMode when dark mode toggle is clicked', () => {
    const toggleDarkMode = vi.fn();
    (useUiStore as any).mockImplementation((selector: any) => {
      const state = { ...defaultUiStore, toggleDarkMode };
      return selector ? selector(state) : state;
    });
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);
    fireEvent.click(screen.getByText('Preferences'));

    // Find the dark mode toggle switch button
    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]!);
    expect(toggleDarkMode).toHaveBeenCalledTimes(1);
  });

  it('calls setShowGamification when gamification toggle is clicked', () => {
    const setShowGamification = vi.fn();
    (useUiStore as any).mockImplementation((selector: any) => {
      const state = { ...defaultUiStore, setShowGamification };
      return selector ? selector(state) : state;
    });
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);
    fireEvent.click(screen.getByText('Preferences'));

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]!);
    expect(setShowGamification).toHaveBeenCalledTimes(1);
  });

  // ─── Danger Zone: Clear Data Modal ─────────────────────────────────

  it('opens confirmation modal when "Clear Data" is clicked', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);
    fireEvent.click(screen.getByText('Danger Zone'));
    fireEvent.click(screen.getByText('Clear Data'));

    expect(screen.getByText('Clear All Imported Data')).toBeInTheDocument();
    expect(screen.getByText('Type DELETE to confirm')).toBeInTheDocument();
  });

  it('disables confirm button until DELETE is typed', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);
    fireEvent.click(screen.getByText('Danger Zone'));
    fireEvent.click(screen.getByText('Clear Data'));

    // Confirm button should be disabled initially
    const confirmBtn = screen.getByText('Clear All Data');
    expect(confirmBtn).toBeDisabled();

    // Type partial text - still disabled
    const input = screen.getByPlaceholderText('DELETE');
    fireEvent.change(input, { target: { value: 'DEL' } });
    expect(confirmBtn).toBeDisabled();

    // Type full DELETE - now enabled
    fireEvent.change(input, { target: { value: 'DELETE' } });
    expect(confirmBtn).not.toBeDisabled();
  });

  // ─── Edge Case: No Company ─────────────────────────────────────────

  it('shows "No company selected" empty state when user has no company', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserNoCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);

    expect(screen.getByText('No company selected')).toBeInTheDocument();
    expect(screen.getByText('Create New Company')).toBeInTheDocument();
    // Tab buttons should NOT be rendered
    expect(screen.queryByText('Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Danger Zone')).not.toBeInTheDocument();
  });

  // ─── Edge Case: Multiple Companies ─────────────────────────────────

  it('shows company switcher hint for multi-company users in Profile tab', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithMultipleCompanies };
      return selector ? selector(state) : state;
    });

    render(<Settings />);

    expect(screen.getByText(/You have access to 2 companies/)).toBeInTheDocument();
  });

  it('does NOT show company switcher hint for single-company users', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);

    expect(screen.queryByText(/You have access to/)).not.toBeInTheDocument();
  });

  // ─── Create Company not mixed in ───────────────────────────────────

  it('does NOT include "Create New Company" section in settings', () => {
    (useAuthStore as any).mockImplementation((selector: any) => {
      const state = { user: mockUserWithCompany };
      return selector ? selector(state) : state;
    });

    render(<Settings />);

    // The old "Client Onboarding" card with "Create New Company" button should be gone
    expect(screen.queryByText('Client Onboarding')).not.toBeInTheDocument();
    expect(screen.queryByText('+ Create New Company')).not.toBeInTheDocument();
  });
});
