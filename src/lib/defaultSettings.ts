/**
 * src/lib/defaultSettings.ts
 *
 * Factory that produces a fully-valid PlannerSettings with conservative,
 * editable defaults. Never hard-codes one person's practice as universal.
 *
 * The horizonStart is set to the first day of the current month so the
 * plan always starts at a clean boundary, matching user expectations.
 */

import type { PlannerSettings } from '../domain/models'
import { DEFAULT_HOLIDAY_RULES } from '../domain/holidays/defaultHolidayRules'

function firstOfMonth(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export function makeDefaultSettings(): PlannerSettings {
  const today = new Date()
  return {
    horizonStart: firstOfMonth(today),
    horizonYears: 3,
    jewishCalendar: {
      location: 'diaspora',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      includeModernHolidays: false,
    },
    employerPolicy: {
      policyYearStart: { month: 1, day: 1 },
      banks: [
        {
          id: 'vacation',
          label: 'Vacation Days',
          annualGrant: 15,
          accrualCadence: 'annual',
          accrualAmount: 15,
          carryoverCap: 10,
          allowNegative: false,
          minimumBalance: 0,
          countsTowardVacationLossInvariant: true,
        },
        {
          id: 'heritage',
          label: 'Heritage Days',
          annualGrant: 3,
          accrualCadence: 'annual',
          accrualAmount: 3,
          carryoverCap: null, // unlimited
          allowNegative: false,
          minimumBalance: 0,
          countsTowardVacationLossInvariant: false,
        },
      ],
      startingBalances: {
        vacation: 0,
        heritage: 0,
      },
      weekendDays: [0, 6], // Sun + Sat
      useUSFederalHolidays: true,
      companyHolidays: [],
      customClosures: [],
    },
    holidayRules: DEFAULT_HOLIDAY_RULES,
    lockedTimeOff: [],
  }
}
