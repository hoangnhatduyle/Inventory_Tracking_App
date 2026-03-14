import {
  toLocalDateString,
  parseLocalDate,
  daysFromNow,
  todayLocalDateString,
  daysBetween,
  isPastDate,
  isTodayOrFuture
} from './date.utils';

describe('date.utils', () => {
  describe('toLocalDateString', () => {
    it('should convert Date to YYYY-MM-DD format without timezone conversion', () => {
      const date = new Date(2026, 2, 14); // March 14, 2026
      expect(toLocalDateString(date)).toBe('2026-03-14');
    });

    it('should pad month and day with zeros', () => {
      const date = new Date(2026, 0, 5); // January 5, 2026
      expect(toLocalDateString(date)).toBe('2026-01-05');
    });
  });

  describe('parseLocalDate', () => {
    it('should parse YYYY-MM-DD string to Date', () => {
      const result = parseLocalDate('2026-03-14');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(14);
    });

    it('should handle month and day with leading zeros', () => {
      const result = parseLocalDate('2026-01-05');
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(5);
    });
  });

  describe('daysFromNow', () => {
    it('should calculate future dates', () => {
      const future = daysFromNow(7);
      const expected = new Date();
      expected.setDate(expected.getDate() + 7);
      expect(future).toBe(toLocalDateString(expected));
    });

    it('should handle negative days (past dates)', () => {
      const past = daysFromNow(-7);
      const expected = new Date();
      expected.setDate(expected.getDate() - 7);
      expect(past).toBe(toLocalDateString(expected));
    });
  });

  describe('todayLocalDateString', () => {
    it('should return today in YYYY-MM-DD format', () => {
      const today = todayLocalDateString();
      const expected = toLocalDateString(new Date());
      expect(today).toBe(expected);
    });
  });

  describe('daysBetween', () => {
    it('should calculate days between two dates', () => {
      const result = daysBetween('2026-03-07', '2026-03-14');
      expect(result).toBe(7);
    });

    it('should return negative days for past dates', () => {
      const result = daysBetween('2026-03-21', '2026-03-14');
      expect(result).toBeLessThan(0);
    });

    it('should return 0 for same dates', () => {
      const result = daysBetween('2026-03-14', '2026-03-14');
      expect(result).toBe(0);
    });
  });

  describe('isPastDate', () => {
    it('should return true for past dates', () => {
      const yesterday = todayLocalDateString();
      const yesterday_date = parseLocalDate(yesterday);
      yesterday_date.setDate(yesterday_date.getDate() - 1);
      const yesterdayStr = toLocalDateString(yesterday_date);
      expect(isPastDate(yesterdayStr)).toBe(true);
    });

    it('should return false for today or future dates', () => {
      const today = todayLocalDateString();
      expect(isPastDate(today)).toBe(false);
    });
  });

  describe('isTodayOrFuture', () => {
    it('should return true for today', () => {
      const today = todayLocalDateString();
      expect(isTodayOrFuture(today)).toBe(true);
    });

    it('should return true for future dates', () => {
      const future = daysFromNow(7);
      expect(isTodayOrFuture(future)).toBe(true);
    });

    it('should return false for past dates', () => {
      const yesterday = todayLocalDateString();
      const yesterday_date = parseLocalDate(yesterday);
      yesterday_date.setDate(yesterday_date.getDate() - 1);
      const yesterdayStr = toLocalDateString(yesterday_date);
      expect(isTodayOrFuture(yesterdayStr)).toBe(false);
    });
  });
});
