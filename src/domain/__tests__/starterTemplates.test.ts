/**
 * src/domain/__tests__/starterTemplates.test.ts
 *
 * Tests for the generic starter templates.
 * Verifies each template:
 *   - Parses through PlannerSettingsSchema without errors
 *   - Demonstrates the distinct mechanism it is meant to illustrate
 * Also tests the fully-custom end-to-end path: blank policy → valid settings.
 *
 * All fixture dates are fixed. No dependency on system date.
 */
import { describe, expect, it } from 'vitest'
import {
  SIMPLE_ACCRUAL_TEMPLATE,
  ANNUAL_GRANT_TEMPLATE,
  TWO_STAGE_CARRYOVER_TEMPLATE,
  UNPAID_OBSERVANCE_TEMPLATE,
  CUSTOM_TEMPLATE,
  ALL_STARTER_TEMPLATES,
  getTemplateById,
  type StarterTemplate,
} from '../presets/starterTemplates'
import { PlannerSettingsSchema } from '../schemas'
import type { PlannerSettings } from '../models'
import { DEFAULT_HOLIDAY_RULES } from '../holidays/defaultHolidayRules'

// ---------------------------------------------------------------------------
// Helper: build a valid PlannerSettings from a template
// ---------------------------------------------------------------------------

function settingsFromTemplate(template: StarterTemplate): PlannerSettings {
  return {
    horizonStart: '2025-01-01',
    horizonYears: 3,
    jewishCalendar: {
      location: 'diaspora',
      timezone: 'America/New_York',
      includeModernHolidays: false,
    },
    employerPolicy: {
      policyYearStart: { month: 1, day: 1 },
      banks: template.banks,
      startingBalances: template.startingBalances,
      weekendDays: [0, 6],
      useUSFederalHolidays: true,
      companyHolidays: [],
      customClosures: [],
    },
    holidayRules: DEFAULT_HOLIDAY_RULES,
    lockedTimeOff: [],
  }
}

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

