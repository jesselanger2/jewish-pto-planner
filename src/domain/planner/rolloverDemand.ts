/**
 * src/domain/planner/rolloverDemand.ts
 *
 * Computes how many vacation days MUST be used before each policy-year
 * boundary to eliminate rollover-cap loss.
 *
 * The core formula for each boundary B:
 *   projectedBalance  = currentBalance + (grants+accruals in [today, B))
 *                     - (bookings already confirmed in [today, B))
 *   demand            = max(0, projectedBalance - carryoverCap)
 *
 * This is computed for the VACATION bank only — heritage and personal banks
 * have separate policies and are tracked independently.
 *
 * Pure function — no React, no side effects.
 */

import type {
  IsoDate,
  DayUnits,
  PlannerSettings,
  TimeOffBooking,
} from '../models'
import {
  compareDates,
  toIsoDate,
  parseIsoDate,
} from '../dates/isoDate'
import {
  getPolicyYearBoundaries,
  getBalanceAsOf,
  buildLedger,
} from '../policy/ledger'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RolloverDemandEntry {
  /** The policy-year boundary date when rollover/expiration would occur */
  boundaryDate: IsoDate
  /**
   * Exact number of vacation days that must be spent STRICTLY BEFORE this
   * boundary to avoid forfeiture. 0 = no action needed.
   */
  demandDays: DayUnits
  /**
   * Projected vacation balance just before the boundary (before any
   * discretionary PTO is added). Used in explanations.
   */
  projectedBalance: DayUnits
  /** The cap that applies at this boundary (null = unlimited). */
  carryoverCap: DayUnits | null
  /** Which bank this demand is for */
  bankId: string
  /** Whether this is the year-end cap cliff or the carryover-deadline cliff */
  cliffType: 'year-end-cap' | 'carryover-deadline'
}

// ---------------------------------------------------------------------------
// Public function
// ---------------------------------------------------------------------------

/**
 * Returns rollover-protection demand for every policy-year boundary in the
 * horizon, ordered chronologically.
 *
 * @param settings   Full planner settings (includes employerPolicy + horizon)
 * @param confirmedBookings  Bookings already locked/selected (deducted before
 *                   computing demand so we don't double-count)
 */
