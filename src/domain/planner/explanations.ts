/**
 * src/domain/planner/explanations.ts
 *
 * Generates human-readable PlannerExplanation[] — one per chosen booking —
 * explaining WHY each date was selected and (for non-chosen candidates)
 * why they were rejected.
 *
 * The explanations use the booking's BookingReason plus any related holiday
 * names to produce clear, plain-language sentences like:
 *
 *   "Required observance of Rosh Hashana (vacation bank)"
 *   "Rollover protection — 3 vacation days needed before Jan 1, 2026 cap"
 *   "Optional observance of Shavuot II extended over weekend (heritage bank)"
 *
 * Pure function — no React, no side effects.
 */

import type {
  PlannerExplanation,
  TimeOffBooking,
  NormalizedHoliday,
  PlannerSettings,
} from '../models'
import type { CandidateRejection } from './plannerSelector'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates one PlannerExplanation per booking in `chosenBookings`.
 *
 * @param chosenBookings  Final chosen bookings (including locked)
 * @param holidays        All normalized holiday occurrences (for display names)
 * @param settings        Planner settings (for bank labels)
 * @param rejections      Optional list of candidate rejections for context
 */
export function buildExplanations(
  chosenBookings: TimeOffBooking[],
  holidays: NormalizedHoliday[],
  settings: PlannerSettings,
  _rejections?: CandidateRejection[]
): PlannerExplanation[] {
  // Index holiday display names by id
  const holidayNames = new Map<string, string>()
  for (const h of holidays) {
    if (!holidayNames.has(h.holidayId)) {
      holidayNames.set(h.holidayId, h.displayName)
    }
  }

  // Index bank labels by id
  const bankLabels = new Map<string, string>()
  for (const bank of settings.employerPolicy.banks) {
    bankLabels.set(bank.id, bank.label)
  }
  const bankLabel = (bankId: string) => bankLabels.get(bankId) ?? bankId

  const explanations: PlannerExplanation[] = []

  for (const booking of chosenBookings) {
    const bank = bankLabel(booking.bankId)
    let humanReadable = ''

    switch (booking.reason) {
      case 'required-holiday': {
        const name = booking.holidayId
          ? (holidayNames.get(booking.holidayId) ?? booking.holidayId)
          : 'Jewish holiday'
        humanReadable = `Required observance of ${name} (${bank})`
        break
      }

      case 'optional-holiday': {
        const name = booking.holidayId
          ? (holidayNames.get(booking.holidayId) ?? booking.holidayId)
          : 'Jewish holiday'
        humanReadable = `Optional observance of ${name} (${bank})`
        break
      }

      case 'rollover-protection': {
        const note = booking.note ?? 'rollover deadline'
        humanReadable = `Vacation day used for rollover protection — ${note} (${bank})`
        break
      }

      case 'discretionary': {
        humanReadable = booking.note
          ? `Discretionary PTO — ${booking.note} (${bank})`
          : `Discretionary PTO (${bank})`
        break
      }

      case 'locked': {
        humanReadable = booking.note
          ? `Locked time off — ${booking.note} (${bank})`
          : `Locked time off (${bank})`
        break
      }

      default: {
        humanReadable = `PTO booked on ${booking.date} (${bank})`
        break
      }
    }

    explanations.push({
      bookingId: booking.id,
      reason: booking.reason,
      humanReadable,
    })
  }

  return explanations
}

/**
 * Produces a rejection summary string for display in UI / infeasibility report.
 * Groups rejections by reason category.
 */
export function summarizeRejections(rejections: CandidateRejection[]): string {
  if (rejections.length === 0) return 'No candidates were rejected.'
  const grouped = new Map<string, number>()
  for (const r of rejections) {
    const key = r.reason.split(' ')[0] + '...'
    grouped.set(key, (grouped.get(key) ?? 0) + 1)
  }
  return [...grouped.entries()]
    .map(([k, v]) => `${v}× ${k}`)
    .join('; ')
}
