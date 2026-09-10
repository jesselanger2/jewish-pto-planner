/**
 * src/domain/dates/isoDate.ts
 *
 * Pure civil-date utilities operating on IsoDate strings (YYYY-MM-DD).
 * NEVER round-trips through UTC timestamps — all arithmetic stays in local
 * civil-date space to remain DST-safe and timezone-safe.
 *
 * These functions are pure (no side effects, no Date.now(), no browser APIs).
 * Tests must inject fixed dates rather than relying on the system clock.
 */
import type { IsoDate } from '../models'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Parse an IsoDate into numeric parts without touching UTC. */
function splitIso(date: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Returns true if `s` is a valid YYYY-MM-DD date string for a date that
 * actually exists (e.g. rejects Feb 30, Apr 31).
 */
export function isValidIsoDate(s: string): s is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12) return false
  const maxDay = daysInMonth(y, m)
  return d >= 1 && d <= maxDay
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/**
 * Build an IsoDate from numeric parts. Throws if the resulting date is
 * invalid.
 */
export function toIsoDate(year: number, month: number, day: number): IsoDate {
  const s = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (!isValidIsoDate(s)) {
    throw new RangeError(`Invalid date: ${year}-${month}-${day}`)
  }
  return s
}

/**
 * Parse an IsoDate string and return its components. Throws if invalid.
 */
export function parseIsoDate(
  date: IsoDate
): { year: number; month: number; day: number } {
  if (!isValidIsoDate(date)) {
    throw new RangeError(`Invalid IsoDate: "${date}"`)
  }
  return splitIso(date)
}

/**
 * Convert a JS Date object to an IsoDate using an IANA timezone string.
 * This correctly handles dates near midnight in any timezone without
 * letting UTC conversion shift the civil date.
 */
export function isoDateFromDate(d: Date, tz: string): IsoDate {
  // Use Intl to get the civil date in the target timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}` as IsoDate
}

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

/** Returns true if the given year is a leap year. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Returns the number of days in the given month (1-indexed) of the year. */
export function daysInMonth(year: number, month: number): number {
  const counts = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2 && isLeapYear(year)) return 29
  return counts[month]
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

/**
 * Add `n` days to `date` (may be negative). Returns an IsoDate.
 * DST-safe: operates entirely in civil-date space, never via timestamps.
 */
export function addDays(date: IsoDate, n: number): IsoDate {
  if (n === 0) return date
  let { year, month, day } = parseIsoDate(date)
  let remaining = n

  if (remaining > 0) {
    while (remaining > 0) {
      const dim = daysInMonth(year, month)
      const daysLeftInMonth = dim - day
      if (remaining <= daysLeftInMonth) {
        day += remaining
        remaining = 0
      } else {
        remaining -= daysLeftInMonth + 1
        day = 1
        month++
        if (month > 12) {
          month = 1
          year++
        }
      }
    }
  } else {
    remaining = -remaining
    while (remaining > 0) {
      if (remaining < day) {
        day -= remaining
        remaining = 0
      } else {
        remaining -= day
        month--
        if (month < 1) {
          month = 12
          year--
        }
        day = daysInMonth(year, month)
      }
    }
  }

  return toIsoDate(year, month, day)
}

/**
 * Returns b - a in days (positive if b > a, negative if b < a).
 */
export function diffDays(a: IsoDate, b: IsoDate): number {
  // Use noon timestamps to avoid DST shift at midnight flipping the day
  const msA = new Date(`${a}T12:00:00Z`).getTime()
  const msB = new Date(`${b}T12:00:00Z`).getTime()
  return Math.round((msB - msA) / 86_400_000)
}

/**
 * Compare two IsoDate strings chronologically.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 */
export function compareDates(a: IsoDate, b: IsoDate): -1 | 0 | 1 {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * Returns an array of every IsoDate in [start, end] inclusive.
 * Returns empty array if start > end.
 */
export function isoDateRange(start: IsoDate, end: IsoDate): IsoDate[] {
  if (compareDates(start, end) > 0) return []
  const result: IsoDate[] = []
  let current = start
  while (compareDates(current, end) <= 0) {
    result.push(current)
    current = addDays(current, 1)
  }
  return result
}

/**
 * Returns the day-of-week index for an IsoDate (0 = Sunday, 6 = Saturday).
 * Uses UTC noon to avoid DST shifts.
 */
export function dayOfWeek(date: IsoDate): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay()
}

/**
 * Returns the minimum of two IsoDate strings.
 */
export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareDates(a, b) <= 0 ? a : b
}

/**
 * Returns the maximum of two IsoDate strings.
 */
export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return compareDates(a, b) >= 0 ? a : b
}
