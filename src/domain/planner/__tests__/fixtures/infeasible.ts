/**
 * src/domain/planner/__tests__/fixtures/infeasible.ts
 *
 * Fixture: Genuinely infeasible scenario.
 *
 * The rollover cap (2 days) is so tight, and the window before the rollover
 * boundary is so short (the horizon starts on Dec 20), that there are simply
 * not enough workdays before Jan 1 to absorb the excess vacation.
 *
 * Setup:
 *   - Vacation grant: 20 days on Jan 1
 *   - Carryover cap: 2 days
 *   - Horizon starts: Dec 20, 2025 (only ~8 calendar days before Jan 1 2026)
 *   - The Dec 20-31 window has at most ~8 workdays, but the grant doesn't
 *     happen until Jan 1 (the upcoming boundary). So the opening balance
 *     of 20 - 2 = 18 days must be consumed in [Dec 20, Dec 31], which has
 *     at most ~8 workdays. With 18 days demand and ~8 available → infeasible.
 *
 * More precisely:
 *   - startingBalance = 20 (already granted, simulating mid-year start)
 *   - carryoverCap = 2
 *   - Only company-holiday closures on Dec 25 (Christmas as company holiday)
 *   - Horizon is just 1 year from Dec 20
 *   - No required holidays in this window (so no other bookings consume days)
 *   - Demand = 20 - 2 = 18 days before Jan 1 2026
 *   - Available workdays Dec 20–31: Dec 20(Mon), 22(Wed)... ~8 at most
 *
 * Expected outcome:
 *   - feasibility = 'infeasible'
 *   - validationIssues contains 'vacation-loss-at-rollover'
 *   - projectedLossDays > 0
 */

import type { PlannerSettings, HolidayRule } from '../../../../domain/models'

// All holidays ignored to isolate the rollover-loss scenario
const ALL_IGNORED: HolidayRule[] = [
  'rosh-hashana-1', 'rosh-hashana-2', 'yom-kippur',
  'sukkot-1', 'sukkot-2', 'shmini-atzeret', 'simchat-torah',
  'pesach-1', 'pesach-2', 'pesach-7', 'pesach-8',
  'shavuot-1', 'shavuot-2',
].map((id) => ({ holidayId: id, observance: 'ignore' as const, preferredBankOrder: ['vacation' as const] }))

export const INFEASIBLE_SETTINGS: PlannerSettings = {
  // Start just 12 days before the Jan 1 rollover
  horizonStart: '2025-12-20',
  horizonYears: 1,
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
        label: 'Vacation',
        annualGrant: 0,  // No new grant — we use starting balance
        grantDate: { month: 1, day: 1 },
        carryoverCap: 2, // only 2 days can roll over
        allowNegative: false,
        minimumBalance: 0,
      },
      {
        id: 'heritage',
        label: 'Heritage Days',
        annualGrant: 0,
        grantDate: { month: 1, day: 1 },
        carryoverCap: null,
        allowNegative: false,
        minimumBalance: 0,
      },
      {
        id: 'personal',
        label: 'Personal Days',
        annualGrant: 0,
        grantDate: { month: 1, day: 1 },
        carryoverCap: null,
        allowNegative: false,
        minimumBalance: 0,
      },
    ],
    // Starting balance: 20 days — but cap is 2, and window is only 8 workdays
    startingBalances: {
      vacation: 20,
      heritage: 0,
      personal: 0,
    },
    weekendDays: [0, 6], // Sun + Sat
    useUSFederalHolidays: false,
    // Dec 25 is a company holiday (reduces available workdays further)
    companyHolidays: [
      { date: '2025-12-25', label: 'Christmas' },
      { date: '2025-12-26', label: 'Christmas (observed)' },
    ],
    customClosures: [],
  },
  holidayRules: ALL_IGNORED,
  lockedTimeOff: [],
}
