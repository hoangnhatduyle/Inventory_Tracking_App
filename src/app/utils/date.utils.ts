/**
 * Timezone-safe date utilities
 * All functions work with local dates (YYYY-MM-DD format) without timezone conversion
 */

/**
 * Convert a Date to a local date string (YYYY-MM-DD)
 * Avoids timezone conversion by using local date components
 * @param date The Date object to convert
 * @returns Date string in YYYY-MM-DD format
 */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a local date string (YYYY-MM-DD) back to a Date object
 * Interprets the date as local time, not UTC
 * @param dateString Date string in YYYY-MM-DD format
 * @returns Date object set to midnight local time on that date
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate a date N days from now
 * @param daysFromNow Number of days in the future (can be negative for past dates)
 * @returns Date string in YYYY-MM-DD format
 */
export function daysFromNow(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return toLocalDateString(date);
}

/**
 * Get today's date as a local date string
 * @returns Today's date in YYYY-MM-DD format
 */
export function todayLocalDateString(): string {
  return toLocalDateString(new Date());
}

/**
 * Calculate number of days between two local date strings
 * @param startDate Date string in YYYY-MM-DD format
 * @param endDate Date string in YYYY-MM-DD format
 * @returns Number of days (positive if endDate > startDate)
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Check if a date string is in the past (relative to today)
 * @param dateString Date string in YYYY-MM-DD format
 * @returns true if the date is before today
 */
export function isPastDate(dateString: string): boolean {
  const date = parseLocalDate(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if a date string is today or in the future
 * @param dateString Date string in YYYY-MM-DD format
 * @returns true if the date is today or after
 */
export function isTodayOrFuture(dateString: string): boolean {
  return !isPastDate(dateString) || dateString === toLocalDateString(new Date());
}