describe('ALL_STARTER_TEMPLATES', () => {
  it('contains exactly 4 named templates', () => {
    expect(ALL_STARTER_TEMPLATES).toHaveLength(4)
  })

  it('has unique ids', () => {
    const ids = ALL_STARTER_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('CUSTOM_TEMPLATE has id "custom"', () => {
    expect(CUSTOM_TEMPLATE.id).toBe('custom')
  })
})

describe('getTemplateById', () => {
  it('returns the correct template by id', () => {
    expect(getTemplateById('simple-accrual')).toBe(SIMPLE_ACCRUAL_TEMPLATE)
    expect(getTemplateById('annual-grant')).toBe(ANNUAL_GRANT_TEMPLATE)
    expect(getTemplateById('two-stage-carryover')).toBe(TWO_STAGE_CARRYOVER_TEMPLATE)
    expect(getTemplateById('unpaid-observance')).toBe(UNPAID_OBSERVANCE_TEMPLATE)
    expect(getTemplateById('custom')).toBe(CUSTOM_TEMPLATE)
  })

  it('returns null for unknown id', () => {
    expect(getTemplateById('not-a-real-template')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Template 1: Simple Accrual with Rollover Cap
// ---------------------------------------------------------------------------

describe('SIMPLE_ACCRUAL_TEMPLATE', () => {
  it('parses through PlannerSettingsSchema', () => {
    const result = PlannerSettingsSchema.safeParse(settingsFromTemplate(SIMPLE_ACCRUAL_TEMPLATE))
    expect(result.success).toBe(true)
  })

  it('has a vacation bank with monthly accrual', () => {
    const vac = SIMPLE_ACCRUAL_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vac).toBeDefined()
    expect(vac!.accrualCadence).toBe('monthly')
    expect(typeof vac!.accrualAmount).toBe('number')
    expect(vac!.accrualAmount).toBeGreaterThan(0)
  })

  it('has a carryoverCap on the vacation bank', () => {
    const vac = SIMPLE_ACCRUAL_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vac!.carryoverCap).toBeGreaterThan(0)
  })

  it('does NOT have a carryoverDeadline (single cliff only)', () => {
    const vac = SIMPLE_ACCRUAL_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vac!.carryoverDeadline).toBeUndefined()
  })

  it('has countsTowardVacationLossInvariant true on vacation bank', () => {
    const vac = SIMPLE_ACCRUAL_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vac!.countsTowardVacationLossInvariant).toBe(true)
  })

  it('all starting balances are zero', () => {
    for (const v of Object.values(SIMPLE_ACCRUAL_TEMPLATE.startingBalances)) {
      expect(v).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Template 2: Annual Grant, No Carryover
// ---------------------------------------------------------------------------

describe('ANNUAL_GRANT_TEMPLATE', () => {
  it('parses through PlannerSettingsSchema', () => {
    const result = PlannerSettingsSchema.safeParse(settingsFromTemplate(ANNUAL_GRANT_TEMPLATE))
    expect(result.success).toBe(true)
  })

  it('has a vacation bank with a positive annualGrant', () => {
    const vac = ANNUAL_GRANT_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vac).toBeDefined()
    expect(vac!.annualGrant).toBeGreaterThan(0)
  })

  it('vacation bank expires at year end (no carryover)', () => {
    const vac = ANNUAL_GRANT_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vac!.expiresAtYearEnd).toBe(true)
  })

  it('vacation bank has NO monthly accrual', () => {
    const vac = ANNUAL_GRANT_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vac!.accrualCadence).not.toBe('monthly')
  })

  it('has no carryoverCap (expires instead)', () => {
    const vac = ANNUAL_GRANT_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vac!.carryoverCap).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Template 3: Two-Stage Carryover with Use-By Deadline
// ---------------------------------------------------------------------------

describe('TWO_STAGE_CARRYOVER_TEMPLATE', () => {
  it('parses through PlannerSettingsSchema', () => {
    const result = PlannerSettingsSchema.safeParse(settingsFromTemplate(TWO_STAGE_CARRYOVER_TEMPLATE))
    expect(result.success).toBe(true)
  })

  it('vacation bank has BOTH carryoverCap AND carryoverDeadline (two distinct cliffs)', () => {
    const vac = TWO_STAGE_CARRYOVER_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vac).toBeDefined()
    expect(vac!.carryoverCap).toBeGreaterThan(0)
    expect(vac!.carryoverDeadline).toBeDefined()
    expect(vac!.carryoverDeadline!.month).toBeGreaterThanOrEqual(1)
    expect(vac!.carryoverDeadline!.month).toBeLessThanOrEqual(12)
    expect(vac!.carryoverDeadline!.day).toBeGreaterThanOrEqual(1)
    expect(vac!.carryoverDeadline!.day).toBeLessThanOrEqual(31)
  })

  it('carryoverDeadline falls after the policy year start (it is a mid-year second cliff)', () => {
    const vac = TWO_STAGE_CARRYOVER_TEMPLATE.banks.find((b) => b.id === 'vacation')
    // The deadline must not be on January 1 (that would be the same as the year boundary)
    const d = vac!.carryoverDeadline!
    const isJan1 = d.month === 1 && d.day === 1
    expect(isJan1).toBe(false)
  })

  it('has monthly accrual on the vacation bank', () => {
    const vac = TWO_STAGE_CARRYOVER_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vac!.accrualCadence).toBe('monthly')
  })
})

// ---------------------------------------------------------------------------
// Template 4: Unpaid Observance Bank with Paid Substitution
// ---------------------------------------------------------------------------

describe('UNPAID_OBSERVANCE_TEMPLATE', () => {
  it('parses through PlannerSettingsSchema', () => {
    const result = PlannerSettingsSchema.safeParse(settingsFromTemplate(UNPAID_OBSERVANCE_TEMPLATE))
    expect(result.success).toBe(true)
  })

  it('has an unpaid bank', () => {
    const unpaidBank = UNPAID_OBSERVANCE_TEMPLATE.banks.find((b) => b.unpaid === true)
    expect(unpaidBank).toBeDefined()
  })

  it('has a paid vacation bank alongside the unpaid bank', () => {
    const vacBank = UNPAID_OBSERVANCE_TEMPLATE.banks.find((b) => b.id === 'vacation')
    expect(vacBank).toBeDefined()
    expect(vacBank!.unpaid).toBeFalsy()
  })

  it('suggestedBankOrder lists unpaid bank first (unpaid-first default)', () => {
    const firstBankId = UNPAID_OBSERVANCE_TEMPLATE.suggestedBankOrder[0]
    const firstBank = UNPAID_OBSERVANCE_TEMPLATE.banks.find((b) => b.id === firstBankId)
    expect(firstBank!.unpaid).toBe(true)
  })

  it('unpaid bank has countsTowardVacationLossInvariant false', () => {
    const unpaidBank = UNPAID_OBSERVANCE_TEMPLATE.banks.find((b) => b.unpaid === true)
    expect(unpaidBank!.countsTowardVacationLossInvariant).toBe(false)
  })

  it('unpaid bank annual grant is positive (observance days available)', () => {
    const unpaidBank = UNPAID_OBSERVANCE_TEMPLATE.banks.find((b) => b.unpaid === true)
    expect(unpaidBank!.annualGrant).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Custom (blank-slate) template
// ---------------------------------------------------------------------------

describe('CUSTOM_TEMPLATE', () => {
  it('parses through PlannerSettingsSchema', () => {
    const result = PlannerSettingsSchema.safeParse(settingsFromTemplate(CUSTOM_TEMPLATE))
    expect(result.success).toBe(true)
  })

  it('all bank annual grants are zero', () => {
    for (const bank of CUSTOM_TEMPLATE.banks) {
      expect(bank.annualGrant).toBe(0)
    }
  })

  it('all starting balances are zero', () => {
    for (const v of Object.values(CUSTOM_TEMPLATE.startingBalances)) {
      expect(v).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// End-to-end: fully-custom path produces a valid PlannerSettings
// ---------------------------------------------------------------------------

describe('Fully-custom path end-to-end', () => {
  it('custom template → valid PlannerSettings through Zod', () => {
    // Simulate user selecting custom, then editing one bank grant
    const userEditedPolicy = {
      ...settingsFromTemplate(CUSTOM_TEMPLATE),
      employerPolicy: {
        ...settingsFromTemplate(CUSTOM_TEMPLATE).employerPolicy,
        banks: [
          {
            ...CUSTOM_TEMPLATE.banks[0],
            label: 'My Vacation',
            annualGrant: 20,
            carryoverCap: 10,
          },
        ],
        startingBalances: { vacation: 5 },
      },
    }
    const result = PlannerSettingsSchema.safeParse(userEditedPolicy)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.employerPolicy.banks[0].annualGrant).toBe(20)
      expect(result.data.employerPolicy.startingBalances.vacation).toBe(5)
    }
  })

  it('custom template produces a blank policy without any Citi-specific values', () => {
    const settings = settingsFromTemplate(CUSTOM_TEMPLATE)
    // No bank should reference any branded specific value
    for (const bank of settings.employerPolicy.banks) {
      // carryoverDeadline { month: 4, day: 1 } was the Citi-specific value
      if (bank.carryoverDeadline) {
        const isApril1 = bank.carryoverDeadline.month === 4 && bank.carryoverDeadline.day === 1
        // It's fine if another template uses April 1, but not the custom template
        expect(isApril1).toBe(false)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// No template contains the branded "Heritage Day" or "Religious Observance" labels
// that were Citi-specific (generic labels are fine; only the Citi-branded ones must go)
// ---------------------------------------------------------------------------

describe('No Citi branding in any template', () => {
  const allTemplates = [...ALL_STARTER_TEMPLATES, CUSTOM_TEMPLATE]

  it('no template name contains "Citi"', () => {
    for (const t of allTemplates) {
      expect(t.name.toLowerCase()).not.toContain('citi')
    }
  })

  it('no bank label contains "Citi"', () => {
    for (const t of allTemplates) {
      for (const bank of t.banks) {
        expect(bank.label.toLowerCase()).not.toContain('citi')
      }
    }
  })

  it('no template description contains "Citi"', () => {
    for (const t of allTemplates) {
      expect(t.description.toLowerCase()).not.toContain('citi')
    }
  })
})
