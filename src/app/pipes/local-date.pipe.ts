import { Pipe, PipeTransform } from '@angular/core';
import { DatePipe } from '@angular/common';
import { parseLocalDate } from '../utils/date.utils';

/**
 * A date formatting pipe that correctly handles YYYY-MM-DD date strings by
 * parsing them as LOCAL midnight (not UTC midnight).
 *
 * Problem it solves: Angular's built-in `| date` pipe parses plain date strings
 * (e.g. '2026-03-25') as UTC midnight via `new Date(string)`. In timezones with
 * a negative UTC offset this results in displaying the previous day.
 *
 * Usage:
 *   {{ item.expirationDate | localDate }}              → "Mar 25, 2026"
 *   {{ item.expirationDate | localDate:'shortDate' }}  → "3/25/26"
 *   {{ item.expirationDate | localDate:'MMM d' }}      → "Mar 25"
 *
 * Full ISO timestamps and Date objects are passed through unchanged —
 * Angular's DatePipe already handles those correctly.
 */
@Pipe({ name: 'localDate', standalone: true, pure: true })
export class LocalDatePipe implements PipeTransform {
  private readonly datePipe = new DatePipe('en-US');

  transform(value: string | Date | null | undefined, format = 'mediumDate'): string | null {
    if (!value) return null;

    // YYYY-MM-DD only: parse as LOCAL midnight to avoid UTC -1 day in negative-offset timezones
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return this.datePipe.transform(parseLocalDate(value), format);
    }

    // Date objects and ISO timestamps (contain 'T'): pass through — DatePipe handles correctly
    return this.datePipe.transform(value as Date | string, format);
  }
}
