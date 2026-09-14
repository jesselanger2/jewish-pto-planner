/**
 * src/domain/planner/annotator.ts
 *
 * Builds DayAnnotation[] for every date in the horizon by combining:
 *   - Workday classification (from classifyDay)
 *   - Jewish holiday occurrences (required / optional / modern)
 *   - Chosen bookings (pto-booked / pto-locked)
 *
 * Each date gets a list of `types` and `labels` so the UI can render
 * the calendar without knowing business logic. Multiple types may apply
 * (e.g. a required holiday that is also a booked PTO day).
 *
 * Pure function — no React, no side effects.
 */

import type {
  IsoDate,
  PlannerSettings,
  NormalizedHoliday,
  TimeOffBooking,
  DayAnnotation,
  DayAnnotationType,
} from '../models'
import { isoDateRange, compareDates, toIsoDate, parseIsoDate } from '../dates/isoDate'
import { classifyDay } from '../dates/workday'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns one DayAnnotation per calendar date in [horizonStart, horizonEnd].
 *
 * @param settings  Full planner settings (provides horizon + policy)
 * @param holidays  All normalized holiday occurrences for the horizon
 * @param bookings  The final chosen bookings (chosen + locked)
 */
export function buildAnnotations(
  settings: PlannerSettings,
  holidays: NormalizedHoliday[],
  bookings: TimeOffBooking[]
): DayAnnotation[] {
  const { horizonStart, horizonYears, employerPolicy: policy, holidayRules } = settings
  const { year, month, day } = parseIsoDate(horizonStart)
  const horizonEnd = toIsoDate(year + horizonYears, month, day)

  // Index: date → holiday[]
  const holidaysByDate = new Map<IsoDate, NormalizedHoliday[]>()
  for (const h of holidays) {
    if (
      compareDates(h.date, horizonStart) < 0 ||
      compareDates(h.date, horizonEnd) > 0
    )
      continue
    if (!holidaysByDate.has(h.date)) holidaysByDate.set(h.date, [])
    holidaysByDate.get(h.date)!.push(h)
  }

  // Index: date → booking[]
  const bookingsByDate = new Map<IsoDate, TimeOffBooking[]>()
  for (const b of bookings) {
    if (!bookingsByDate.has(b.date)) bookingsByDate.set(b.date, [])
    bookingsByDate.get(b.date)!.push(b)
  }

  // Rule lookup
  const ruleMap = new Map(holidayRules.map((r) => [r.holidayId, r]))

  const annotations: DayAnnotation[] = []

  for (const date of isoDateRange(horizonStart, horizonEnd)) {
    const types: DayAnnotationType[] = []
    const labels: string[] = []
    let bankId = undefined as DayAnnotation['bankId']
    let holidayId = undefined as DayAnnotation['holidayId']

    // 1. Workday classification
    const { classification, reason } = classifyDay(date, policy)
    if (classification !== 'workday') {
      types.push(classification as DayAnnotationType)
      labels.push(reason)
    } else {
      types.push('workday')
    }

    // 2. Jewish holidays
    const dayHolidays = holidaysByDate.get(date) ?? []
    for (const h of dayHolidays) {
      const rule = ruleMap.get(h.holidayId)
      const observance = rule?.observance ?? 'ignore'
      if (observance === 'ignore') {
        // Only show modern holidays if the user has includeModernHolidays
        if (h.hebcalCategory === 'modern' && settings.jewishCalendar.includeModernHolidays) {
          types.push('modern-holiday')
          labels.push(h.displayName)
          if (!holidayId) holidayId = h.holidayId
        }
        // skip truly ignored non-modern holidays
      } else if (observance === 'required') {
        types.push('required-holiday')
        labels.push(h.displayName)
        if (!holidayId) holidayId = h.holidayId
      } else if (observance === 'optional') {
        types.push('optional-holiday')
        labels.push(h.displayName)
        if (!holidayId) holidayId = h.holidayId
      }
    }

    // 3. Bookings
    const dayBookings = bookingsByDate.get(date) ?? []
    for (const b of dayBookings) {
      if (b.locked) {
        types.push('pto-locked')
        labels.push(`PTO (locked)`)
      } else {
        types.push('pto-booked')
        labels.push(`PTO (${b.reason})`)
      }
      if (!bankId) bankId = b.bankId
    }

    annotations.push({
      date,
      types: [...new Set(types)], // deduplicate
      labels: [...new Set(labels)],
      bankId,
      holidayId,
    })
  }

  return annotations
}
