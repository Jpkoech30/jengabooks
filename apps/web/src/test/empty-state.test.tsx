import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../components/ui/empty-state';

describe('EmptyState', () => {
  const defaultProps = { title: 'No data found', description: 'There are no items to display.' };

  it('renders icon, title, and description', () => {
    render(<EmptyState {...defaultProps} icon="📒" />);
    expect(screen.getByText('📒')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No data found' })).toBeInTheDocument();
  });

  it('uses default icon when none is provided', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.getByText('📋')).toBeInTheDocument();
  });

  it('renders CTA button when action is provided', () => {
    const onClick = vi.fn();
    render(<EmptyState {...defaultProps} action={{ label: 'Add Income', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Income' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not render CTA when action is omitted', () => {
    render(<EmptyState {...defaultProps} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders help link when helpLink is provided', () => {
    render(
      <EmptyState
        {...defaultProps}
        helpLink={{ label: 'Learn more about Ledger', href: '/help/ledger' }}
      />,
    );
    const link = screen.getByRole('link', { name: 'Learn more about Ledger' });
    expect(link).toHaveAttribute('href', '/help/ledger');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders both CTA and help link together', () => {
    render(
      <EmptyState
        {...defaultProps}
        action={{ label: 'Go', onClick: vi.fn() }}
        helpLink={{ label: 'Help', href: '/help' }}
      />,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<EmptyState {...defaultProps} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('uses text-4xl for icon sizing', () => {
    render(<EmptyState {...defaultProps} icon="🎉" />);
    expect(screen.getByText('🎉')).toHaveClass('text-4xl');
  });

  it('renders confetti particles when animation is confetti', () => {
    render(<EmptyState {...defaultProps} animation="confetti" />);
    expect(document.querySelectorAll('.animate-confetti-burst').length).toBe(24);
  });
});
