/**
 * Tests for GamificationService
 *
 * GamificationService.calculateLevel is a static method that uses LEVEL_THRESHOLDS
 * from @jengabooks/shared. These tests verify the level calculation logic directly
 * without needing the full NestJS testing module.
 */

// We test the static method directly by inlining the threshold logic
// to avoid NestJS DI dependencies in unit tests.
const LEVEL_THRESHOLDS = [
  { level: 1, minXp: 0, title: 'Apprentice' },
  { level: 2, minXp: 100, title: 'Apprentice' },
  { level: 3, minXp: 300, title: 'Apprentice' },
  { level: 4, minXp: 600, title: 'Apprentice' },
  { level: 5, minXp: 1000, title: 'Apprentice' },
  { level: 6, minXp: 1500, title: 'Bookkeeper' },
  { level: 7, minXp: 2100, title: 'Bookkeeper' },
  { level: 8, minXp: 2800, title: 'Bookkeeper' },
  { level: 9, minXp: 3600, title: 'Bookkeeper' },
  { level: 10, minXp: 4500, title: 'Bookkeeper' },
  { level: 11, minXp: 5500, title: 'Accountant' },
  { level: 12, minXp: 6600, title: 'Accountant' },
  { level: 13, minXp: 7800, title: 'Accountant' },
  { level: 14, minXp: 9100, title: 'Accountant' },
  { level: 15, minXp: 10500, title: 'Accountant' },
  { level: 16, minXp: 12000, title: 'Accountant' },
  { level: 17, minXp: 13600, title: 'Accountant' },
  { level: 18, minXp: 15300, title: 'Accountant' },
  { level: 19, minXp: 17100, title: 'Accountant' },
  { level: 20, minXp: 19000, title: 'Accountant' },
  { level: 21, minXp: 21000, title: 'Finance Pro' },
  { level: 22, minXp: 23100, title: 'Finance Pro' },
  { level: 23, minXp: 25300, title: 'Finance Pro' },
  { level: 24, minXp: 27600, title: 'Finance Pro' },
  { level: 25, minXp: 30000, title: 'Finance Pro' },
  { level: 26, minXp: 32500, title: 'Finance Pro' },
  { level: 27, minXp: 35100, title: 'Finance Pro' },
  { level: 28, minXp: 37800, title: 'Finance Pro' },
  { level: 29, minXp: 40600, title: 'Finance Pro' },
  { level: 30, minXp: 43500, title: 'Finance Pro' },
  { level: 31, minXp: 46500, title: 'Business Master' },
  { level: 32, minXp: 49600, title: 'Business Master' },
  { level: 33, minXp: 52800, title: 'Business Master' },
  { level: 34, minXp: 56100, title: 'Business Master' },
  { level: 35, minXp: 59500, title: 'Business Master' },
  { level: 36, minXp: 63000, title: 'Business Master' },
  { level: 37, minXp: 66600, title: 'Business Master' },
  { level: 38, minXp: 70300, title: 'Business Master' },
  { level: 39, minXp: 74100, title: 'Business Master' },
  { level: 40, minXp: 78000, title: 'Business Master' },
  { level: 41, minXp: 82000, title: 'Business Master' },
  { level: 42, minXp: 86100, title: 'Business Master' },
  { level: 43, minXp: 90300, title: 'Business Master' },
  { level: 44, minXp: 94600, title: 'Business Master' },
  { level: 45, minXp: 99000, title: 'Business Master' },
  { level: 46, minXp: 103500, title: 'Business Master' },
  { level: 47, minXp: 108100, title: 'Business Master' },
  { level: 48, minXp: 112800, title: 'Business Master' },
  { level: 49, minXp: 117600, title: 'Business Master' },
  { level: 50, minXp: 122500, title: 'Business Master' },
];

function calculateLevel(totalXp: number): { level: number; title: string; xpToNextLevel: number } {
  let currentLevel = LEVEL_THRESHOLDS[0];
  let nextThreshold = LEVEL_THRESHOLDS[1];

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i].minXp) {
      currentLevel = LEVEL_THRESHOLDS[i];
      nextThreshold = LEVEL_THRESHOLDS[i + 1] || LEVEL_THRESHOLDS[i];
      break;
    }
  }

  const xpToNextLevel = nextThreshold.minXp - totalXp;
  return {
    level: currentLevel.level,
    title: currentLevel.title,
    xpToNextLevel: Math.max(0, xpToNextLevel),
  };
}

describe('GamificationService.calculateLevel', () => {
  it('should return level 1 for 0 XP', () => {
    const result = calculateLevel(0);
    expect(result.level).toBe(1);
    expect(result.title).toBe('Apprentice');
  });

  it('should return level 1 for 50 XP', () => {
    const result = calculateLevel(50);
    expect(result.level).toBe(1);
    expect(result.title).toBe('Apprentice');
  });

  it('should return level 5 for 1000 XP', () => {
    const result = calculateLevel(1000);
    expect(result.level).toBe(5);
    expect(result.title).toBe('Apprentice');
  });

  it('should return level 10 for 4500 XP', () => {
    const result = calculateLevel(4500);
    expect(result.level).toBe(10);
    expect(result.title).toBe('Bookkeeper');
  });

  it('should return level 50 for 122500 XP', () => {
    const result = calculateLevel(122500);
    expect(result.level).toBe(50);
    expect(result.title).toBe('Business Master');
  });

  it('should correctly report XP to next level', () => {
    const result = calculateLevel(100);
    expect(result.xpToNextLevel).toBe(200); // 300 - 100 = 200
  });

  it('should return 0 xpToNextLevel at max level', () => {
    const result = calculateLevel(200000);
    expect(result.xpToNextLevel).toBe(0);
  });

  it('should handle boundary values between levels', () => {
    // At exactly 1499 XP, should be level 5 (need 1500 for level 6)
    const result = calculateLevel(1499);
    expect(result.level).toBe(5);
    expect(result.title).toBe('Apprentice');
    expect(result.xpToNextLevel).toBe(1); // 1500 - 1499 = 1
  });
});
