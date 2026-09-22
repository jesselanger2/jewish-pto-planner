/**
 * src/domain/planner/validator.ts
 *
 * Independent ledger-replay validator.
 *
 * This module is the FINAL AUTHORITY on plan validity — even over the selector.
 * It replays buildLedger from scratch on the chosen bookings + settings, then
 * checks every hard constraint from the SPEC:
 *
 *   1. Every required holiday on a workday must have a booking.
 *   2. No booking on a non-workday (unless the booking is locked).
 *   3. No bank balance below its configured minimum at any point.
 *   4. Zero vacation forfeiture at every rollover/expiration event.
 *   5. No projected rollover loss (exact days + date recorded).
 *
 * Pure function — no React, no side effects.
 */

import type {
  IsoDate,
  PlannerSettings,
  TimeOffBooking,
  NormalizedHoliday,
  ValidationIssue,
  PlanFeasibility,
  DayUnits,
} from '../models'
import { compareDates, toIsoDate, parseIsoDate } from '../dates/isoDate'
import { classifyDay } from '../dates/workday'
import { buildLedger } from '../policy/ledger'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  feasibility: PlanFeasibility
  issues: ValidationIssue[]
  /** Total vacation days forfeited across all rollover events */
  totalVacationForfeited: DayUnits
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Validates a plan by independently replaying the ledger and checking all
 * hard constraints.
 *
 * @param settings     Full planner settings
 * @param bookings     The complete set of chosen bookings (including locked)
 * @param holidays     All normalized holiday occurrences for the horizon
 */
export function validatePlan(
  settings: PlannerSettings,
  bookings: TimeOffBooking[],
  holidays: NormalizedHoliday[]
): ValidationResult {
  const issues: ValidationIssue[] = []

  const { employerPolicy: policy, horizonStart, horizonYears, holidayRules } = settings
  const { year, month, day } = parseIsoDate(horizonStart)
  const horizonEnd = toIsoDate(year + horizonYears, month, day)

  // Build a fresh ledger — this is the independent replay
  const { events, violations } = buildLedger(settings, bookings)

  // -------------------------------------------------------------------------
  // Check 1: Required holidays on workdays must be covered
  // -------------------------------------------------------------------------
  const ruleMap = new Map(holidayRules.map((r) => [r.holidayId, r]))
  const bookedDates = new Set(bookings.map((b) => b.date))

  const requiredUncovered: IsoDate[] = []
  const requiredHolidayIds: string[] = []

  for (const h of holidays) {
    if (
      compareDates(h.date, horizonStart) < 0 ||
      compareDates(h.date, horizonEnd) > 0
    )
      continue

    const rule = ruleMap.get(h.holidayId)
    if (!rule || rule.observance !== 'required') continue

    if (classifyDay(h.date, policy).classification !== 'workday') continue

    if (!bookedDates.has(h.date)) {
      requiredUncovered.push(h.date)
      requiredHolidayIds.push(h.holidayId)
    }
  }

  if (requiredUncovered.length > 0) {
    issues.push({
      code: 'required-holiday-uncovered',
      message: `${requiredUncovered.length} required holiday workday(s) not covered: ${requiredHolidayIds.join(', ')}`,
      dates: requiredUncovered,
    })
  }

  // -------------------------------------------------------------------------
  // Check 2: No booking on a non-workday (unless locked)
  // -------------------------------------------------------------------------
  const badDates: IsoDate[] = []
  for (const v of violations) {
    if (v.type === 'booking-on-non-workday') {
      badDates.push(v.date)
    }
  }
  if (badDates.length > 0) {
    issues.push({
      code: 'booking-on-non-workday',
      message: `${badDates.length} booking(s) land on non-workdays`,
      dates: badDates,
    })
  }

  // -------------------------------------------------------------------------
  // Check 3: No bank balance below configured minimum
  // -------------------------------------------------------------------------
  const belowMinDates: IsoDate[] = []
  for (const v of violations) {
    if (v.type === 'below-minimum-balance') {
      belowMinDates.push(v.date)
    }
  }
  if (belowMinDates.length > 0) {
    issues.push({
      code: 'below-minimum-balance',
      message: `Balance falls below minimum on ${belowMinDates.length} occasion(s)`,
      dates: belowMinDates,
      bankId: 'vacation', // primary concern
    })
  }

  // -------------------------------------------------------------------------
  // Check 4 & 5: Zero forfeiture at every rollover/expiration for invariant banks
  // -------------------------------------------------------------------------
  let totalForfeited: DayUnits = 0

  const bankMap = new Map(policy.banks.map((b) => [b.id, b]))

  for (const ev of events) {
    if (ev.type !== 'rollover' && ev.type !== 'expiration') continue
    if (ev.delta >= 0) continue  // positive or zero deltas are not forfeiture

    const bank = bankMap.get(ev.bankId)
    // Default: only 'vacation' counts toward the loss invariant
    const countsTowardInvariant =
      bank?.countsTowardVacationLossInvariant ?? ev.bankId === 'vacation'

    const lost = Math.abs(ev.delta)

    if (countsTowardInvariant) {
      totalForfeited += lost
      issues.push({
        code: 'vacation-loss-at-rollover',
        message:
          `${lost} vacation day${lost === 1 ? '' : 's'} forfeited at rollover on ${ev.date}` +
          ` (balance was ${ev.openingBalance}, cap/expiration reduced to ${ev.resultingBalance})`,
        dates: [ev.date],
        bankId: ev.bankId,
        projectedLossDays: lost,
        rolloverDate: ev.date,
      })
    } else {
      // Non-invariant bank forfeiture is expected (e.g. religiousObservance, heritage, volunteer)
      // — advisory only, never makes the plan infeasible.
      issues.push({
        code: 'advisory-bank-expiration',
        message:
          `${lost} ${bank?.label ?? ev.bankId} day${lost === 1 ? '' : 's'} expired on ${ev.date}` +
          ` — use it or lose it (not counted as vacation loss)`,
        dates: [ev.date],
        bankId: ev.bankId,
        projectedLossDays: lost,
        rolloverDate: ev.date,
      })
    }
  }

  // -------------------------------------------------------------------------
  // Determine feasibility
  // Advisory issues (advisory-bank-expiration) are surfaced in issues[] but
  // never make a plan infeasible — only hard constraint failures do.
  // -------------------------------------------------------------------------
  const hardIssueCount = issues.filter((i) => i.code !== 'advisory-bank-expiration').length
  const isFeasible =
    hardIssueCount === 0 &&
    requiredUncovered.length === 0 &&
    badDates.length === 0 &&
    belowMinDates.length === 0 &&
    totalForfeited === 0

  return {
    feasibility: isFeasible ? 'valid' : 'infeasible',
    issues,
    totalVacationForfeited: totalForfeited,
  }
}
