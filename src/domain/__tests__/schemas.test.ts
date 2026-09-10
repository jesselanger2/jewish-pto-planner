/**
 * Tests for src/domain/schemas.ts
 *
 * Validates that Zod schemas accept valid data and reject invalid data
 * per the spec's validation rules. All test data uses fixed values.
 */
import { describe, expect, it } from 'vitest'
import {
  IsoDateSchema,
  DayUnitsSchema,
  PTOBankPolicySchema,
  EmployerPolicySchema,
  PlannerSettingsSchema,
  HolidayRuleSchema,
  StorageEnvelopeSchema,
} from '../schemas'
import type { PlannerSettings } from '../models'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A minimal valid PlannerSettings object for reuse across tests. */
const validSettings: PlannerSettings = {
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
        carryoverCap: 5,
      },
      {
        id: 'heritage',
        label: 'Heritage Days',
        annualGrant: 5,
        carryoverCap: null, // unlimited
      },
      {
        id: 'personal',
        label: 'Personal',
        annualGrant: 3,
        expiresAtYearEnd: true,
      },
    ],
    startingBalances: { vacation: 10, heritage: 0, personal: 0 },
    weekendDays: [0, 6],
    useUSFederalHolidays: true,
    companyHolidays: [],
    customClosures: [],
  },
  holidayRules: [
    {
      holidayId: 'rosh-hashana-1',
      observance: 'required',
      preferredBankOrder: ['heritage', 'vacation'],
    },
    {
      holidayId: 'yom-kippur',
      observance: 'required',
      preferredBankOrder: ['heritage', 'vacation'],
    },
  ],
  lockedTimeOff: [],
}

// ---------------------------------------------------------------------------
// IsoDateSchema
// ---------------------------------------------------------------------------

