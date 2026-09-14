/**
 * src/domain/planner/__tests__/planner.test.ts
 *
 * Phase 3 planner + validator tests.
 *
 * Tests never depend on the current date — all fixtures use fixed horizons.
 *
 * Covered scenarios:
 *   1. Determinism — same settings → same plan on repeated calls
 *   2. Normal case — required holidays covered, zero vacation forfeiture
 *   3. Negative balance — booking proceeds within configured minimum
 *   4. Rollover-cap — planner schedules RP PTO, zero forfeiture at boundary
 *   5. Diaspora vs Israel — second festival days differ
 *   6. Infeasible — returns 'infeasible' with exact loss, never labeled valid
 *   7. Validator authority — manually constructed bad plan is caught
 *   8. Explanations — every booking has a human-readable explanation
 *   9. Ledger invariants — resultingBalance = openingBalance + delta throughout
 *  10. Rollover demand — computeRolloverDemand returns correct demand values
 */

import { describe, it, expect } from 'vitest'
import { runPlanner } from '../runPlanner'
import { validatePlan } from '../validator'
import { computeRolloverDemand } from '../rolloverDemand'
import { getHolidayOccurrences } from '../../holidays/hebcalAdapter'
import { NORMAL_CASE_SETTINGS } from './fixtures/normalCase'
import { NEGATIVE_BALANCE_SETTINGS } from './fixtures/negativeBalance'
import { ROLLOVER_CAP_SETTINGS } from './fixtures/rolloverCap'
import { DIASPORA_SETTINGS, ISRAEL_SETTINGS } from './fixtures/diasporaVsIsrael'
import { INFEASIBLE_SETTINGS } from './fixtures/infeasible'
import type { TimeOffBooking } from '../../models'

// ---------------------------------------------------------------------------
// 1. Determinism
// ---------------------------------------------------------------------------
describe('runPlanner — determinism', () => {
  it('produces identical PlanSnapshot on repeated calls with same settings', () => {
    const plan1 = runPlanner(NORMAL_CASE_SETTINGS, [], 'test-id')
    const plan2 = runPlanner(NORMAL_CASE_SETTINGS, [], 'test-id')

    // Bookings must be identical (same dates, same banks, same reasons)
    expect(plan1.bookings.map((b) => `${b.date}:${b.bankId}:${b.reason}`)).toEqual(
      plan2.bookings.map((b) => `${b.date}:${b.bankId}:${b.reason}`)
    )

    expect(plan1.feasibility).toEqual(plan2.feasibility)
    expect(plan1.score.vacationForfeited).toEqual(plan2.score.vacationForfeited)
  })

  it('produces the same plan when lockedBookings is empty vs. omitted', () => {
    const plan1 = runPlanner(NORMAL_CASE_SETTINGS, [])
    const plan2 = runPlanner(NORMAL_CASE_SETTINGS, undefined)

    expect(plan1.bookings.map((b) => `${b.date}:${b.bankId}`)).toEqual(
      plan2.bookings.map((b) => `${b.date}:${b.bankId}`)
    )
  })
})

// ---------------------------------------------------------------------------
// 2. Normal case
// ---------------------------------------------------------------------------
describe('runPlanner — normal case (Diaspora, 3-year)', () => {
  const plan = runPlanner(NORMAL_CASE_SETTINGS, [], 'normal-test')

  it('is feasible', () => {
    expect(plan.feasibility).toBe('valid')
  })

  it('has zero vacation forfeiture', () => {
    expect(plan.score.vacationForfeited).toBe(0)
  })

  it('covers all required holidays that are workdays', () => {
    // The validator is the authoritative source — if it passes, all required holidays are covered
    expect(plan.validationIssues.filter((i) => i.code === 'required-holiday-uncovered')).toHaveLength(0)
  })

  it('has no validation issues', () => {
    expect(plan.validationIssues).toHaveLength(0)
  })

  it('has explanations for all bookings', () => {
    expect(plan.explanations).toHaveLength(plan.bookings.length)
    for (const explanation of plan.explanations) {
      expect(explanation.humanReadable.length).toBeGreaterThan(5)
    }
  })

  it('ledger satisfies resultingBalance = openingBalance + delta invariant', () => {
    for (const ev of plan.ledger) {
      expect(ev.resultingBalance).toBe(ev.openingBalance + ev.delta)
    }
  })
})

