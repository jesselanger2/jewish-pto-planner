/**
 * src/domain/planner/__tests__/fixtures/normalCase.ts
 *
 * Fixture: Normal 3-year Diaspora plan.
 *
 * - January policy year (starts Jan 1)
 * - Horizon: 2025-01-01 → 3 years
 * - Vacation bank: 15 days/year, NO rollover cap (unlimited carryover)
 * - Heritage bank: 10 days/year (grant Jan 1), expires at year end
 * - Personal bank: 3 days/year, unlimited carryover
 * - Standard Diaspora observance profile (all major holidays required)
 *
 * Using unlimited vacation carryover means there is no rollover demand,
 * so the plan only needs to cover required holidays. With 15 vacation
 * and 10 heritage per year, and ~12 required holiday workdays, there
 * are ample days and the plan is always feasible.
 *
 * Expected outcome:
 *   - All required holiday workdays covered
 *   - Zero vacation forfeiture (carryoverCap is null → no cap)
 *   - Plan is VALID (feasible)
 */

import type { PlannerSettings } from '../../../../domain/models'
import { DEFAULT_HOLIDAY_RULES } from '../../../../domain/holidays/defaultHolidayRules'

export const NORMAL_CASE_SETTINGS: PlannerSettings = {
  horizonStart: '2025-01-01',
  horizonYears: 3,
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
        annualGrant: 15,
        grantDate: { month: 1, day: 1 },
        carryoverCap: null, // unlimited — no rollover pressure
        allowNegative: false,
        minimumBalance: 0,
      },
      {
        id: 'heritage',
        label: 'Heritage Days',
        annualGrant: 10,
        grantDate: { month: 1, day: 1 },
        expiresAtYearEnd: true,
        allowNegative: false,
        minimumBalance: 0,
      },
      {
        id: 'volunteer',
        label: 'Volunteer Day',
        annualGrant: 3,
        grantDate: { month: 1, day: 1 },
        carryoverCap: null,
        allowNegative: false,
        minimumBalance: 0,
      },
    ],
    startingBalances: {
      vacation: 0,
      heritage: 0,
      volunteer: 0,
    },
    weekendDays: [0, 6], // Sun, Sat
    useUSFederalHolidays: true,
    companyHolidays: [],
    customClosures: [],
  },
  holidayRules: DEFAULT_HOLIDAY_RULES,
  lockedTimeOff: [],
}
