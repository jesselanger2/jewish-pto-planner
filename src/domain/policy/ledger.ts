/**
 * src/domain/policy/ledger.ts
 *
 * Chronological PTO bank ledger.
 *
 * Processing order (per spec):
 *   1. Opening balances    — one per bank at horizonStart
 *   2. Grant / accrual     — on each grant date and accrual period within horizon
 *   3. Approved bookings   — deductions in date order
 *   4. Rollover/expiration — on each policy-year boundary
 *
 * Invariants:
 *   - resultingBalance = openingBalance + delta on every event
 *   - Balance never falls below minimumBalance (default 0) unless allowNegative
 *   - Past entries are never mutated — new events appended only
 *   - Same inputs → identical output every time (deterministic)
 *   - Banks are independent — heritage deduction never touches vacation
 *
 * Pure function — no side effects, no React, no browser APIs, no DB calls.
 */

import type {
  IsoDate,
  DayUnits,
  BankId,
  LedgerEvent,
  LedgerEventType,
  PTOBankPolicy,
  PlannerSettings,
  TimeOffBooking,
} from '../models'
import {
  addDays,
  compareDates,
  toIsoDate,
  parseIsoDate,
} from '../dates/isoDate'
import { isNonWorkday } from '../dates/workday'

// ---------------------------------------------------------------------------
// Policy-year helpers
// ---------------------------------------------------------------------------

/**
 * Returns the IsoDate of the start of the policy year that CONTAINS `date`.
 *
 * For example, with policyYearStart = {month:7, day:1}:
 *   - 2025-08-15 → 2025-07-01
 *   - 2025-02-01 → 2024-07-01
 */
export function getPolicyYearStart(
  date: IsoDate,
  policyYearStart: { month: number; day: number }
): IsoDate {
  const { year } = parseIsoDate(date)
  const { month: pm, day: pd } = policyYearStart

  // Candidate: current calendar year
  const candidate = toIsoDate(year, pm, pd)

  if (compareDates(date, candidate) >= 0) {
    return candidate // date is on or after this year's start → use it
  } else {
    // date is before this year's start → use prior year's start
    return toIsoDate(year - 1, pm, pd)
  }
}

/**
 * Returns a stable string ID for the policy year containing `date`,
 * e.g. "2025-07-01".
 */
export function getPolicyYearId(
  date: IsoDate,
  policyYearStart: { month: number; day: number }
): string {
  return getPolicyYearStart(date, policyYearStart)
}

/**
 * Returns the IsoDate of the NEXT policy-year start after (or on) `date`.
 */
export function getNextPolicyYearStart(
  date: IsoDate,
  policyYearStart: { month: number; day: number }
): IsoDate {
  const current = getPolicyYearStart(date, policyYearStart)
  const { year } = parseIsoDate(current)
  return toIsoDate(year + 1, policyYearStart.month, policyYearStart.day)
}

/**
 * Returns all policy-year boundary dates that fall strictly within
 * [horizonStart, horizonEnd] (inclusive).
 * These are the dates when rollover/expiration events are posted.
 */
export function getPolicyYearBoundaries(
  horizonStart: IsoDate,
  horizonEnd: IsoDate,
  policyYearStart: { month: number; day: number }
): IsoDate[] {
  const boundaries: IsoDate[] = []
  let next = getNextPolicyYearStart(horizonStart, policyYearStart)
  while (compareDates(next, horizonEnd) <= 0) {
    boundaries.push(next)
    const { year } = parseIsoDate(next)
    next = toIsoDate(year + 1, policyYearStart.month, policyYearStart.day)
  }
  return boundaries
}

/**
 * Returns all grant dates (one per bank per policy year) that fall within
 * [horizonStart, horizonEnd].
 */
function getGrantDates(
  bank: PTOBankPolicy,
  horizonStart: IsoDate,
  horizonEnd: IsoDate,
  policyYearStart: { month: number; day: number }
): IsoDate[] {
  // The grant date within any given year is either the bank's own grantDate
  // or the policyYearStart.
  const { month: gm, day: gd } = bank.grantDate ?? policyYearStart

  const dates: IsoDate[] = []
  // Walk policy years from the first one that starts at/before horizonStart
  let pyStart = getPolicyYearStart(horizonStart, policyYearStart)
  while (compareDates(pyStart, horizonEnd) <= 0) {
    const { year } = parseIsoDate(pyStart)
    const grantDate = toIsoDate(year, gm, gd)
    // Only include the grant date if it falls within the horizon
    if (
      compareDates(grantDate, horizonStart) >= 0 &&
      compareDates(grantDate, horizonEnd) <= 0
    ) {
      dates.push(grantDate)
    }
    // Move to next policy year
    const { year: pyYear } = parseIsoDate(pyStart)
    pyStart = toIsoDate(pyYear + 1, policyYearStart.month, policyYearStart.day)
  }
  return dates
}