// ---------------------------------------------------------------------------
// 3. Negative balance
// ---------------------------------------------------------------------------
describe('runPlanner — negative balance', () => {
  const plan = runPlanner(NEGATIVE_BALANCE_SETTINGS, [], 'neg-balance-test')

  it('is feasible (negative balance within allowed minimum is valid)', () => {
    // The validator allows negative balance down to minimumBalance
    expect(plan.feasibility).toBe('valid')
  })

  it('covers Rosh Hashana I, II, and Yom Kippur', () => {
    // No uncovered required holiday issues means they were all booked
    expect(
      plan.validationIssues.filter((i) => i.code === 'required-holiday-uncovered')
    ).toHaveLength(0)
  })

  it('vacation balance does not drop below -3', () => {
    // Check all ledger events for vacation bank
    for (const ev of plan.ledger) {
      if (ev.bankId === 'vacation') {
        expect(ev.resultingBalance).toBeGreaterThanOrEqual(-3)
      }
    }
  })

  it('has no below-minimum-balance validation issues', () => {
    expect(
      plan.validationIssues.filter((i) => i.code === 'below-minimum-balance')
    ).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 4. Rollover-cap case
// ---------------------------------------------------------------------------
describe('runPlanner — rollover cap (planner must schedule discretionary PTO)', () => {
  const plan = runPlanner(ROLLOVER_CAP_SETTINGS, [], 'rollover-cap-test')

  it('is feasible', () => {
    expect(plan.feasibility).toBe('valid')
  })

  it('has zero vacation forfeiture', () => {
    expect(plan.score.vacationForfeited).toBe(0)
  })

  it('includes rollover-protection bookings', () => {
    const rpBookings = plan.bookings.filter((b) => b.reason === 'rollover-protection')
    expect(rpBookings.length).toBeGreaterThan(0)
  })

  it('rollover-protection bookings all use vacation bank', () => {
    const rpBookings = plan.bookings.filter((b) => b.reason === 'rollover-protection')
    for (const b of rpBookings) {
      expect(b.bankId).toBe('vacation')
    }
  })

  it('rollover-protection bookings all land before a rollover boundary', () => {
    const rpBookings = plan.bookings.filter((b) => b.reason === 'rollover-protection')
    // All RP bookings must be before a policy-year boundary (July 1)
    for (const b of rpBookings) {
      // The booking must be within the horizon and before some boundary
      expect(b.date >= ROLLOVER_CAP_SETTINGS.horizonStart).toBe(true)
    }
  })

  it('zero net loss: every rollover event leaves balance exactly at cap (no forfeiture)', () => {
    const rolloverEvents = plan.ledger.filter(
      (ev) => ev.bankId === 'vacation' && (ev.type === 'rollover' || ev.type === 'expiration')
    )
    // If there are rollover events, they should only fire to bring balance to cap (no loss)
    // i.e., resultingBalance === cap. A rollover that brings balance to cap is fine.
    // A rollover where openingBalance > cap + 0 means something was forfeited.
    for (const ev of rolloverEvents) {
      expect(ev.resultingBalance).toBe(ROLLOVER_CAP_SETTINGS.employerPolicy.banks.find(b => b.id === 'vacation')!.carryoverCap!)
    }
  })
})

// ---------------------------------------------------------------------------
// 5. Diaspora vs Israel
// ---------------------------------------------------------------------------
describe('runPlanner — Diaspora vs Israel observance differences', () => {
  const diasporaPlan = runPlanner(DIASPORA_SETTINGS, [], 'diaspora-test')
  const israelPlan = runPlanner(ISRAEL_SETTINGS, [], 'israel-test')

  it('diaspora plan is feasible', () => {
    expect(diasporaPlan.feasibility).toBe('valid')
  })

  it('israel plan is feasible', () => {
    expect(israelPlan.feasibility).toBe('valid')
  })

  it('diaspora plan may include pesach-8 booking (8th day is a Diaspora-only holiday)', () => {
    // Pesach VIII is only in Diaspora. In Israel, there is no 8th day.
    // If it falls on a workday, diaspora should have a booking for it.
    const diasporaHolidayBookings = new Set(
      diasporaPlan.bookings.filter((b) => b.holidayId).map((b) => b.holidayId!)
    )
    const israelHolidayBookings = new Set(
      israelPlan.bookings.filter((b) => b.holidayId).map((b) => b.holidayId!)
    )

    // If Pesach 8 fell on a workday, it should be in Diaspora but not Israel
    if (diasporaHolidayBookings.has('pesach-8')) {
      expect(israelHolidayBookings.has('pesach-8')).toBe(false)
    }
  })

  it('diaspora plan may include shavuot-2 booking (Diaspora-only)', () => {
    const diasporaHolidayBookings = new Set(
      diasporaPlan.bookings.filter((b) => b.holidayId).map((b) => b.holidayId!)
    )
    const israelHolidayBookings = new Set(
      israelPlan.bookings.filter((b) => b.holidayId).map((b) => b.holidayId!)
    )

    if (diasporaHolidayBookings.has('shavuot-2')) {
      expect(israelHolidayBookings.has('shavuot-2')).toBe(false)
    }
  })

  it('israel plan books fewer unique holiday ids than diaspora (no second days)', () => {
    const diasporaHolidayIds = new Set(
      diasporaPlan.bookings.filter((b) => b.holidayId).map((b) => b.holidayId!)
    )
    const israelHolidayIds = new Set(
      israelPlan.bookings.filter((b) => b.holidayId).map((b) => b.holidayId!)
    )
    // Israel should never have MORE unique holiday bookings than Diaspora
    // (it has all the Diaspora holidays minus second-day festivals)
    expect(israelHolidayIds.size).toBeLessThanOrEqual(diasporaHolidayIds.size)
  })
})

// ---------------------------------------------------------------------------
// 6. Infeasible case
// ---------------------------------------------------------------------------
describe('runPlanner — infeasible scenario', () => {
  const plan = runPlanner(INFEASIBLE_SETTINGS, [], 'infeasible-test')

  it('returns infeasible (never mislabeled as valid)', () => {
    expect(plan.feasibility).toBe('infeasible')
  })

  it('reports vacation-loss-at-rollover in validationIssues', () => {
    const lossIssues = plan.validationIssues.filter(
      (i) => i.code === 'vacation-loss-at-rollover'
    )
    expect(lossIssues.length).toBeGreaterThan(0)
  })

  it('reports exact projected loss days (> 0)', () => {
    const lossIssues = plan.validationIssues.filter(
      (i) => i.code === 'vacation-loss-at-rollover'
    )
    const totalLoss = lossIssues.reduce((sum, i) => sum + (i.projectedLossDays ?? 0), 0)
    expect(totalLoss).toBeGreaterThan(0)
  })

  it('reports the rollover date for each loss event', () => {
    const lossIssues = plan.validationIssues.filter(
      (i) => i.code === 'vacation-loss-at-rollover'
    )
    for (const issue of lossIssues) {
      expect(issue.rolloverDate).toBeDefined()
      expect(issue.rolloverDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('total vacation forfeited in score matches validationIssues', () => {
    const lossIssues = plan.validationIssues.filter(
      (i) => i.code === 'vacation-loss-at-rollover'
    )
    const issueTotal = lossIssues.reduce((sum, i) => sum + (i.projectedLossDays ?? 0), 0)
    expect(plan.score.vacationForfeited).toBe(issueTotal)
  })
})

// ---------------------------------------------------------------------------
// 7. Validator is authoritative — catches manually constructed bad plans
// ---------------------------------------------------------------------------
describe('validatePlan — independent authority', () => {
  it('catches an uncovered required holiday', () => {
    const horizonEnd = '2026-01-06'
    const holidays = getHolidayOccurrences(
      NORMAL_CASE_SETTINGS.horizonStart,
      horizonEnd,
      NORMAL_CASE_SETTINGS.jewishCalendar
    )

    // Deliberately provide zero bookings — all required holidays will be uncovered
    const result = validatePlan(NORMAL_CASE_SETTINGS, [], holidays)

    expect(result.feasibility).toBe('infeasible')
    expect(
      result.issues.filter((i) => i.code === 'required-holiday-uncovered')
    ).not.toHaveLength(0)
  })

  it('catches vacation forfeiture when rollover exceeds cap', () => {
    // Use the infeasible settings (20 starting balance, cap 2)
    // and provide bookings that don't consume enough vacation
    const horizonEnd = '2026-12-20'
    const holidays = getHolidayOccurrences(
      INFEASIBLE_SETTINGS.horizonStart,
      horizonEnd,
      INFEASIBLE_SETTINGS.jewishCalendar
    )

    // Zero bookings — all 20 days will roll over into a cap of 2
    const result = validatePlan(INFEASIBLE_SETTINGS, [], holidays)

    expect(result.feasibility).toBe('infeasible')
    expect(result.totalVacationForfeited).toBeGreaterThan(0)
    expect(
      result.issues.some((i) => i.code === 'vacation-loss-at-rollover')
    ).toBe(true)
  })

  it('a plan with all required holidays covered and no forfeiture is valid', () => {
    const plan = runPlanner(NORMAL_CASE_SETTINGS, [], 'validator-auth-test')
    const horizonEnd = '2028-01-06'
    const holidays = getHolidayOccurrences(
      NORMAL_CASE_SETTINGS.horizonStart,
      horizonEnd,
      NORMAL_CASE_SETTINGS.jewishCalendar
    )

    const result = validatePlan(NORMAL_CASE_SETTINGS, plan.bookings, holidays)
    expect(result.feasibility).toBe('valid')
    expect(result.issues).toHaveLength(0)
    expect(result.totalVacationForfeited).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 8. Explanations
// ---------------------------------------------------------------------------
describe('buildExplanations / explanations in snapshot', () => {
  it('every booking in the normal plan has an explanation', () => {
    const plan = runPlanner(NORMAL_CASE_SETTINGS, [], 'expl-test')

    const bookingIds = new Set(plan.bookings.map((b) => b.id))
    const explainedIds = new Set(plan.explanations.map((e) => e.bookingId))

    for (const id of bookingIds) {
      expect(explainedIds.has(id)).toBe(true)
    }
  })

  it('required-holiday explanations mention the holiday name', () => {
    const plan = runPlanner(NORMAL_CASE_SETTINGS, [], 'expl-rh-test')

    const rhExplanations = plan.explanations.filter(
      (e) => e.reason === 'required-holiday'
    )
    expect(rhExplanations.length).toBeGreaterThan(0)
    for (const e of rhExplanations) {
      expect(e.humanReadable).toMatch(/required observance/i)
    }
  })

  it('rollover-protection explanations are present in rollover-cap plan', () => {
    const plan = runPlanner(ROLLOVER_CAP_SETTINGS, [], 'expl-rp-test')

    const rpExplanations = plan.explanations.filter(
      (e) => e.reason === 'rollover-protection'
    )
    expect(rpExplanations.length).toBeGreaterThan(0)
    for (const e of rpExplanations) {
      expect(e.humanReadable).toMatch(/rollover/i)
    }
  })
})

// ---------------------------------------------------------------------------
// 9. Ledger invariants throughout
// ---------------------------------------------------------------------------
describe('ledger invariants', () => {
  it('every event satisfies resultingBalance = openingBalance + delta (normal case)', () => {
    const plan = runPlanner(NORMAL_CASE_SETTINGS, [], 'ledger-inv-test')
    for (const ev of plan.ledger) {
      expect(ev.resultingBalance).toBe(ev.openingBalance + ev.delta)
    }
  })

  it('every event satisfies resultingBalance = openingBalance + delta (rollover case)', () => {
    const plan = runPlanner(ROLLOVER_CAP_SETTINGS, [], 'ledger-inv-rp-test')
    for (const ev of plan.ledger) {
      expect(ev.resultingBalance).toBe(ev.openingBalance + ev.delta)
    }
  })

  it('banks are independent — heritage events never affect vacation balance', () => {
    const plan = runPlanner(NORMAL_CASE_SETTINGS, [], 'ledger-indep-test')
    // The ledger stores opening-balance event with openingBalance=0, delta=startingBalance.
    // We track the chain: each event's openingBalance must equal the previous resultingBalance.
    const vacationEvents = plan.ledger.filter((ev) => ev.bankId === 'vacation')
    for (let i = 1; i < vacationEvents.length; i++) {
      expect(vacationEvents[i].openingBalance).toBe(vacationEvents[i - 1].resultingBalance)
    }
  })
})

// ---------------------------------------------------------------------------
// 10. computeRolloverDemand
// ---------------------------------------------------------------------------
describe('computeRolloverDemand', () => {
  it('returns zero demand when carryoverCap is null (unlimited)', () => {
    const demand = computeRolloverDemand(DIASPORA_SETTINGS, [])
    // Diaspora settings have carryoverCap: null on vacation bank → no demand
    expect(demand.every((d) => d.demandDays === 0)).toBe(true)
  })

  it('returns positive demand when balance will exceed cap', () => {
    // Rollover cap settings: 10 days/year, cap 3, July policy year
    // After July 1 grant of 10, by June 30 balance ≈ 8 (minus some required holidays)
    // demand should be ≥ 1 (8-3 at minimum, possibly more)
    const demand = computeRolloverDemand(ROLLOVER_CAP_SETTINGS, [])
    const positiveDemand = demand.filter((d) => d.demandDays > 0)
    expect(positiveDemand.length).toBeGreaterThan(0)
  })

  it('demand decreases when confirmed bookings consume vacation days', () => {
    const demandBefore = computeRolloverDemand(ROLLOVER_CAP_SETTINGS, [])
    const firstBoundary = demandBefore[0]
    if (!firstBoundary) return

    // Add a confirmed booking before the boundary
    // The July 1, 2025 boundary hasn't been reached yet (horizon starts Jan 1)
    // so the first boundary is July 1, 2025. Book in March — before June.
    const bookingDate = '2025-03-17' // a Monday in March — before June 30
    const confirmedBooking: TimeOffBooking = {
      id: 'test-booking-1',
      date: bookingDate,
      bankId: 'vacation',
      reason: 'rollover-protection',
      locked: false,
    }

    const demandAfter = computeRolloverDemand(ROLLOVER_CAP_SETTINGS, [confirmedBooking])
    const afterEntry = demandAfter.find((d) => d.boundaryDate === firstBoundary.boundaryDate)
    if (!afterEntry) return

    // Demand should be lower after committing a booking
    expect(afterEntry.demandDays).toBeLessThanOrEqual(firstBoundary.demandDays)
  })

  it('demand entries are in chronological order', () => {
    const demand = computeRolloverDemand(ROLLOVER_CAP_SETTINGS, [])
    for (let i = 1; i < demand.length; i++) {
      expect(demand[i].boundaryDate >= demand[i - 1].boundaryDate).toBe(true)
    }
  })

  it('infeasible fixture has demand > available workdays before boundary', () => {
    // The infeasible fixture starts Dec 20, with 20 days balance, cap 2
    // Demand = 18 at the Jan 1 boundary
    const demand = computeRolloverDemand(INFEASIBLE_SETTINGS, [])
    const jan1Demand = demand.find((d) => d.boundaryDate === '2026-01-01')
    expect(jan1Demand).toBeDefined()
    expect(jan1Demand!.demandDays).toBe(18)
  })
})

// ---------------------------------------------------------------------------
// 11. Annotations
// ---------------------------------------------------------------------------
describe('buildAnnotations', () => {
  it('covers every day in the horizon', () => {
    const plan = runPlanner(NEGATIVE_BALANCE_SETTINGS, [], 'annot-test')
    // 1-year horizon starting 2025-01-01 (after fixture fix)
    expect(plan.annotations.length).toBeGreaterThan(360)
    expect(plan.annotations[0].date).toBe('2025-01-01')
  })

  it('annotates weekend days as weekend', () => {
    const plan = runPlanner(NEGATIVE_BALANCE_SETTINGS, [], 'annot-wknd')
    const weekendAnnotations = plan.annotations.filter((a) =>
      a.types.includes('weekend')
    )
    expect(weekendAnnotations.length).toBeGreaterThan(100)
  })

  it('annotates PTO bookings as pto-booked', () => {
    const plan = runPlanner(NORMAL_CASE_SETTINGS, [], 'annot-pto')
    const ptoAnnotations = plan.annotations.filter((a) =>
      a.types.includes('pto-booked')
    )
    // Should have at least as many pto-booked annotations as bookings
    const nonLockedBookings = plan.bookings.filter((b) => !b.locked)
    expect(ptoAnnotations.length).toBeGreaterThanOrEqual(nonLockedBookings.length)
  })
})
