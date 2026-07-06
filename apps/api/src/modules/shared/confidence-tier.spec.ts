/**
 * Confidence Tier Tests
 *
 * 3-tier color coding:
 * - Green (>= 0.9): High confidence — auto-posted
 * - Yellow (0.7 to 0.9): Medium confidence — flagged for review
 * - Red (< 0.7): Low confidence — sent to HITL
 */

type ConfidenceTier = 'high' | 'medium' | 'low';

function getConfidenceTier(confidence: number | null | undefined): ConfidenceTier {
  if (confidence == null) return 'low';
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

function getConfidenceColor(tier: ConfidenceTier): string {
  switch (tier) {
    case 'high': return 'green';
    case 'medium': return 'amber';
    case 'low': return 'red';
  }
}

describe('3-Tier Confidence Badge', () => {
  describe('getConfidenceTier', () => {
    it('should return high for confidence >= 0.9', () => {
      expect(getConfidenceTier(0.95)).toBe('high');
      expect(getConfidenceTier(0.9)).toBe('high');
    });

    it('should return medium for confidence 0.7 to 0.9', () => {
      expect(getConfidenceTier(0.85)).toBe('medium');
      expect(getConfidenceTier(0.7)).toBe('medium');
    });

    it('should return low for confidence < 0.7', () => {
      expect(getConfidenceTier(0.65)).toBe('low');
      expect(getConfidenceTier(0.3)).toBe('low');
      expect(getConfidenceTier(0)).toBe('low');
    });

    it('should return low for null/undefined confidence', () => {
      expect(getConfidenceTier(null)).toBe('low');
      expect(getConfidenceTier(undefined)).toBe('low');
    });

    it('should return low for negative confidence', () => {
      expect(getConfidenceTier(-0.5)).toBe('low');
    });
  });

  describe('getConfidenceColor', () => {
    it('should map high to green', () => {
      expect(getConfidenceColor('high')).toBe('green');
    });

    it('should map medium to amber', () => {
      expect(getConfidenceColor('medium')).toBe('amber');
    });

    it('should map low to red', () => {
      expect(getConfidenceColor('low')).toBe('red');
    });
  });
});