// ---------------------------------------------------------------------------
// Accrual helpers
// ---------------------------------------------------------------------------

/**
 * Returns all accrual event dates for a bank within the horizon.
 * - 'annual': one accrual per year (same as grant — skip; handled by grant events)
 * - 'monthly': 1st of each month
 * - 'per-pay-period': every 14 days from horizonStart (26 per year)
 */
function getAccrualDates(
  bank: PTOBankPolicy,
  horizonStart: IsoDate,
  horizonEnd: IsoDate
): IsoDate[] {
  if (!bank.accrualCadence || !bank.accrualAmount || bank.accrualCadence === 'annual') {
    return []
  }

  const dates: IsoDate[] = []

  if (bank.accrualCadence === 'monthly') {
    const { year: startYear, month: startMonth } = parseIsoDate(horizonStart)
    const { year: endYear, month: endMonth } = parseIsoDate(horizonEnd)
    let y = startYear
    let m = startMonth
    while (y < endYear || (y === endYear && m <= endMonth)) {
      const d = toIsoDate(y, m, 1)
      if (compareDates(d, horizonStart) >= 0 && compareDates(d, horizonEnd) <= 0) {
        dates.push(d)
      }
      m++
      if (m > 12) { m = 1; y++ }
    }
  } else if (bank.accrualCadence === 'per-pay-period') {
    // Biweekly (every 14 days) starting from horizonStart
    let d = horizonStart
    while (compareDates(d, horizonEnd) <= 0) {
      dates.push(d)
      d = addDays(d, 14)
    }
  }

  return dates
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let _eventCounter = 0

function makeEventId(
  bankId: BankId,
  date: IsoDate,
  type: LedgerEventType,
  index: number
): string {
  return `${bankId}-${date}-${type}-${index}`
}

// ---------------------------------------------------------------------------
// Ledger builder
// ---------------------------------------------------------------------------

export interface BuildLedgerOptions {
  /** If set, only build events up to and including this date. */
  upToDate?: IsoDate
}

export interface LedgerResult {
  events: LedgerEvent[]
  /** Final balance per bank as of the last event (or upToDate) */
  finalBalances: Record<BankId, DayUnits>
  /** Any constraint violations detected during build */
  violations: Array<{
    type: 'below-minimum-balance' | 'booking-on-non-workday'
    bankId: BankId
    date: IsoDate
    message: string
  }>
}

/**
 * Builds the complete chronological PTO ledger for the given settings and
 * bookings. Returns an immutable snapshot of all events in order.
 *
 * Processing order per spec:
 *   1. Opening balances
 *   2. Grant / accrual events (chronological)
 *   3. Bookings (chronological)
 *   4. Rollover / expiration (at each policy-year boundary)
 *
 * Note: within a single date, ordering is:
 *   opening-balance < accrual/grant < booking < rollover/expiration
 */
export function buildLedger(
  settings: PlannerSettings,
  bookings: TimeOffBooking[],
  options: BuildLedgerOptions = {}
): LedgerResult {
  _eventCounter = 0

  const { employerPolicy: policy, horizonStart, horizonYears } = settings
  const { policyYearStart, banks, startingBalances } = policy

  // Compute horizon end
  const { year: startYear, month: startMonth, day: startDay } = parseIsoDate(horizonStart)
  const horizonEnd = toIsoDate(startYear + horizonYears, startMonth, startDay)
  const effectiveEnd = options.upToDate
    ? (compareDates(options.upToDate, horizonEnd) < 0 ? options.upToDate : horizonEnd)
    : horizonEnd

  // Working balances (mutated during processing — never in the events themselves)
  // Dynamically built from startingBalances so any number of banks is supported.
  const balances: Record<string, DayUnits> = {}
  for (const bank of banks) {
    balances[bank.id] = startingBalances[bank.id] ?? 0
  }

  const events: LedgerEvent[] = []
  const violations: LedgerResult['violations'] = []

  // ---------------------------------------------------------------------------
  // Helper: append a ledger event
  // ---------------------------------------------------------------------------
  function appendEvent(
    date: IsoDate,
    bankId: BankId,
    type: LedgerEventType,
    delta: DayUnits,
    reason: string,
    sourceId?: string
  ): void {
    const opening = balances[bankId]
    const resulting = opening + delta
    balances[bankId] = resulting

    events.push({
      id: makeEventId(bankId, date, type, _eventCounter++),
      date,
      bankId,
      type,
      openingBalance: opening,
      delta,
      resultingBalance: resulting,
      reason,
      sourceId,
      policyYearId: getPolicyYearId(date, policyYearStart),
    })
  }

  // ---------------------------------------------------------------------------
  // 1. Opening balances
  // ---------------------------------------------------------------------------
  for (const bank of banks) {
    // The opening balance event has delta=0 and resultingBalance=opening
    const opening2 = balances[bank.id]
    events.push({
      id: makeEventId(bank.id, horizonStart, 'opening-balance', _eventCounter++),
      date: horizonStart,
      bankId: bank.id,
      type: 'opening-balance',
      openingBalance: 0,
      delta: opening2,
      resultingBalance: opening2,
      reason: 'Opening balance at horizon start',
      policyYearId: getPolicyYearId(horizonStart, policyYearStart),
    })
  }

  // ---------------------------------------------------------------------------
  // Collect all future events (grants, accruals, bookings, rollovers) and
  // sort them chronologically, then process in order.
  // ---------------------------------------------------------------------------

  type PendingEvent =
    | { kind: 'grant'; date: IsoDate; bank: PTOBankPolicy }
    | { kind: 'accrual'; date: IsoDate; bank: PTOBankPolicy }
    | { kind: 'booking'; booking: TimeOffBooking }
    | { kind: 'rollover'; date: IsoDate }
    | { kind: 'carryover-deadline'; date: IsoDate; bank: PTOBankPolicy; boundaryDate: IsoDate }

  const pending: PendingEvent[] = []

  // 2. Grants
  for (const bank of banks) {
    if (bank.annualGrant > 0 || bank.grantDate) {
      const grantDates = getGrantDates(bank, horizonStart, effectiveEnd, policyYearStart)
      for (const d of grantDates) {
        pending.push({ kind: 'grant', date: d, bank })
      }
    }
  }

  // 2b. Accruals
  for (const bank of banks) {
    if (bank.accrualCadence && bank.accrualAmount && bank.accrualCadence !== 'annual') {
      const accrualDates = getAccrualDates(bank, horizonStart, effectiveEnd)
      for (const d of accrualDates) {
        pending.push({ kind: 'accrual', date: d, bank })
      }
    }
  }

  // 3. Bookings (only workday bookings deduct PTO; non-workdays flagged as violation unless locked historical)
  const sortedBookings = [...bookings].sort((a, b) => compareDates(a.date, b.date))
  for (const booking of sortedBookings) {
    if (compareDates(booking.date, horizonStart) >= 0 &&
        compareDates(booking.date, effectiveEnd) <= 0) {
      pending.push({ kind: 'booking', booking })
    }
  }

  // 4a. Rollovers — at each policy-year boundary (year-end cap cliff)
  const boundaries = getPolicyYearBoundaries(horizonStart, effectiveEnd, policyYearStart)
  for (const boundary of boundaries) {
    pending.push({ kind: 'rollover', date: boundary })
  }

  // 4b. Carryover-deadline cliffs — for banks with a carryoverDeadline.
  // These are DISTINCT from year-end rollovers. We post them on the
  // carryoverDeadline date that falls in the same policy year as each boundary.
  for (const bank of banks) {
    if (!bank.carryoverDeadline) continue
    const { month: cdm, day: cdd } = bank.carryoverDeadline
    for (const boundary of boundaries) {
      // The carryover deadline belongs to the policy year that STARTS at boundary.
      // E.g. boundary = Jan 1 2026 → deadline = April 1 2026
      const { year: boundaryYear } = parseIsoDate(boundary)
      const deadlineDate = toIsoDate(boundaryYear, cdm, cdd)
      if (
        compareDates(deadlineDate, horizonStart) >= 0 &&
        compareDates(deadlineDate, effectiveEnd) <= 0 &&
        // Must fall strictly after the boundary (i.e. in the new policy year)
        compareDates(deadlineDate, boundary) > 0
      ) {
        pending.push({ kind: 'carryover-deadline', date: deadlineDate, bank, boundaryDate: boundary })
      }
    }
  }

  // Sort by date; within same date: grant < accrual < booking < rollover < carryover-deadline
  const kindOrder: Record<string, number> = { grant: 0, accrual: 1, booking: 2, rollover: 3, 'carryover-deadline': 4 }
  pending.sort((a, b) => {
    const da = a.kind === 'booking' ? a.booking.date : a.date
    const db = b.kind === 'booking' ? b.booking.date : b.date
    const cmp = compareDates(da, db)
    if (cmp !== 0) return cmp
    return kindOrder[a.kind] - kindOrder[b.kind]
  })

  // ---------------------------------------------------------------------------
  // Process pending events
  // ---------------------------------------------------------------------------
  for (const ev of pending) {
    if (ev.kind === 'grant') {
      const { bank, date } = ev
      if (bank.annualGrant > 0) {
        appendEvent(
          date,
          bank.id,
          'grant',
          bank.annualGrant,
          `Annual grant: ${bank.label}`,
        )
      }
    }

    if (ev.kind === 'accrual') {
      const { bank, date } = ev
      if (bank.accrualAmount) {
        appendEvent(
          date,
          bank.id,
          'accrual',
          bank.accrualAmount,
          `Accrual (${bank.accrualCadence}): ${bank.label}`,
        )
      }
    }

    if (ev.kind === 'booking') {
      const { booking } = ev
      const bank = banks.find((b) => b.id === booking.bankId)
      if (!bank) continue

      // Validate booking lands on a workday (unless locked historical record)
      if (!booking.locked && isNonWorkday(booking.date, policy)) {
        violations.push({
          type: 'booking-on-non-workday',
          bankId: booking.bankId,
          date: booking.date,
          message: `Booking on non-workday ${booking.date} — no PTO deducted`,
        })
        // Don't deduct PTO for a booking on a non-workday
        continue
      }

      const delta = -1 // one workday = one day unit (v1)
      const projectedBalance = balances[booking.bankId] + delta
      const minBalance = bank.minimumBalance ?? (bank.allowNegative ? -Infinity : 0)

      if (projectedBalance < minBalance) {
        violations.push({
          type: 'below-minimum-balance',
          bankId: booking.bankId,
          date: booking.date,
          message:
            `Booking on ${booking.date} would push ${bank.label} balance ` +
            `to ${projectedBalance} (minimum: ${minBalance})`,
        })
        // Still record the event — the validator is authoritative, but we
        // faithfully record what was attempted.
      }

      appendEvent(
        booking.date,
        booking.bankId,
        'booking',
        delta,
        booking.note
          ? `${booking.reason}: ${booking.note}`
          : booking.reason,
        booking.id,
      )
    }

    if (ev.kind === 'rollover') {
      const { date } = ev
      for (const bank of banks) {
        const balance = balances[bank.id]

        if (bank.expiresAtYearEnd && balance > 0) {
          // All remaining balance expires
          appendEvent(
            date,
            bank.id,
            'expiration',
            -balance,
            `Year-end expiration: ${bank.label} balance forfeited`,
          )
        } else if (bank.carryoverCap !== undefined && bank.carryoverCap !== null) {
          // Cap excess above carryoverCap (cliff 1: year-end)
          if (balance > bank.carryoverCap) {
            const excess = balance - bank.carryoverCap
            appendEvent(
              date,
              bank.id,
              'rollover',
              -excess,
              `Rollover cap: ${bank.label} capped at ${bank.carryoverCap} days ` +
                `(${excess} day${excess === 1 ? '' : 's'} forfeited at year end)`,
            )
          }
          // Otherwise no rollover event needed — balance stays as-is
        }
        // carryoverCap === null means unlimited — no rollover event
      }
    }

    if (ev.kind === 'carryover-deadline') {
      // Cliff 2: any balance that survived the year-end cap but wasn't used
      // by the carryoverDeadline is forfeited here. We only forfeit what
      // remains — the year-end cap event already reduced the balance to
      // ≤ carryoverCap, so there is no double-counting.
      const { bank, date } = ev
      const balance = balances[bank.id]
      if (balance > 0) {
        appendEvent(
          date,
          bank.id,
          'expiration',
          -balance,
          `Carryover deadline: ${bank.label} unused carried-over balance forfeited` +
            ` (${balance} day${balance === 1 ? '' : 's'} lost after carryover window)`,
        )
      }
    }
  }

  // Dynamically build finalBalances from all banks (not hard-coded 3 keys)
  const finalBalances: Record<string, DayUnits> = {}
  for (const bank of banks) {
    finalBalances[bank.id] = balances[bank.id] ?? 0
  }

  return { events, finalBalances, violations }
}

// ---------------------------------------------------------------------------
// Balance query helpers
// ---------------------------------------------------------------------------

/**
 * Returns the balance for a given bank as of (just after) `date` by
 * replaying all events up to and including that date.
 */
export function getBalanceAsOf(
  events: LedgerEvent[],
  bankId: BankId,
  date: IsoDate
): DayUnits {
  let balance = 0
  for (const ev of events) {
    if (ev.bankId === bankId && compareDates(ev.date, date) <= 0) {
      balance = ev.resultingBalance
    }
  }
  return balance
}
