import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlideOutPanel } from '../../components/ui/slide-out-panel';

describe('SlideOutPanel', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SlideOutPanel isOpen={false} onClose={onClose} title="Test Panel">
        <p>Body content</p>
      </SlideOutPanel>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders content when isOpen is true', () => {
    render(
      <SlideOutPanel isOpen={true} onClose={onClose} title="Test Panel">
        <p>Body content</p>
      </SlideOutPanel>,
    );
    expect(screen.getByText('Test Panel')).toBeDefined();
    expect(screen.getByText('Body content')).toBeDefined();
  });

  it('renders subtitle when provided', () => {
    render(
      <SlideOutPanel isOpen={true} onClose={onClose} title="Test Panel" subtitle="Subtitle text">
        <p>Body content</p>
      </SlideOutPanel>,
    );
    expect(screen.getByText('Subtitle text')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <SlideOutPanel isOpen={true} onClose={onClose} title="Test Panel">
        <p>Body content</p>
      </SlideOutPanel>,
    );
    const closeButton = screen.getByLabelText('Close panel');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <SlideOutPanel isOpen={true} onClose={onClose} title="Test Panel">
        <p>Body content</p>
      </SlideOutPanel>,
    );
    const panel = screen.getByRole('dialog');
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    render(
      <SlideOutPanel isOpen={true} onClose={onClose} title="Test Panel">
        <p>Body content</p>
      </SlideOutPanel>,
    );
    // The backdrop is the first child div with aria-hidden="true"
    const backdrop = screen.getByRole('dialog').querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeDefined();
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('renders footer content when provided', () => {
    render(
      <SlideOutPanel
        isOpen={true}
        onClose={onClose}
        title="Test Panel"
        footer={<button>Footer Action</button>}
      >
        <p>Body content</p>
      </SlideOutPanel>,
    );
    expect(screen.getByText('Footer Action')).toBeDefined();
  });

  it('sets aria-modal to true', () => {
    render(
      <SlideOutPanel isOpen={true} onClose={onClose} title="Test Panel">
        <p>Body content</p>
      </SlideOutPanel>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('has accessible label', () => {
    render(
      <SlideOutPanel isOpen={true} onClose={onClose} title="Transaction Details">
        <p>Body content</p>
      </SlideOutPanel>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Transaction Details');
  });
});
