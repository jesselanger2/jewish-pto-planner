/**
 * src/domain/planner/candidateGenerator.ts
 *
 * Generates CandidateBreak[] — the set of PTO blocks the selector can choose
 * from. Candidates are generated around:
 *
 *   1. Required/optional holidays on workdays — single-day, weekend-extending,
 *      and adjacent-holiday-bridging blocks.
 *   2. Rollover-protection windows — discretionary blocks before rollover
 *      deadlines that consist only of workdays near weekends.
 *
 * Design constraints:
 *   - Every candidate is self-contained: it records workdaysConsumed,
 *     awaySpanDays, bankId, relatedHolidayIds, rolloverDeadline, and reason.
 *   - Candidates may overlap in date; the selector enforces that each workday
 *     is booked at most once.
 *   - IDs are canonical: same inputs → same IDs (deterministic).
 *   - Pure function — no side effects.
 */

import type {
  IsoDate,
  PlannerSettings,
  NormalizedHoliday,
  HolidayRule,
  CandidateBreak,
  BankId,
  BookingReason,
} from '../models'
import {
  addDays,
  compareDates,
  dayOfWeek,
  isoDateRange,
  toIsoDate,
  parseIsoDate,
} from '../dates/isoDate'
import { classifyDay } from '../dates/workday'
import type { RolloverDemandEntry } from './rolloverDemand'
import { rolloverDeadlineFor } from './rolloverDemand'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the number of workdays in [start, end] inclusive. */
function countWorkdays(
  start: IsoDate,
  end: IsoDate,
  settings: PlannerSettings
): number {
  if (compareDates(start, end) > 0) return 0
  let count = 0
  for (const d of isoDateRange(start, end)) {
    if (classifyDay(d, settings.employerPolicy).classification === 'workday') {
      count++
    }
  }
  return count
}

/** Produces a stable candidate ID from its properties. */
function makeCandidateId(
  reason: BookingReason,
  bankId: BankId,
  start: IsoDate,
  end: IsoDate,
  suffix?: string
): string {
  return `cand-${reason}-${bankId}-${start}-${end}${suffix ? '-' + suffix : ''}`
}

/** Returns the first bank in preferredBankOrder (or 'vacation' as fallback). */
function primaryBank(rule: HolidayRule): BankId {
  return rule.preferredBankOrder[0] ?? 'vacation'
}

// ---------------------------------------------------------------------------
// Per-holiday candidate shapes
// ---------------------------------------------------------------------------

/**
 * Shape 1: Single-day covering just the holiday itself.
 */
function singleDayCandidate(
  holiday: NormalizedHoliday,
  rule: HolidayRule,
  reason: BookingReason,
  settings: PlannerSettings,
  horizonEnd: IsoDate
): CandidateBreak | null {
  if (
    compareDates(holiday.date, settings.horizonStart) < 0 ||
    compareDates(holiday.date, horizonEnd) > 0
  )
    return null

  if (classifyDay(holiday.date, settings.employerPolicy).classification !== 'workday')
    return null

  const bankId = primaryBank(rule)
  return {
    id: makeCandidateId(reason, bankId, holiday.date, holiday.date, 'single'),
    startDate: holiday.date,
    endDate: holiday.date,
    workdaysConsumed: 1,
    awaySpanDays: 1,
    bankId,
    relatedHolidayIds: [holiday.holidayId],
    reason,
  }
}

/**
 * Shape 2: Extend through the surrounding weekend to maximize away span.
 * If the holiday is Mon–Wed, extend backwards to the prior Monday if
 * there are adjacent workdays, or extend forward to the next Friday.
 * Strategy: find the nearest surrounding Mon–Fri block that contains the
 * holiday, expand to include the flanking weekend days, then count workdays.
 */
