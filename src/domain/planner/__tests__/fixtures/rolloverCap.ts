/**
 * src/domain/planner/__tests__/fixtures/rolloverCap.ts
 *
 * Fixture: Vacation balance would exceed rollover cap without planner.
 *
 * Policy year start: July 1 (rollover boundary fires July 1 each year)
 * Grant date:        January 1 (grant fires 6 months BEFORE the boundary)
 * Horizon:           2025-01-01 → 2 years (ends 2027-01-01)
 *
 * Because grant and boundary are on DIFFERENT dates, there is no same-day
 * grant+rollover collision. The demand is straightforward:
 *
 *   At June 30 (day before July 1 boundary):
 *     balance = starting_cap (0) + grant_jan_1 (10) - required_holidays (0)
 *             = 10
 *   Demand = 10 - 3 = 7 days must be used before July 1
 *   June has ~21 workdays → easily achievable.
 *
 * All holidays ignored to keep arithmetic clean and predictable.
 *
 * Expected outcome:
 *   - Zero vacation forfeiture at each July 1 boundary
 *   - Plan is VALID
 *   - chosenBookings includes 'rollover-protection' entries
 */

import type { PlannerSettings, HolidayRule } from '../../../../domain/models'

// All holidays ignored — pure rollover-protection scenario
const ALL_IGNORED: HolidayRule[] = [
  'rosh-hashana-1', 'rosh-hashana-2', 'yom-kippur',
  'sukkot-1', 'sukkot-2', 'shmini-atzeret', 'simchat-torah',
  'pesach-1', 'pesach-2', 'pesach-7', 'pesach-8',
  'shavuot-1', 'shavuot-2',
].map((id) => ({
  holidayId: id,
  observance: 'ignore' as const,
  preferredBankOrder: ['vacation' as const],
}))

export const ROLLOVER_CAP_SETTINGS: PlannerSettings = {
  horizonStart: '2025-01-01',
  horizonYears: 2,
  jewishCalendar: {
    location: 'diaspora',
    timezone: 'America/New_York',
    includeModernHolidays: false,
  },
  employerPolicy: {
    /**
     * Policy year starts July 1; rollover fires July 1.
     * Grant fires January 1 (6 months before rollover).
     * This ensures grant and rollover never collide on the same date,
     * making demand calculation straightforward and loss avoidance possible.
     */
    policyYearStart: { month: 7, day: 1 }, // July 1 rollover boundary
    banks: [
      {
        id: 'vacation',
        label: 'Vacation',
        annualGrant: 10,                     // 10 days/year
        grantDate: { month: 1, day: 1 },     // grant fires Jan 1 (not Jul 1)
        carryoverCap: 3,                     // tight cap
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
        id: 'volunteer',
        label: 'Volunteer Day',
        annualGrant: 0,
        grantDate: { month: 1, day: 1 },
        carryoverCap: null,
        allowNegative: false,
        minimumBalance: 0,
      },
    ],
    startingBalances: {
      vacation: 0,  // Jan 1 2025 grant fires on day 1 → balance = 10
      heritage: 0,
      volunteer: 0,
    },
    weekendDays: [0, 6],
    useUSFederalHolidays: false,
    companyHolidays: [],
    customClosures: [],
  },
  holidayRules: ALL_IGNORED,
  lockedTimeOff: [],
}
