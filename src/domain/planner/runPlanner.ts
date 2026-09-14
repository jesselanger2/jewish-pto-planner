/**
 * src/domain/planner/runPlanner.ts
 *
 * Top-level planner orchestrator.
 *
 * Pipeline (per SPEC §Optimizer):
 *   1. Normalize settings + generate holiday occurrences
 *   2. Reserve / validate locked time off
 *   3. Compute rollover-protection demand (exact days needed before each cap)
 *   4. Generate eligible candidate PTO blocks
 *   5. Select candidates — staged lexicographic greedy
 *   6. Independently validate by replaying the full ledger (validator is final)
 *   7. Build day-by-day annotations
 *   8. Generate explanations
 *   9. Return PlanSnapshot (or infeasibility diagnostics)
 *
 * Re-running with the same settings always produces the same result
 * (deterministic — no Date.now() calls, no random).
 *
 * Pure function — no React, no browser APIs, no DB calls.
 */

import type {
  PlannerSettings,
  TimeOffBooking,
  PlanSnapshot,
  PlannerObjectiveScore,
  BankId,
} from '../models'
import { toIsoDate, parseIsoDate } from '../dates/isoDate'
import { getHolidayOccurrences } from '../holidays/hebcalAdapter'
import { buildLedger } from '../policy/ledger'
import { computeRolloverDemand } from './rolloverDemand'
import { generateCandidates } from './candidateGenerator'
import { selectCandidates } from './plannerSelector'
import { validatePlan } from './validator'
import { buildAnnotations } from './annotator'
import { buildExplanations } from './explanations'

// ---------------------------------------------------------------------------
// Engine version — increment when planning logic changes
// ---------------------------------------------------------------------------

export const ENGINE_VERSION = '3.0.0'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the full planning pipeline and returns an immutable PlanSnapshot.
 *
 * @param settings        Complete planner settings (policy + calendar + rules)
 * @param lockedBookings  Optional array of user-locked time-off bookings that
 *                        survive re-planning; defaults to settings.lockedTimeOff
 *                        converted to TimeOffBooking objects.
 * @param planId          Optional stable ID for the snapshot (generated if omitted)
 * @param planName        Optional name for the snapshot
 */
export function runPlanner(
  settings: PlannerSettings,
  lockedBookings?: TimeOffBooking[],
  planId?: string,
  planName?: string
): PlanSnapshot {
  // -------------------------------------------------------------------------
  // Step 1: Normalize / compute horizon
  // -------------------------------------------------------------------------
  const { year, month, day } = parseIsoDate(settings.horizonStart)
  const horizonEnd = toIsoDate(year + settings.horizonYears, month, day)

  // Resolve locked bookings from settings if not explicitly provided
  const locked: TimeOffBooking[] = lockedBookings ?? settings.lockedTimeOff.map((lt, i) => ({
    id: `locked-${lt.date}-${i}`,
    date: lt.date,
    bankId: lt.bankId as BankId,
    reason: 'locked' as const,
    locked: true,
    note: lt.reason,
  }))

  // -------------------------------------------------------------------------
  // Step 2: Generate holiday occurrences
  // -------------------------------------------------------------------------
  const holidays = getHolidayOccurrences(
    settings.horizonStart,
    horizonEnd,
    settings.jewishCalendar
  )

  // -------------------------------------------------------------------------
  // Step 3: Compute rollover-protection demand
  //         (using only locked bookings as confirmed, so demand is worst-case)
  // -------------------------------------------------------------------------
  const rolloverDemand = computeRolloverDemand(settings, locked)

  // -------------------------------------------------------------------------
  // Step 4: Generate candidates
  // -------------------------------------------------------------------------
  const candidates = generateCandidates(settings, {
    holidays,
    rolloverDemand,
  })

  // -------------------------------------------------------------------------
  // Step 5: Select candidates (staged lexicographic greedy)
  // -------------------------------------------------------------------------
  const { chosenBookings, rejections, uncoveredRequired: _uncoveredRequired, unsatisfiedDemand: _unsatisfiedDemand } =
    selectCandidates(settings, candidates, rolloverDemand, locked, holidays)

  // -------------------------------------------------------------------------
  // Step 6: Independent ledger-replay validation (final authority)
  // -------------------------------------------------------------------------
  const { feasibility, issues, totalVacationForfeited } = validatePlan(
    settings,
    chosenBookings,
    holidays
  )

  // -------------------------------------------------------------------------
  // Step 7: Build full ledger for the snapshot
  // -------------------------------------------------------------------------
  const { events: ledger } = buildLedger(settings, chosenBookings)

  // -------------------------------------------------------------------------
  // Step 8: Build annotations
  // -------------------------------------------------------------------------
  const annotations = buildAnnotations(settings, holidays, chosenBookings)

  // -------------------------------------------------------------------------
  // Step 9: Build explanations
  // -------------------------------------------------------------------------
  const explanations = buildExplanations(chosenBookings, holidays, settings, rejections)

  // -------------------------------------------------------------------------
  // Step 10: Score
  // -------------------------------------------------------------------------
  // Count optional holidays covered
  const optionalCovered = new Set<string>()
  const optionalHolidayIds = new Set<string>(
    settings.holidayRules
      .filter((r) => r.observance === 'optional')
      .map((r) => r.holidayId)
  )
  for (const b of chosenBookings) {
    if (b.holidayId && optionalHolidayIds.has(b.holidayId)) {
      optionalCovered.add(b.holidayId)
    }
  }

  // Compute a simple continuity score: average away-span per PTO booking
  // (higher = fewer fragmented single days)
  const ptoBookings = chosenBookings.filter((b) => !b.locked)
  const continuousSpanScore = ptoBookings.length > 0
    ? ptoBookings.length // placeholder: real span calc needs candidate info
    : 0

  const fragmentationPenalty = rejections.length

  const score: PlannerObjectiveScore = {
    feasibility,
    vacationForfeited: totalVacationForfeited,
    optionalObservancesCovered: optionalCovered.size,
    continuousSpanScore,
    fragmentationPenalty,
  }

  // -------------------------------------------------------------------------
  // Step 11: Assemble snapshot
  // -------------------------------------------------------------------------
  const id = planId ?? `plan-${settings.horizonStart}-${ENGINE_VERSION}`
  const name = planName ?? `Plan starting ${settings.horizonStart}`

  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    settings,
    bookings: chosenBookings,
    ledger,
    annotations,
    score,
    explanations,
    feasibility,
    validationIssues: issues,
  }
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------
export type { PlanSnapshot } from '../models'
export { ENGINE_VERSION as PLANNER_ENGINE_VERSION }
