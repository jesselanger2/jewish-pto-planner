/**
 * src/domain/dates/workday.ts
 *
 * `classifyDay(date, employerPolicy)` is the ONE authoritative classifier
 * for every UI and engine decision. It returns the DayClassification and a
 * human-readable reason.
 *
 * Priority order (highest wins):
 *   1. Custom closure  — user-entered; beats everything else.
 *   2. Company holiday — employer-specific; beats generated calendars.
 *   3. Weekend         — configurable weekendDays array.
 *   4. US federal holiday — only when useUSFederalHolidays is true,
 *                           uses OPM observed-date algorithm.
 *   5. Workday         — default.
 *
 * Pure function — no side effects, no browser APIs.
 */

import type { IsoDate, DayClassification, EmployerPolicy } from '../models'
import { dayOfWeek } from './isoDate'
import { parseIsoDate } from './isoDate'
import { getUSFederalHolidays } from './federalHolidays'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ClassifyDayResult {
  classification: DayClassification
  reason: string
}

// ---------------------------------------------------------------------------
// Cache for federal holiday maps (keyed by year)
// ---------------------------------------------------------------------------

const federalHolidayCache = new Map<number, Map<IsoDate, { name: string }>>()

function getFederalHolidayMap(year: number): Map<IsoDate, { name: string }> {
  if (!federalHolidayCache.has(year)) {
    federalHolidayCache.set(year, getUSFederalHolidays(year))
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return federalHolidayCache.get(year)!
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classifies a single civil date against the given employer policy.
 *
 * All inputs are plain values — no React state, no DB calls.
 *
 * @param date   Civil IsoDate to classify (YYYY-MM-DD)
 * @param policy The employer's EmployerPolicy
 * @returns      Classification + human-readable reason
 */
export function classifyDay(
  date: IsoDate,
  policy: EmployerPolicy
): ClassifyDayResult {
  // 1. Custom closures — authoritative override
  const customClosure = policy.customClosures.find((c) => c.date === date)
  if (customClosure) {
    return {
      classification: 'custom-closure',
      reason: `Custom closure: ${customClosure.label}`,
    }
  }

  // 2. Company holidays — employer-specific override
  const companyHoliday = policy.companyHolidays.find((c) => c.date === date)
  if (companyHoliday) {
    return {
      classification: 'company-holiday',
      reason: `Company holiday: ${companyHoliday.label}`,
    }
  }

  // 3. Weekend — configurable
  const dow = dayOfWeek(date)
  if (policy.weekendDays.includes(dow)) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return {
      classification: 'weekend',
      reason: `Weekend (${dayNames[dow]})`,
    }
  }

  // 4. US federal holiday (opt-in)
  if (policy.useUSFederalHolidays) {
    const { year } = parseIsoDate(date)
    const federalMap = getFederalHolidayMap(year)
    const federal = federalMap.get(date)
    if (federal) {
      return {
        classification: 'federal-holiday',
        reason: `US federal holiday: ${federal.name}`,
      }
    }
  }

  // 5. Default — workday
  return {
    classification: 'workday',
    reason: 'Workday',
  }
}

/**
 * Returns true if the given date is NOT a workday — i.e. PTO would not
 * be consumed if a booking landed on this day.
 */
export function isNonWorkday(
  date: IsoDate,
  policy: EmployerPolicy
): boolean {
  return classifyDay(date, policy).classification !== 'workday'
}
