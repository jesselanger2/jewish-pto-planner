/**
 * src/domain/planner/plannerSelector.ts
 *
 * Staged, lexicographic greedy selector.
 *
 * Stage 1 — Feasibility: Book required holidays (required-holiday candidates).
 * Stage 2 — Zero-loss: Book rollover-protection candidates to satisfy demand.
 * Stage 3 — Optional: Book optional-holiday candidates when balance allows.
 *
 * Balance checking is done by replaying buildLedger with the current
 * accumulated bookings to get an accurate per-date balance that correctly
 * accounts for grants and accruals that happen during the horizon.
 *
 * Tie-break throughout: earliest startDate, then canonical candidate ID.
 *
 * Pure function — no side effects.
 */

import type {
  IsoDate,
  DayUnits,
  BankId,
  PlannerSettings,
  TimeOffBooking,
  CandidateBreak,
  NormalizedHoliday,
  BookingReason,
} from '../models'
import {
  compareDates,
  toIsoDate,
  parseIsoDate,
} from '../dates/isoDate'
import { classifyDay } from '../dates/workday'
import { buildLedger, getBalanceAsOf } from '../policy/ledger'
import { candidateWorkdays } from './candidateGenerator'
import { type RolloverDemandEntry, rolloverDeadlineFor } from './rolloverDemand'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SelectionResult {
  chosenBookings: TimeOffBooking[]
  /** Candidates that were evaluated but not chosen, with reason. */
  rejections: CandidateRejection[]
  /** Holidays that are required but couldn't be covered (infeasibility signal). */
  uncoveredRequired: string[] // holidayIds
  /** Rollover demand that couldn't be satisfied (infeasibility signal). */
  unsatisfiedDemand: RolloverDemandEntry[]
}

export interface CandidateRejection {
  candidateId: string
  reason: string
}

// ---------------------------------------------------------------------------
// Balance query helper
// ---------------------------------------------------------------------------

/**
 * Returns the bank balance available BEFORE adding a booking on `date`.
 * Replays the ledger with currently-committed bookings to get the correct
 * balance that includes grants and accruals up to and including `date`.
 */
function balanceAsOf(
  settings: PlannerSettings,
  currentBookings: TimeOffBooking[],
  bankId: BankId,
  date: IsoDate
): DayUnits {
  const { events } = buildLedger(settings, currentBookings)
  return getBalanceAsOf(events, bankId, date)
}

/**
 * Returns the minimum balance configured for a bank.
 */
function bankMinimum(settings: PlannerSettings, bankId: BankId): DayUnits {
  const bank = settings.employerPolicy.banks.find((b) => b.id === bankId)
  if (!bank) return 0
  return bank.minimumBalance ?? (bank.allowNegative ? -Infinity : 0)
}

/**
 * Returns true if booking `n` days from `bankId` on `date` is allowed,
 * given current bookings.
 */
function canBook(
  settings: PlannerSettings,
  currentBookings: TimeOffBooking[],
  bankId: BankId,
  date: IsoDate,
  n: number = 1
): boolean {
  const available = balanceAsOf(settings, currentBookings, bankId, date)
  const minimum = bankMinimum(settings, bankId)
  return (available - n) >= minimum
}

// ---------------------------------------------------------------------------
// Booking factory
// ---------------------------------------------------------------------------

let _bookingCounter = 0

