/**
 * src/domain/planner/__tests__/fixtures/diasporaVsIsrael.ts
 *
 * Fixture: Diaspora vs. Israel observance differences.
 *
 * In Diaspora: Pesach VIII (8th day) and Shavuot II are required.
 * In Israel:   These second-day festivals do NOT occur per @hebcal.
 *
 * Both settings use the same Hebrew year (5785 = 2025 civil).
 *
 * Expected outcomes:
 *   - diaspora plan has bookings for pesach-8 and shavuot-2 workdays
 *   - israel plan does NOT have bookings for pesach-8 or shavuot-2
 *     (those holidays don't appear in the Israel calendar)
 */

import type { PlannerSettings } from '../../../../domain/models'
import { DEFAULT_HOLIDAY_RULES } from '../../../../domain/holidays/defaultHolidayRules'

const COMMON: Omit<PlannerSettings, 'jewishCalendar'> = {
  horizonStart: '2025-01-01',
  horizonYears: 1,
  employerPolicy: {
    policyYearStart: { month: 1, day: 1 },
    banks: [
      {
        id: 'vacation',
        label: 'Vacation',
        annualGrant: 20,
        grantDate: { month: 1, day: 1 },
        carryoverCap: null, // unlimited — no rollover pressure
        allowNegative: false,
        minimumBalance: 0,
      },
      {
        id: 'heritage',
        label: 'Heritage Days',
        annualGrant: 15,
        grantDate: { month: 1, day: 1 },
        carryoverCap: null,
        allowNegative: false,
        minimumBalance: 0,
      },
      {
        id: 'personal',
        label: 'Personal Days',
        annualGrant: 3,
        grantDate: { month: 1, day: 1 },
        carryoverCap: null,
        allowNegative: false,
        minimumBalance: 0,
      },
    ],
    startingBalances: { vacation: 0, heritage: 0, personal: 0 },
    weekendDays: [0, 6],
    useUSFederalHolidays: false,
    companyHolidays: [],
    customClosures: [],
  },
  holidayRules: DEFAULT_HOLIDAY_RULES,
  lockedTimeOff: [],
}

export const DIASPORA_SETTINGS: PlannerSettings = {
  ...COMMON,
  jewishCalendar: {
    location: 'diaspora',
    timezone: 'America/New_York',
    includeModernHolidays: false,
  },
}

export const ISRAEL_SETTINGS: PlannerSettings = {
  ...COMMON,
  jewishCalendar: {
    location: 'israel',
    timezone: 'Asia/Jerusalem',
    includeModernHolidays: false,
  },
}