export function computeRolloverDemand(
  settings: PlannerSettings,
  confirmedBookings: TimeOffBooking[]
): RolloverDemandEntry[] {
  const { employerPolicy: policy, horizonStart, horizonYears } = settings
  const { policyYearStart, banks } = policy

  // Compute horizon end
  const { year, month, day } = parseIsoDate(horizonStart)
  const horizonEnd = toIsoDate(year + horizonYears, month, day)

  // Get all policy-year boundaries within the horizon
  const boundaries = getPolicyYearBoundaries(horizonStart, horizonEnd, policyYearStart)
  if (boundaries.length === 0) return []

  // Build the ledger with confirmed bookings so we get accurate running
  // balances that include grants, accruals, and confirmed deductions.
  const { events } = buildLedger(settings, confirmedBookings)

  const result: RolloverDemandEntry[] = []

  // Only process banks that count toward the vacation-loss invariant.
  // Default: true only for 'vacation'. All others opt-in explicitly.
  const invariantBanks = banks.filter(
    (b) => b.countsTowardVacationLossInvariant ?? b.id === 'vacation'
  )

  for (const bank of invariantBanks) {
    // Skip banks with no cap and no carryover deadline (unlimited, no pressure)
    const hasCap = bank.carryoverCap !== null && bank.carryoverCap !== undefined
    const hasDeadline = !!bank.carryoverDeadline
    if (!hasCap && !bank.expiresAtYearEnd && !hasDeadline) continue

    const effectiveCap: DayUnits = bank.expiresAtYearEnd
      ? 0
      : (bank.carryoverCap ?? 0)

    for (const boundary of boundaries) {
      // -----------------------------------------------------------------------
      // Cliff 1: Year-end cap
      // -----------------------------------------------------------------------
      const rolloverEvent = events.find(
        (ev) =>
          ev.bankId === bank.id &&
          ev.date === boundary &&
          (ev.type === 'rollover' || ev.type === 'expiration')
      )

      const projectedBalance = rolloverEvent
        ? rolloverEvent.openingBalance
        : getBalanceAsOf(events, bank.id, boundary)

      const demandDays = hasCap || bank.expiresAtYearEnd
        ? Math.max(0, projectedBalance - effectiveCap)
        : 0

      result.push({
        boundaryDate: boundary,
        demandDays,
        projectedBalance,
        carryoverCap: bank.expiresAtYearEnd ? 0 : (bank.carryoverCap ?? null),
        bankId: bank.id,
        cliffType: 'year-end-cap',
      })

      // -----------------------------------------------------------------------
      // Cliff 2: Carryover deadline (distinct from year-end cliff)
      // Days that survive the cap must also be used by the carryoverDeadline.
      // -----------------------------------------------------------------------
      if (!hasDeadline || !bank.carryoverDeadline) continue

      const { month: cdm, day: cdd } = bank.carryoverDeadline
      const { year: boundaryYear } = parseIsoDate(boundary)
      const deadlineDate = toIsoDate(boundaryYear, cdm, cdd)

      // Only include if the deadline falls within the horizon and after the boundary
      if (
        compareDates(deadlineDate, horizonStart) < 0 ||
        compareDates(deadlineDate, horizonEnd) > 0 ||
        compareDates(deadlineDate, boundary) <= 0
      ) continue

      // The carried-over amount after the year-end cap event.
      // We look for the expiration/rollover event at the boundary for this bank
      // to know what balance remains after cliff 1.
      const afterCapBalance = rolloverEvent
        ? rolloverEvent.resultingBalance
        : Math.min(projectedBalance, hasCap ? effectiveCap : projectedBalance)

      // Now account for any bookings between boundary and deadline
      const balanceAtDeadline = getBalanceAsOf(events, bank.id, deadlineDate)

      // Demand at the deadline = whatever balance remains (since it all expires)
      const deadlineDemand = Math.max(0, balanceAtDeadline)

      // Only add a demand entry if there's genuinely a risk
      if (afterCapBalance > 0) {
        result.push({
          boundaryDate: deadlineDate,
          demandDays: deadlineDemand,
          projectedBalance: balanceAtDeadline,
          carryoverCap: 0,
          bankId: bank.id,
          cliffType: 'carryover-deadline',
        })
      }
    }
  }

  // Return sorted chronologically
  return result.sort((a, b) => compareDates(a.boundaryDate, b.boundaryDate))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function subtractOneDay(date: IsoDate): IsoDate {
  const { year, month, day } = parseIsoDate(date)
  if (day > 1) return toIsoDate(year, month, day - 1)
  if (month > 1) {
    const prevMonth = month - 1
    const lastDay = daysInMonth(year, prevMonth)
    return toIsoDate(year, prevMonth, lastDay)
  }
  // January 1 → December 31 of previous year
  return toIsoDate(year - 1, 12, 31)
}

function daysInMonth(year: number, month: number): number {
  // Simple version — mirrors isoDate.ts
  const counts = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return isLeap ? 29 : 28
  }
  return counts[month]
}

/**
 * Helper: returns the latest date by which vacation days must be used to
 * meet the demand for a given boundary.  The deadline is the day BEFORE the
 * boundary (the last workday opportunity is on or before this date).
 */
export function rolloverDeadlineFor(boundary: IsoDate): IsoDate {
  return subtractOneDay(boundary)
}

/**
 * Given a sequence of RolloverDemandEntry values and a set of candidate
 * bookings that have been committed, recompute remaining demand.
 *
 * This is used by the selector to track how much demand is satisfied as
 * candidates are greedily picked.
 */
export function remainingDemand(
  entries: RolloverDemandEntry[],
  committedVacationDaysByBoundary: Map<IsoDate, DayUnits>
): RolloverDemandEntry[] {
  return entries.map((e) => {
    const committed = committedVacationDaysByBoundary.get(e.boundaryDate) ?? 0
    return {
      ...e,
      demandDays: Math.max(0, e.demandDays - committed),
    }
  })
}

/**
 * Returns total demand days across all boundaries in [start, end].
 */
export function totalDemandInRange(
  entries: RolloverDemandEntry[],
  start: IsoDate,
  end: IsoDate
): DayUnits {
  return entries
    .filter(
      (e) =>
        compareDates(e.boundaryDate, start) >= 0 &&
        compareDates(e.boundaryDate, end) <= 0
    )
    .reduce((sum, e) => sum + e.demandDays, 0)
}
