/**
 * src/domain/planner/__tests__/fixtures/negativeBalance.ts
 *
 * Fixture: Negative-balance vacation bank.
 *
 * - allowNegative = true on vacation bank
 * - minimumBalance = -3 (can go down to -3)
 * - Starting balance: 0 (immediately in negative territory after required holidays)
 * - Heritage bank: 0 days (empty)
 * - Only Rosh Hashana and Yom Kippur required (minimal to stress the negative case)
 * - Horizon: 2025-01-06 → 1 year
 *
 * Expected outcome:
 *   - Required holidays are booked
 *   - Balance may go negative but stays ≥ -3
 *   - Plan is VALID (negative balance within configured minimum is allowed)
 */

import type { PlannerSettings, HolidayRule } from '../../../../domain/models'

const MINIMAL_RULES: HolidayRule[] = [
  {
    holidayId: 'rosh-hashana-1',
    observance: 'required',
    preferredBankOrder: ['vacation'],
  },
  {
    holidayId: 'rosh-hashana-2',
    observance: 'required',
    preferredBankOrder: ['vacation'],
  },
  {
    holidayId: 'yom-kippur',
    observance: 'required',
    preferredBankOrder: ['vacation'],
  },
  // All others ignored so we can isolate the negative-balance behavior
  { holidayId: 'sukkot-1',       observance: 'ignore', preferredBankOrder: ['vacation'] },
  { holidayId: 'sukkot-2',       observance: 'ignore', preferredBankOrder: ['vacation'] },
  { holidayId: 'shmini-atzeret', observance: 'ignore', preferredBankOrder: ['vacation'] },
  { holidayId: 'simchat-torah',  observance: 'ignore', preferredBankOrder: ['vacation'] },
  { holidayId: 'pesach-1',       observance: 'ignore', preferredBankOrder: ['vacation'] },
  { holidayId: 'pesach-2',       observance: 'ignore', preferredBankOrder: ['vacation'] },
  { holidayId: 'pesach-7',       observance: 'ignore', preferredBankOrder: ['vacation'] },
  { holidayId: 'pesach-8',       observance: 'ignore', preferredBankOrder: ['vacation'] },
  { holidayId: 'shavuot-1',      observance: 'ignore', preferredBankOrder: ['vacation'] },
  { holidayId: 'shavuot-2',      observance: 'ignore', preferredBankOrder: ['vacation'] },
]

export const NEGATIVE_BALANCE_SETTINGS: PlannerSettings = {
  // Horizon starts Jan 1 so the Jan 1 grant fires immediately
  horizonStart: '2025-01-01',
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
        annualGrant: 3, // only 3 days/year — enough for 3 required holidays
        grantDate: { month: 1, day: 1 },
        carryoverCap: null, // unlimited
        allowNegative: true,
        minimumBalance: -3,
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
    startingBalances: {
      vacation: 0, // starts at 0; gets grant of 3 on Jan 1
      heritage: 0,
      personal: 0,
    },
    weekendDays: [0, 6],
    useUSFederalHolidays: false,
    companyHolidays: [],
    customClosures: [],
  },
  holidayRules: MINIMAL_RULES,
  lockedTimeOff: [],
}