function weekendExtendedCandidate(
  holiday: NormalizedHoliday,
  rule: HolidayRule,
  reason: BookingReason,
  settings: PlannerSettings,
  horizonEnd: IsoDate
): CandidateBreak | null {
  const hDate = holiday.date
  if (
    compareDates(hDate, settings.horizonStart) < 0 ||
    compareDates(hDate, horizonEnd) > 0
  )
    return null

  if (classifyDay(hDate, settings.employerPolicy).classification !== 'workday')
    return null

  const weekendDays = settings.employerPolicy.weekendDays

  // Walk backwards to the start of the current work-week block
  let blockStart = hDate
  while (true) {
    const prev = addDays(blockStart, -1)
    const dow = dayOfWeek(prev)
    if (weekendDays.includes(dow)) break
    if (compareDates(prev, settings.horizonStart) < 0) break
    blockStart = prev
  }

  // Walk forward to the end of the current work-week block
  let blockEnd = hDate
  while (true) {
    const next = addDays(blockEnd, 1)
    const dow = dayOfWeek(next)
    if (weekendDays.includes(dow)) break
    if (compareDates(next, horizonEnd) > 0) break
    blockEnd = next
  }

  // Expand to include flanking weekend
  // Preceding weekend days (going back until non-weekend)
  let spanStart = blockStart
  {
    let prev = addDays(spanStart, -1)
    while (
      compareDates(prev, settings.horizonStart) >= 0 &&
      weekendDays.includes(dayOfWeek(prev))
    ) {
      spanStart = prev
      prev = addDays(prev, -1)
    }
  }

  // Following weekend days
  let spanEnd = blockEnd
  {
    let next = addDays(spanEnd, 1)
    while (
      compareDates(next, horizonEnd) <= 0 &&
      weekendDays.includes(dayOfWeek(next))
    ) {
      spanEnd = next
      next = addDays(next, 1)
    }
  }

  // Only generate this candidate if it's actually larger than single-day
  if (spanStart === spanEnd) return null

  const workdays = countWorkdays(spanStart, spanEnd, settings)
  if (workdays === 0) return null

  // Compute away-span in calendar days
  const awaySpan = diffDaysSimple(spanStart, spanEnd) + 1

  const bankId = primaryBank(rule)
  return {
    id: makeCandidateId(reason, bankId, spanStart, spanEnd, 'wkext'),
    startDate: spanStart,
    endDate: spanEnd,
    workdaysConsumed: workdays,
    awaySpanDays: awaySpan,
    bankId,
    relatedHolidayIds: [holiday.holidayId],
    reason,
  }
}

/** Simple calendar-day difference (positive: b > a). */
function diffDaysSimple(a: IsoDate, b: IsoDate): number {
  const msA = new Date(`${a}T12:00:00Z`).getTime()
  const msB = new Date(`${b}T12:00:00Z`).getTime()
  return Math.round((msB - msA) / 86_400_000)
}

/**
 * Shape 3: Bridge two adjacent holidays in the same week/fortnight.
 * When two required/optional holidays are within 7 days of each other,
 * generate a combined block covering both + workdays in between.
 */
function bridgingCandidate(
  h1: NormalizedHoliday,
  h2: NormalizedHoliday,
  rule1: HolidayRule,
  reason: BookingReason,
  settings: PlannerSettings,
  horizonEnd: IsoDate
): CandidateBreak | null {
  const [first, second] =
    compareDates(h1.date, h2.date) <= 0 ? [h1, h2] : [h2, h1]

  if (
    compareDates(first.date, settings.horizonStart) < 0 ||
    compareDates(second.date, horizonEnd) > 0
  )
    return null

  const span = diffDaysSimple(first.date, second.date)
  if (span <= 0 || span > 14) return null // too far apart → skip

  const start = first.date
  const end = second.date
  const workdays = countWorkdays(start, end, settings)
  if (workdays === 0) return null

  const awaySpan = span + 1
  const bankId = primaryBank(rule1)

  return {
    id: makeCandidateId(reason, bankId, start, end, `bridge-${h2.holidayId}`),
    startDate: start,
    endDate: end,
    workdaysConsumed: workdays,
    awaySpanDays: awaySpan,
    bankId,
    relatedHolidayIds: [first.holidayId, second.holidayId],
    reason,
  }
}

// ---------------------------------------------------------------------------
// Discretionary blocks for rollover protection
// ---------------------------------------------------------------------------

/**
 * Generates small discretionary PTO blocks BEFORE a rollover deadline.
 * Each block is a single workday, generated for every workday in the
 * 30-day window before the deadline. The selector will choose as many as
 * needed to satisfy the demand.
 */
