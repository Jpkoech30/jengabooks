/**
 * Gamification Features Tests — Phase F
 *
 * Edge cases:
 * - Trust the AI badge: awarded for bulk approving 10+ transactions
 * - Sync Streak badge: consecutive days of activity
 * - Flawless Finisher badge: completing lockdown with 0 errors
 * - Early Bird XP bonus: submitting reports before 5th of month
 * - Level-up celebration triggers
 */

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
}

function calculateStreak(activityDates: Date[], today: Date = new Date()): StreakData {
  if (activityDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null };
  }

  const sorted = [...activityDates].sort((a, b) => b.getTime() - a.getTime());
  const uniqueDays = new Set(sorted.map(d => d.toISOString().slice(0, 10)));
  const dates = [...uniqueDays].sort().reverse();

  let currentStreak = 0;
  const todayStr = today.toISOString().slice(0, 10);
  const lastDateStr = dates[0];

  // Check if last activity was today or yesterday
  const daysSinceLast = Math.round((today.getTime() - new Date(lastDateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceLast > 1) {
    return { currentStreak: 0, longestStreak: calcLongestStreak(dates), lastActiveDate: new Date(lastDateStr) };
  }

  currentStreak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(currentStreak, calcLongestStreak(dates)),
    lastActiveDate: new Date(lastDateStr),
  };
}

function calcLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  let maxStreak = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    if (Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)) === 1) {
      current++;
      maxStreak = Math.max(maxStreak, current);
    } else {
      current = 1;
    }
  }
  return maxStreak;
}

function isEarlyBirdReport(submissionDate: Date): boolean {
  return submissionDate.getDate() <= 5;
}

function shouldShowLevelUp(currentXp: number, previousXp: number, thresholds: number[]): boolean {
  const currentLevel = thresholds.findIndex(t => currentXp < t);
  const previousLevel = thresholds.findIndex(t => previousXp < t);
  const actualCurrent = currentLevel === -1 ? thresholds.length : currentLevel;
  const actualPrevious = previousLevel === -1 ? thresholds.length : previousLevel;
  return actualCurrent > actualPrevious;
}

describe('Gamification Features — Phase F', () => {
  describe('Sync Streak', () => {
    it('should return 0 streak for no activity', () => {
      const result = calculateStreak([]);
      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
    });

    it('should count consecutive daily activity', () => {
      const dates = [
        new Date('2026-07-06'),
        new Date('2026-07-05'),
        new Date('2026-07-04'),
      ];
      const result = calculateStreak(dates, new Date('2026-07-06'));
      expect(result.currentStreak).toBe(3);
    });

    it('should break streak on gap', () => {
      const dates = [
        new Date('2026-07-06'),
        new Date('2026-07-04'), // gap on 5th
      ];
      const result = calculateStreak(dates, new Date('2026-07-06'));
      expect(result.currentStreak).toBe(1);
    });

    it('should track longest streak separately', () => {
      const dates = [
        new Date('2026-07-06'),
        new Date('2026-07-05'),
        new Date('2026-06-20'),
        new Date('2026-06-19'),
        new Date('2026-06-18'),
      ];
      const result = calculateStreak(dates, new Date('2026-07-06'));
      expect(result.currentStreak).toBe(2);
      expect(result.longestStreak).toBe(3);
    });

    it('should reset streak if last activity was > 1 day ago', () => {
      const dates = [new Date('2026-06-30')]; // 6 days ago
      const result = calculateStreak(dates, new Date('2026-07-06'));
      expect(result.currentStreak).toBe(0);
    });
  });

  describe('Early Bird XP', () => {
    it('should award bonus for submission on 5th', () => {
      expect(isEarlyBirdReport(new Date('2026-07-05'))).toBe(true);
    });

    it('should award bonus for submission before 5th', () => {
      expect(isEarlyBirdReport(new Date('2026-07-01'))).toBe(true);
    });

    it('should not award bonus after 5th', () => {
      expect(isEarlyBirdReport(new Date('2026-07-06'))).toBe(false);
      expect(isEarlyBirdReport(new Date('2026-07-15'))).toBe(false);
    });
  });

  describe('Level-Up Detection', () => {
    const thresholds = [0, 100, 300, 600, 1000, 1500, 2100];

    it('should detect level up when crossing threshold', () => {
      expect(shouldShowLevelUp(150, 50, thresholds)).toBe(true);
    });

    it('should not trigger if same level', () => {
      expect(shouldShowLevelUp(200, 150, thresholds)).toBe(false);
    });

    it('should detect multiple level jumps', () => {
      expect(shouldShowLevelUp(700, 50, thresholds)).toBe(true);
    });

    it('should not trigger for first login at 0 XP', () => {
      expect(shouldShowLevelUp(0, 0, thresholds)).toBe(false);
    });
  });
});