function makeBooking(
  date: IsoDate,
  bankId: BankId,
  reason: BookingReason,
  holidayId?: string,
  note?: string
): TimeOffBooking {
  return {
    id: `booking-${bankId}-${date}-${_bookingCounter++}`,
    date,
    bankId,
    reason,
    holidayId,
    locked: false,
    note,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Given a candidate and a set of already-booked workdays, returns the
 * workdays in the candidate that are still unbooked.
 */
function unbookedWorkdays(
  candidate: CandidateBreak,
  bookedDays: Set<IsoDate>,
  settings: PlannerSettings
): IsoDate[] {
  return candidateWorkdays(candidate, settings).filter((d) => !bookedDays.has(d))
}

// ---------------------------------------------------------------------------
// Public selector
// ---------------------------------------------------------------------------

/**
 * Runs the staged lexicographic selection and returns chosen bookings plus
 * diagnostic information.
 */
export function selectCandidates(
  settings: PlannerSettings,
  candidates: CandidateBreak[],
  rolloverDemand: RolloverDemandEntry[],
  lockedBookings: TimeOffBooking[],
  holidays: NormalizedHoliday[]
): SelectionResult {
  // Reset counter for determinism
  _bookingCounter = 0

  // Working state: all bookings accumulated so far (locked + chosen)
  const currentBookings: TimeOffBooking[] = [...lockedBookings]

  // Track which individual workday dates are booked
  const bookedDays = new Set<IsoDate>(
    lockedBookings
      .filter((b) =>
        classifyDay(b.date, settings.employerPolicy).classification === 'workday'
      )
      .map((b) => b.date)
  )

  const rejections: CandidateRejection[] = []

  // Build lookup structures
  const ruleMap = new Map(settings.holidayRules.map((r) => [r.holidayId, r]))
  const { year, month, day } = parseIsoDate(settings.horizonStart)
  const horizonEnd = toIsoDate(year + settings.horizonYears, month, day)

  // Helper: commit a single booking
  const commit = (b: TimeOffBooking) => {
    currentBookings.push(b)
    bookedDays.add(b.date)
  }

  // -------------------------------------------------------------------------
  // Stage 1: Required holidays
  // -------------------------------------------------------------------------

  // Find all required holidays on workdays in the horizon
  const requiredOnWorkdays = holidays.filter((h) => {
    if (
      compareDates(h.date, settings.horizonStart) < 0 ||
      compareDates(h.date, horizonEnd) > 0
    )
      return false
    const rule = ruleMap.get(h.holidayId)
    if (!rule || rule.observance !== 'required') return false
    return classifyDay(h.date, settings.employerPolicy).classification === 'workday'
  })

  const coveredRequired = new Set<string>() // holidayIds

  // Process required holidays chronologically
  const sortedRequired = [...requiredOnWorkdays].sort((a, b) =>
    compareDates(a.date, b.date)
  )

  for (const holiday of sortedRequired) {
    // Already booked (by a locked booking)?
    if (bookedDays.has(holiday.date)) {
      coveredRequired.add(holiday.holidayId)
      continue
    }

    const rule = ruleMap.get(holiday.holidayId)
    if (!rule) continue

    let covered = false

    // Try each bank in preferred order
    for (const bankId of rule.preferredBankOrder) {
      if (!canBook(settings, currentBookings, bankId, holiday.date, 1)) {
        rejections.push({
          candidateId: `req-${holiday.holidayId}-${holiday.date}`,
          reason: `Insufficient ${bankId} balance on ${holiday.date} for required holiday ${holiday.holidayId}`,
        })
        continue
      }

      const b = makeBooking(holiday.date, bankId, 'required-holiday', holiday.holidayId)
      commit(b)
      coveredRequired.add(holiday.holidayId)
      covered = true
      break
    }

    if (!covered) {
      rejections.push({
        candidateId: `req-${holiday.holidayId}-${holiday.date}`,
        reason: `No bank with sufficient balance for required holiday ${holiday.holidayId} on ${holiday.date}`,
      })
    }
  }

  // -------------------------------------------------------------------------
  // Stage 2: Rollover-protection demand
  // -------------------------------------------------------------------------
  const sortedDemand = [...rolloverDemand]
    .filter((d) => d.demandDays > 0)
    .sort((a, b) => compareDates(a.boundaryDate, b.boundaryDate))

  const committedPerBoundary = new Map<IsoDate, DayUnits>()

  // Collect all rollover-protection candidates, sorted chronologically
  const rpCands = candidates
    .filter((c) => c.reason === 'rollover-protection')
    .sort((a, b) => compareDates(a.startDate, b.startDate) || (a.id < b.id ? -1 : 1))

  for (const demand of sortedDemand) {
    let remaining = demand.demandDays
    const deadline = rolloverDeadlineFor(demand.boundaryDate)
    const demandBankId = demand.bankId  // which bank this demand is for

    // Only consider RP candidates before this boundary's deadline
    const eligible = rpCands.filter(
      (c) =>
        !bookedDays.has(c.startDate) &&
        compareDates(c.startDate, deadline) <= 0 &&
        compareDates(c.startDate, settings.horizonStart) >= 0
    )

    for (const cand of eligible) {
      if (remaining <= 0) break
      if (bookedDays.has(cand.startDate)) continue

      if (!canBook(settings, currentBookings, demandBankId, cand.startDate, 1)) {
        rejections.push({
          candidateId: cand.id,
          reason: `Insufficient ${demandBankId} balance for rollover protection on ${cand.startDate}`,
        })
        continue
      }

      const b = makeBooking(
        cand.startDate,
        demandBankId,
        'rollover-protection',
        undefined,
        `Rollover protection before ${demand.boundaryDate}`
      )
      commit(b)
      remaining--
      committedPerBoundary.set(
        demand.boundaryDate,
        (committedPerBoundary.get(demand.boundaryDate) ?? 0) + 1
      )
    }
  }

  // -------------------------------------------------------------------------
  // Stage 3: Optional holidays
  // -------------------------------------------------------------------------
  const optionalCands = candidates
    .filter((c) => c.reason === 'optional-holiday')
    .sort((a, b) => compareDates(a.startDate, b.startDate) || (a.id < b.id ? -1 : 1))

  const coveredOptional = new Set<string>()

  for (const cand of optionalCands) {
    const newHolidays = cand.relatedHolidayIds.filter((hid) => !coveredOptional.has(hid))
    if (newHolidays.length === 0) continue

    const days = unbookedWorkdays(cand, bookedDays, settings)
    if (days.length === 0) {
      for (const hid of newHolidays) coveredOptional.add(hid)
      continue
    }

    const rule = ruleMap.get(cand.relatedHolidayIds[0])
    const preferredOrder = rule?.preferredBankOrder ?? [cand.bankId]

    let chosenBank: BankId | null = null
    for (const bankId of preferredOrder) {
      // Check balance covers ALL days in this candidate
      if (canBook(settings, currentBookings, bankId, cand.startDate, days.length)) {
        chosenBank = bankId
        break
      }
    }

    if (!chosenBank) {
      rejections.push({
        candidateId: cand.id,
        reason: `No bank with sufficient balance for optional holiday`,
      })
      continue
    }

    for (const d of days) {
      const b = makeBooking(d, chosenBank, 'optional-holiday', cand.relatedHolidayIds[0])
      commit(b)
    }
    for (const hid of newHolidays) coveredOptional.add(hid)
  }

  // -------------------------------------------------------------------------
  // Build uncoveredRequired and unsatisfiedDemand
  // -------------------------------------------------------------------------
  const uncoveredRequired = requiredOnWorkdays
    .filter((h) => !coveredRequired.has(h.holidayId))
    .map((h) => h.holidayId)

  const unsatisfiedDemand: RolloverDemandEntry[] = []
  for (const demand of rolloverDemand) {
    if (demand.demandDays <= 0) continue
    const committed = committedPerBoundary.get(demand.boundaryDate) ?? 0
    const remaining = demand.demandDays - committed
    if (remaining > 0) {
      unsatisfiedDemand.push({ ...demand, demandDays: remaining })
    }
  }

  return {
    chosenBookings: currentBookings,
    rejections,
    uncoveredRequired,
    unsatisfiedDemand,
  }
}
