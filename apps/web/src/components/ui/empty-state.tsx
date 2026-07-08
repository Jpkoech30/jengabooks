import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';

export interface EmptyStateProps {
  /** Emoji or icon string — defaults to 📋 */
  icon?: string;
  /** Primary heading text */
  title: string;
  /** Supporting explanation */
  description?: string;
  /**
   * Call-to-action button.
   * ⚠️ In practice this should ALWAYS be provided so users have a next step.
   */
  action?: { label: string; onClick: () => void };
  /** Optional "Learn more about [feature]" link displayed below the CTA */
  helpLink?: { label: string; href: string };
  /** Celebratory animation for positive empty states (e.g. HITL "All Clear") */
  animation?: 'confetti' | 'none';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Generates a random confetto (emoji) for the confetti burst animation.
 * Each particle gets a randomised delay, horizontal drift, and scale so
 * the burst feels organic.
 */
function generateConfettiParticles(count = 24) {
  const emojis = ['🎉', '✨', '🎊', '⭐', '🌟', '💫', '✨'];
  return Array.from({ length: count }, (_, i) => {
    const emoji = emojis[i % emojis.length];
    const delay = Math.random() * 0.6;               // 0–0.6 s
    const drift = (Math.random() - 0.5) * 160;        // -80px–80px
    const duration = 0.8 + Math.random() * 0.6;        // 0.8–1.4 s
    const scale = 0.6 + Math.random() * 0.8;           // 0.6–1.4
    return { emoji, delay, drift, duration, scale, key: i };
  });
}

export function EmptyState({
  icon = '📋',
  title,
  description,
  action,
  helpLink,
  animation = 'none',
  className,
}: EmptyStateProps) {
  const hasAnimated = useRef(false);
  const [particles, setParticles] = useState<ReturnType<typeof generateConfettiParticles> | null>(null);

  // Trigger confetti only once on mount
  useEffect(() => {
    if (animation === 'confetti' && !hasAnimated.current) {
      hasAnimated.current = true;
      setParticles(generateConfettiParticles());
    }
  }, [animation]);

  return (
    <div className={cn('relative flex flex-col items-center justify-center py-12 text-center', className)}>
      {/* Confetti burst layer */}
      {animation === 'confetti' && particles && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {particles.map((p) => (
            <span
              key={p.key}
              className="absolute left-1/2 top-1/2 animate-confetti-burst"
              style={
                {
                  '--confetti-delay': `${p.delay}s`,
                  '--confetti-drift': `${p.drift}px`,
                  '--confetti-duration': `${p.duration}s`,
                  '--confetti-scale': p.scale,
                  fontSize: '1.25rem',
                } as React.CSSProperties
              }
            >
              {p.emoji}
            </span>
          ))}
        </div>
      )}

      {/* Icon */}
      <span className="mb-5 text-4xl" aria-hidden="true">{icon}</span>

      {/* Title */}
      <h3 className="mb-2 text-lg font-semibold text-kenya-green-900 dark:text-kenya-green-50">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="mb-6 max-w-sm text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}

      {/* Action CTA */}
      {action && (
        <Button variant="primary" size="md" onClick={action.onClick}>
          {action.label}
        </Button>
      )}

      {/* Contextual help link */}
      {helpLink && (
        <a
          href={helpLink.href}
          className="mt-4 inline-block text-sm text-kenya-gray-600 underline-offset-2 hover:underline dark:text-kenya-gray-400"
          target="_blank"
          rel="noopener noreferrer"
        >
          {helpLink.label}
        </a>
      )}
    </div>
  );
}
