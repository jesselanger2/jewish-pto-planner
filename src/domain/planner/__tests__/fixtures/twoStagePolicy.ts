/**
 * src/domain/planner/__tests__/fixtures/twoStagePolicy.ts
 *
 * Fixture: Generic policy settings for testing domain mechanisms:
 *   - Two-stage carryover (year-end cap + mid-year use-by deadline)
 *   - Floating holiday bank
 *   - Unpaid observance bank
 *   - Informational-only bank (never schedulable)
 *
 * All numbers are illustrative placeholders — not any employer's actual policy.
 *
 * Key parameters:
 *  - Vacation: monthly accrual (1 day/month), carryoverCap: 10,
 *              carryoverDeadline: April 1 (two distinct cliffs)
 *  - Floating Day: isFloatingHoliday, 1 day, expires at year end
 *  - Observance: unpaid, 10 days, expires at year end
 *  - Community: 1 day, expires at year end
 *  - Informational: 7 days, expires at year end (informational only — not schedulable)
 *  - Policy year: Jan 1
 *  - All holidays ignored to keep arithmetic predictable (unless noted)
 */

import type { PlannerSettings, HolidayRule } from '../../../models'

// All holidays ignored — pure bank behavior tests
export const ALL_IGNORED_RULES: HolidayRule[] = [
  'rosh-hashana-1', 'rosh-hashana-2', 'yom-kippur',
  'sukkot-1', 'sukkot-2', 'shmini-atzeret', 'simchat-torah',
  'pesach-1', 'pesach-2', 'pesach-7', 'pesach-8',
  'shavuot-1', 'shavuot-2',
].map((id) => ({
  holidayId: id,
  observance: 'ignore' as const,
  preferredBankOrder: ['vacation' as const],
}))

/**
 * TWO_STAGE_SETTINGS — horizon 2025-01-01, 2 years.
 * Vacation accrues 1 day/month = 12 days/year. Starting balance: 0.
 * At year-end (Dec 31), any balance > 10 is forfeited (cap cliff).
 * On April 1 of the next year, any remaining carried balance is forfeited
 * (carryover-deadline cliff — second distinct forfeiture event).
 */
export const TWO_STAGE_SETTINGS: PlannerSettings = {
  horizonStart: '2025-01-01',
  horizonYears: 2,
  jewishCalendar: {
    location: 'diaspora',
    timezone: 'America/New_York',
    includeModernHolidays: false,
  },
  employerPolicy: {
    policyYearStart: { month: 1, day: 1 },
    banks: [
      {
        id: 'vacation',
        label: 'Vacation Days',
        annualGrant: 0,
        accrualCadence: 'monthly',
        accrualAmount: 1,            // 1 day/month = 12/year (illustrative)
        carryoverCap: 10,            // year-end cliff: cap at 10 days
        carryoverDeadline: { month: 4, day: 1 }, // April 1: use or lose carried days
        allowNegative: false,
        minimumBalance: 0,
        countsTowardVacationLossInvariant: true,
      },
      {
        id: 'floatingDay',
        label: 'Floating Day',
        annualGrant: 1,
        grantDate: { month: 1, day: 1 },
        isFloatingHoliday: true,
        expiresAtYearEnd: true,
        allowNegative: false,
        minimumBalance: 0,
        countsTowardVacationLossInvariant: false,
      },
      {
        id: 'observance',
        label: 'Observance Days (Unpaid)',
        annualGrant: 10,             // illustrative: up to 10 unpaid observance days
        grantDate: { month: 1, day: 1 },
        unpaid: true,
        expiresAtYearEnd: true,
        allowNegative: false,
        minimumBalance: 0,
        countsTowardVacationLossInvariant: false,
      },
      {
        id: 'community',
        label: 'Community Day',
        annualGrant: 1,
        grantDate: { month: 1, day: 1 },
        expiresAtYearEnd: true,
        allowNegative: false,
        minimumBalance: 0,
        countsTowardVacationLossInvariant: false,
      },
      {
        id: 'informational',
        label: 'Informational Balance (Do Not Schedule)',
        annualGrant: 7,              // informational only — optimizer must never draw from this bank
        grantDate: { month: 1, day: 1 },
        expiresAtYearEnd: true,
        allowNegative: false,
        minimumBalance: 0,
        countsTowardVacationLossInvariant: false,
      },
    ],
    startingBalances: {
      vacation: 0,
      floatingDay: 0,
      observance: 0,
      community: 0,
      informational: 0,
    },
    weekendDays: [0, 6],
    useUSFederalHolidays: false,
    companyHolidays: [],
    customClosures: [],
  },
  holidayRules: ALL_IGNORED_RULES,
  lockedTimeOff: [],
}

/**
 * TWO_STAGE_HIGH_BALANCE_SETTINGS — like TWO_STAGE_SETTINGS but the starting
 * vacation balance is high enough to trigger BOTH forfeiture cliffs:
 *
 *  - Starting balance: 14 (already 4 days over the 10-day cap)
 *  - Year-end cliff fires Jan 1 2026: drops balance from 14+12=26 to 10
 *    (16 days forfeited). With bookings made to reduce to 10, OK.
 *  - But if 10 carry into 2026 and none are used before April 1 2026,
 *    the April 1 cliff also fires: all remaining days forfeited.
 *
 * Used to verify both cliffs fire as distinct events on distinct dates.
 */
export const TWO_STAGE_HIGH_BALANCE_SETTINGS: PlannerSettings = {
  ...TWO_STAGE_SETTINGS,
  horizonStart: '2025-01-01',
  horizonYears: 2,
  employerPolicy: {
    ...TWO_STAGE_SETTINGS.employerPolicy,
    startingBalances: {
      vacation: 14,           // starts over the carryover cap
      floatingDay: 0,
      observance: 0,
      community: 0,
      informational: 0,
    },
  },
}

/**
 * TWO_STAGE_NO_VACATION_PRESSURE — like TWO_STAGE_SETTINGS but with a small
 * annual vacation grant (no accrual, no carryover deadline) so that the
 * vacation zero-loss invariant is easily satisfied.
 * Used to test non-invariant bank behavior in isolation.
 */
export const TWO_STAGE_NO_VACATION_PRESSURE: PlannerSettings = {
  ...TWO_STAGE_SETTINGS,
  employerPolicy: {
    ...TWO_STAGE_SETTINGS.employerPolicy,
    banks: TWO_STAGE_SETTINGS.employerPolicy.banks.map((b) => {
      if (b.id === 'vacation') {
        return {
          id: 'vacation' as const,
          label: 'Vacation Days',
          annualGrant: 5,
          grantDate: { month: 1, day: 1 },
          carryoverCap: 10,
          carryoverDeadline: null,  // null = explicitly no deadline
          allowNegative: false,
          minimumBalance: 0,
          countsTowardVacationLossInvariant: true,
        }
      }
      return b
    }),
    startingBalances: {
      ...TWO_STAGE_SETTINGS.employerPolicy.startingBalances,
      vacation: 0,
    },
  },
}