describe('IsoDateSchema', () => {
  it('accepts valid dates', () => {
    expect(IsoDateSchema.safeParse('2024-01-01').success).toBe(true)
    expect(IsoDateSchema.safeParse('2024-02-29').success).toBe(true) // leap
    expect(IsoDateSchema.safeParse('2024-12-31').success).toBe(true)
  })

  it('rejects wrong format', () => {
    expect(IsoDateSchema.safeParse('20240101').success).toBe(false)
    expect(IsoDateSchema.safeParse('2024/01/01').success).toBe(false)
    expect(IsoDateSchema.safeParse('').success).toBe(false)
  })

  it('rejects non-existent dates', () => {
    expect(IsoDateSchema.safeParse('2023-02-29').success).toBe(false)
    expect(IsoDateSchema.safeParse('2024-04-31').success).toBe(false)
    expect(IsoDateSchema.safeParse('2024-13-01').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// DayUnitsSchema
// ---------------------------------------------------------------------------

describe('DayUnitsSchema', () => {
  it('accepts non-negative integers', () => {
    expect(DayUnitsSchema.safeParse(0).success).toBe(true)
    expect(DayUnitsSchema.safeParse(15).success).toBe(true)
  })

  it('accepts negative integers (some banks allow negative balances)', () => {
    expect(DayUnitsSchema.safeParse(-5).success).toBe(true)
  })

  it('rejects fractional values', () => {
    expect(DayUnitsSchema.safeParse(1.5).success).toBe(false)
    expect(DayUnitsSchema.safeParse(0.5).success).toBe(false)
  })

  it('rejects non-numbers', () => {
    expect(DayUnitsSchema.safeParse('15').success).toBe(false)
    expect(DayUnitsSchema.safeParse(null).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PTOBankPolicySchema
// ---------------------------------------------------------------------------

describe('PTOBankPolicySchema', () => {
  it('accepts a valid vacation bank with carryoverCap null (unlimited)', () => {
    const result = PTOBankPolicySchema.safeParse({
      id: 'vacation',
      label: 'Vacation',
      annualGrant: 15,
      carryoverCap: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a bank with no carryoverCap field (optional)', () => {
    const result = PTOBankPolicySchema.safeParse({
      id: 'personal',
      label: 'Personal',
      annualGrant: 3,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative carryoverCap (must be null or nonnegative)', () => {
    const result = PTOBankPolicySchema.safeParse({
      id: 'vacation',
      label: 'Vacation',
      annualGrant: 15,
      carryoverCap: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative annualGrant', () => {
    const result = PTOBankPolicySchema.safeParse({
      id: 'vacation',
      label: 'Vacation',
      annualGrant: -5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown bank id', () => {
    const result = PTOBankPolicySchema.safeParse({
      id: 'sick',
      label: 'Sick Leave',
      annualGrant: 10,
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// EmployerPolicySchema
// ---------------------------------------------------------------------------

describe('EmployerPolicySchema', () => {
  it('accepts a valid policy', () => {
    const result = EmployerPolicySchema.safeParse(
      validSettings.employerPolicy
    )
    expect(result.success).toBe(true)
  })

  it('rejects invalid month in policyYearStart', () => {
    const result = EmployerPolicySchema.safeParse({
      ...validSettings.employerPolicy,
      policyYearStart: { month: 13, day: 1 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a company holiday with an invalid date', () => {
    const result = EmployerPolicySchema.safeParse({
      ...validSettings.employerPolicy,
      companyHolidays: [{ date: '2024-02-30', label: 'Made-up holiday' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty banks array', () => {
    const result = EmployerPolicySchema.safeParse({
      ...validSettings.employerPolicy,
      banks: [],
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// HolidayRuleSchema
// ---------------------------------------------------------------------------

describe('HolidayRuleSchema', () => {
  it('accepts valid observance levels', () => {
    for (const observance of ['required', 'optional', 'ignore'] as const) {
      const result = HolidayRuleSchema.safeParse({
        holidayId: 'rosh-hashana-1',
        observance,
        preferredBankOrder: ['heritage'],
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects unknown observance level', () => {
    const result = HolidayRuleSchema.safeParse({
      holidayId: 'yom-kippur',
      observance: 'mandatory', // invalid
      preferredBankOrder: ['heritage'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty preferredBankOrder', () => {
    const result = HolidayRuleSchema.safeParse({
      holidayId: 'yom-kippur',
      observance: 'required',
      preferredBankOrder: [],
    })
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PlannerSettingsSchema
// ---------------------------------------------------------------------------

describe('PlannerSettingsSchema', () => {
  it('accepts a fully valid settings object', () => {
    const result = PlannerSettingsSchema.safeParse(validSettings)
    expect(result.success).toBe(true)
  })

  it('round-trips correctly through Zod (parse → data equals input)', () => {
    const parsed = PlannerSettingsSchema.parse(validSettings)
    expect(parsed.horizonYears).toBe(3)
    expect(parsed.employerPolicy.banks).toHaveLength(3)
    expect(parsed.holidayRules[0].holidayId).toBe('rosh-hashana-1')
  })

  it('rejects horizonYears = 0 (below minimum)', () => {
    const result = PlannerSettingsSchema.safeParse({
      ...validSettings,
      horizonYears: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects horizonYears = 6 (above maximum)', () => {
    const result = PlannerSettingsSchema.safeParse({
      ...validSettings,
      horizonYears: 6,
    })
    expect(result.success).toBe(false)
  })

  it('rejects horizonYears = 1.5 (fractional)', () => {
    const result = PlannerSettingsSchema.safeParse({
      ...validSettings,
      horizonYears: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('accepts horizonYears at boundary values 1 and 5', () => {
    expect(
      PlannerSettingsSchema.safeParse({ ...validSettings, horizonYears: 1 }).success
    ).toBe(true)
    expect(
      PlannerSettingsSchema.safeParse({ ...validSettings, horizonYears: 5 }).success
    ).toBe(true)
  })

  it('rejects an invalid horizonStart date', () => {
    const result = PlannerSettingsSchema.safeParse({
      ...validSettings,
      horizonStart: '2025-13-01',
    })
    expect(result.success).toBe(false)
  })

  it('accepts carryoverCap: null (unlimited)', () => {
    const settings = {
      ...validSettings,
      employerPolicy: {
        ...validSettings.employerPolicy,
        banks: [
          { id: 'vacation', label: 'Vacation', annualGrant: 15, carryoverCap: null },
          { id: 'heritage', label: 'Heritage', annualGrant: 5 },
          { id: 'personal', label: 'Personal', annualGrant: 3 },
        ],
      },
    }
    expect(PlannerSettingsSchema.safeParse(settings).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// StorageEnvelopeSchema
// ---------------------------------------------------------------------------

describe('StorageEnvelopeSchema', () => {
  it('accepts a valid envelope', () => {
    const result = StorageEnvelopeSchema.safeParse({
      schemaVersion: 1,
      data: { some: 'payload' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing schemaVersion', () => {
    const result = StorageEnvelopeSchema.safeParse({ data: {} })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer schemaVersion', () => {
    const result = StorageEnvelopeSchema.safeParse({ schemaVersion: 1.5, data: {} })
    expect(result.success).toBe(false)
  })

  it('accepts null data (valid unknown)', () => {
    const result = StorageEnvelopeSchema.safeParse({ schemaVersion: 1, data: null })
    expect(result.success).toBe(true)
  })
})
