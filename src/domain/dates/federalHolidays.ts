/**
 * src/domain/dates/federalHolidays.ts
 *
 * Computes the set of US federal holidays for a given Gregorian year,
 * returning the OBSERVED date (the day that actually closes federal
 * offices) per the OPM / US Code title 5 § 6103 algorithm:
 *   - If the statutory date falls on Saturday, the observed date is Friday.
 *   - If the statutory date falls on Sunday, the observed date is Monday.
 *   - Nth-weekday rules (e.g. 3rd Monday in January) already land on a weekday.
 *
 * All logic is pure — no side effects, no Date.now(). Tests inject a fixed
 * year.
 */

import type { IsoDate } from '../models'
import { toIsoDate, dayOfWeek, addDays } from './isoDate'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Day-of-week indices matching JS Date.getUTCDay() / our dayOfWeek(). */
const SAT = 6
const SUN = 0

/**
 * Apply the OPM observed-day shift to a fixed-date federal holiday.
 * Saturday → Friday, Sunday → Monday, any other day → itself.
 */
function observedDate(date: IsoDate): IsoDate {
  const dow = dayOfWeek(date)
  if (dow === SAT) return addDays(date, -1) // observed Friday
  if (dow === SUN) return addDays(date, 1) // observed Monday
  return date
}

/**
 * Returns the date of the Nth occurrence of a given day-of-week in a
 * calendar month (e.g. 3rd Monday of January 2024).
 *
 * @param year  Gregorian year
 * @param month 1-indexed month
 * @param nth   Ordinal (1 = first, 2 = second … -1 = last)
 * @param dow   Day of week (0 = Sun, 6 = Sat)
 */
function nthWeekday(
  year: number,
  month: number,
  nth: number,
  dow: number
): IsoDate {
  if (nth > 0) {
    // Start from the 1st of the month
    const firstDay = toIsoDate(year, month, 1)
    const firstDow = dayOfWeek(firstDay)
    // Days until the first occurrence of `dow`
    const daysToFirst = (dow - firstDow + 7) % 7
    const firstOccurrence = addDays(firstDay, daysToFirst)
    return addDays(firstOccurrence, (nth - 1) * 7)
  } else {
    // nth === -1 means "last occurrence"
    // Start from the last day of the month and walk backwards
    const daysInMonth = new Date(year, month, 0).getDate()
    const lastDay = toIsoDate(year, month, daysInMonth)
    const lastDow = dayOfWeek(lastDay)
    const daysBack = (lastDow - dow + 7) % 7
    return addDays(lastDay, -daysBack)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FederalHoliday {
  /** Statutory (calendar) date */
  statutoryDate: IsoDate
  /** Date offices are actually closed (post observed-day shift) */
  observedDate: IsoDate
  name: string
}

/**
 * Returns a map from observed IsoDate → holiday name for all 11 US federal
 * holidays in the given Gregorian year.
 *
 * The map key is the **observed** date so that `classifyDay` can do an
 * O(1) lookup.
 */
export function getUSFederalHolidays(
  year: number
): Map<IsoDate, FederalHoliday> {
  const holidays: FederalHoliday[] = [
    // 1. New Year's Day — January 1
    {
      name: "New Year's Day",
      statutoryDate: toIsoDate(year, 1, 1),
      observedDate: observedDate(toIsoDate(year, 1, 1)),
    },
    // 2. Martin Luther King Jr. Day — 3rd Monday in January
    {
      name: 'Martin Luther King Jr. Day',
      statutoryDate: nthWeekday(year, 1, 3, 1),
      observedDate: nthWeekday(year, 1, 3, 1),
    },
    // 3. Presidents' Day (Washington's Birthday) — 3rd Monday in February
    {
      name: "Presidents' Day",
      statutoryDate: nthWeekday(year, 2, 3, 1),
      observedDate: nthWeekday(year, 2, 3, 1),
    },
    // 4. Memorial Day — last Monday in May
    {
      name: 'Memorial Day',
      statutoryDate: nthWeekday(year, 5, -1, 1),
      observedDate: nthWeekday(year, 5, -1, 1),
    },
    // 5. Juneteenth — June 19 (federal since 2021)
    {
      name: 'Juneteenth National Independence Day',
      statutoryDate: toIsoDate(year, 6, 19),
      observedDate: observedDate(toIsoDate(year, 6, 19)),
    },
    // 6. Independence Day — July 4
    {
      name: 'Independence Day',
      statutoryDate: toIsoDate(year, 7, 4),
      observedDate: observedDate(toIsoDate(year, 7, 4)),
    },
    // 7. Labor Day — 1st Monday in September
    {
      name: 'Labor Day',
      statutoryDate: nthWeekday(year, 9, 1, 1),
      observedDate: nthWeekday(year, 9, 1, 1),
    },
    // 8. Columbus Day — 2nd Monday in October
    {
      name: 'Columbus Day',
      statutoryDate: nthWeekday(year, 10, 2, 1),
      observedDate: nthWeekday(year, 10, 2, 1),
    },
    // 9. Veterans Day — November 11
    {
      name: 'Veterans Day',
      statutoryDate: toIsoDate(year, 11, 11),
      observedDate: observedDate(toIsoDate(year, 11, 11)),
    },
    // 10. Thanksgiving Day — 4th Thursday in November
    {
      name: 'Thanksgiving Day',
      statutoryDate: nthWeekday(year, 11, 4, 4),
      observedDate: nthWeekday(year, 11, 4, 4),
    },
    // 11. Christmas Day — December 25
    {
      name: 'Christmas Day',
      statutoryDate: toIsoDate(year, 12, 25),
      observedDate: observedDate(toIsoDate(year, 12, 25)),
    },
  ]

  const map = new Map<IsoDate, FederalHoliday>()
  for (const h of holidays) {
    map.set(h.observedDate, h)
  }
  return map
}