function discretionaryBlocksBeforeDeadline(
  deadline: IsoDate,
  settings: PlannerSettings,
  horizonStart: IsoDate,
  boundary: IsoDate
): CandidateBreak[] {
  const windowStart = addDays(deadline, -30)
  const effectiveStart =
    compareDates(windowStart, horizonStart) >= 0 ? windowStart : horizonStart

  const candidates: CandidateBreak[] = []
  for (const d of isoDateRange(effectiveStart, deadline)) {
    if (classifyDay(d, settings.employerPolicy).classification === 'workday') {
      candidates.push({
        id: makeCandidateId('rollover-protection', 'vacation', d, d, `rp-${boundary}`),
        startDate: d,
        endDate: d,
        workdaysConsumed: 1,
        awaySpanDays: 1,
        bankId: 'vacation',
        relatedHolidayIds: [],
        rolloverDeadline: deadline,
        reason: 'rollover-protection',
      })
    }
  }
  return candidates
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateCandidatesOptions {
  /** All normalized holiday occurrences for the horizon */
  holidays: NormalizedHoliday[]
  /** Rollover demand entries (used to generate rollover-protection candidates) */
  rolloverDemand: RolloverDemandEntry[]
}

/**
 * Generates all CandidateBreak[] for the planning horizon.
 * Candidates are deduplicated by ID and sorted chronologically.
 */
export function generateCandidates(
  settings: PlannerSettings,
  opts: GenerateCandidatesOptions
): CandidateBreak[] {
  const { holidays, rolloverDemand } = opts
  const { horizonStart, horizonYears, holidayRules } = settings

  const { year, month, day } = parseIsoDate(horizonStart)
  const horizonEnd = toIsoDate(year + horizonYears, month, day)

  const candidates = new Map<string, CandidateBreak>()

  const addCandidate = (c: CandidateBreak | null) => {
    if (c && !candidates.has(c.id)) {
      candidates.set(c.id, c)
    }
  }

  // Build a lookup: holidayId → HolidayRule
  const ruleMap = new Map<string, HolidayRule>()
  for (const rule of holidayRules) {
    ruleMap.set(rule.holidayId, rule)
  }

  // Filter holidays to only those in-horizon and not ignored
  const planningHolidays = holidays.filter(
    (h) =>
      compareDates(h.date, horizonStart) >= 0 &&
      compareDates(h.date, horizonEnd) <= 0
  )

  // Process each holiday
  for (const holiday of planningHolidays) {
    const rule = ruleMap.get(holiday.holidayId)
    if (!rule || rule.observance === 'ignore') continue

    const reason: BookingReason =
      rule.observance === 'required' ? 'required-holiday' : 'optional-holiday'

    // Shape 1: single day
    addCandidate(singleDayCandidate(holiday, rule, reason, settings, horizonEnd))

    // Shape 2: weekend-extended
    addCandidate(weekendExtendedCandidate(holiday, rule, reason, settings, horizonEnd))

    // Shape 3: bridging to nearby holidays
    for (const other of planningHolidays) {
      if (other.holidayId === holiday.holidayId) continue
      const otherRule = ruleMap.get(other.holidayId)
      if (!otherRule || otherRule.observance === 'ignore') continue
      addCandidate(bridgingCandidate(holiday, other, rule, reason, settings, horizonEnd))
    }
  }

  // Rollover-protection discretionary blocks
  for (const demand of rolloverDemand) {
    if (demand.demandDays <= 0) continue
    const deadline = rolloverDeadlineFor(demand.boundaryDate)
    const blocks = discretionaryBlocksBeforeDeadline(
      deadline,
      settings,
      horizonStart,
      demand.boundaryDate
    )
    for (const b of blocks) addCandidate(b)
  }

  // Sort by startDate, then by id (deterministic)
  return [...candidates.values()].sort((a, b) => {
    const cmp = compareDates(a.startDate, b.startDate)
    if (cmp !== 0) return cmp
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * Returns all workdays in [start, end] that belong to this candidate.
 * Used by the selector to mark days as booked.
 */
export function candidateWorkdays(
  candidate: CandidateBreak,
  settings: PlannerSettings
): IsoDate[] {
  return isoDateRange(candidate.startDate, candidate.endDate).filter(
    (d) => classifyDay(d, settings.employerPolicy).classification === 'workday'
  )
}
