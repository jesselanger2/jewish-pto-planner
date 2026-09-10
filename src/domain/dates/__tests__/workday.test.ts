/**
 * Tests for src/domain/dates/workday.ts and federalHolidays.ts
 *
 * All tests use fixed dates — never the system clock.
 */
import { describe, expect, it } from 'vitest'
import { classifyDay, isNonWorkday } from '../workday'
import { getUSFederalHolidays } from '../federalHolidays'
import type { EmployerPolicy } from '../../models'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Standard Mon–Fri US employer, federal holidays enabled. */
const basePolicy: EmployerPolicy = {
  policyYearStart: { month: 1, day: 1 },
  banks: [
    { id: 'vacation', label: 'Vacation', annualGrant: 15 },
    { id: 'heritage', label: 'Heritage', annualGrant: 5 },
    { id: 'personal', label: 'Personal', annualGrant: 3 },
  ],
  startingBalances: { vacation: 10, heritage: 0, personal: 0 },
  weekendDays: [0, 6], // Sun + Sat
  useUSFederalHolidays: true,
  companyHolidays: [],
  customClosures: [],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function policy(overrides: Partial<EmployerPolicy>): EmployerPolicy {
  return { ...basePolicy, ...overrides }
}

// ---------------------------------------------------------------------------
// getUSFederalHolidays — observed-date shifting
// ---------------------------------------------------------------------------

describe('getUSFederalHolidays — observed-day shifting', () => {
  it('New Year 2023: Jan 1 is Sunday → observed Monday Jan 2', () => {
    const map = getUSFederalHolidays(2023)
    expect(map.has('2023-01-02')).toBe(true)
    expect(map.has('2023-01-01')).toBe(false)
    expect(map.get('2023-01-02')?.name).toBe("New Year's Day")
  })

  it('Christmas 2022: Dec 25 is Sunday → observed Monday Dec 26', () => {
    const map = getUSFederalHolidays(2022)
    expect(map.has('2022-12-26')).toBe(true)
    expect(map.has('2022-12-25')).toBe(false)
  })

  it('Independence Day 2020: Jul 4 is Saturday → observed Friday Jul 3', () => {
    const map = getUSFederalHolidays(2020)
    expect(map.has('2020-07-03')).toBe(true)
    expect(map.has('2020-07-04')).toBe(false)
  })

  it('Independence Day 2021: Jul 4 is Sunday → observed Monday Jul 5', () => {
    const map = getUSFederalHolidays(2021)
    expect(map.has('2021-07-05')).toBe(true)
    expect(map.has('2021-07-04')).toBe(false)
  })

  it('Veterans Day 2023: Nov 11 is Saturday → observed Friday Nov 10', () => {
    const map = getUSFederalHolidays(2023)
    expect(map.has('2023-11-10')).toBe(true)
    expect(map.has('2023-11-11')).toBe(false)
  })

  it('Juneteenth 2023: Jun 19 is Monday → observed same day', () => {
    const map = getUSFederalHolidays(2023)
    expect(map.has('2023-06-19')).toBe(true)
  })

  it('MLK 2024: 3rd Monday of January → Jan 15', () => {
    const map = getUSFederalHolidays(2024)
    expect(map.has('2024-01-15')).toBe(true)
  })

  it('Thanksgiving 2024: 4th Thursday of November → Nov 28', () => {
    const map = getUSFederalHolidays(2024)
    expect(map.has('2024-11-28')).toBe(true)
  })

  it('Memorial Day 2024: last Monday of May → May 27', () => {
    const map = getUSFederalHolidays(2024)
    expect(map.has('2024-05-27')).toBe(true)
  })

  it('produces exactly 11 observed dates per year', () => {
    expect(getUSFederalHolidays(2024).size).toBe(11)
    expect(getUSFederalHolidays(2023).size).toBe(11)
  })
})

// ---------------------------------------------------------------------------
// classifyDay — weekends
// ---------------------------------------------------------------------------

describe('classifyDay — weekends', () => {
  it('classifies Saturday as weekend (default Sun+Sat)', () => {
    const result = classifyDay('2024-01-06', basePolicy) // Saturday
    expect(result.classification).toBe('weekend')
  })

  it('classifies Sunday as weekend (default Sun+Sat)', () => {
    const result = classifyDay('2024-01-07', basePolicy) // Sunday
    expect(result.classification).toBe('weekend')
  })

  it('classifies Monday as workday (default Sun+Sat weekend)', () => {
    const result = classifyDay('2024-01-08', basePolicy) // Monday
    expect(result.classification).toBe('workday')
  })

  it('respects configurable weekends: Mon–Fri weekends', () => {
    const p = policy({ weekendDays: [1, 2, 3, 4, 5] }) // Fri-Mon off (e.g. Middle East)
    expect(classifyDay('2024-01-08', p).classification).toBe('weekend') // Monday
    expect(classifyDay('2024-01-12', p).classification).toBe('weekend') // Friday
    expect(classifyDay('2024-01-06', p).classification).toBe('workday') // Saturday
    expect(classifyDay('2024-01-07', p).classification).toBe('workday') // Sunday
  })

  it('respects Saturday-only weekend', () => {
    const p = policy({ weekendDays: [6] }) // Sat only
    expect(classifyDay('2024-01-06', p).classification).toBe('weekend') // Sat
    expect(classifyDay('2024-01-07', p).classification).not.toBe('weekend') // Sun is workday
  })
})

// ---------------------------------------------------------------------------
// classifyDay — US federal holidays
// ---------------------------------------------------------------------------

describe('classifyDay — US federal holidays', () => {
  it('classifies an observed federal holiday correctly (Jul 4 2025 Fri)', () => {
    // 2025: Jul 4 is a Friday — observed same day
    const result = classifyDay('2025-07-04', basePolicy)
    expect(result.classification).toBe('federal-holiday')
    expect(result.reason).toContain('Independence Day')
  })

  it('classifies observed New Year 2023 on Jan 2 as federal holiday', () => {
    const result = classifyDay('2023-01-02', basePolicy)
    expect(result.classification).toBe('federal-holiday')
  })

  it('does NOT classify the statutory date (Jan 1 2023, Sunday) as federal holiday when observed is Monday', () => {
    // Jan 1 2023 is a Sunday (weekend), so it should be classified as weekend, not federal
    const result = classifyDay('2023-01-01', basePolicy)
    expect(result.classification).toBe('weekend')
  })

  it('does not classify federal holidays when useUSFederalHolidays = false', () => {
    const p = policy({ useUSFederalHolidays: false })
    // 2024 Christmas is Wednesday Dec 25
    const result = classifyDay('2024-12-25', p)
    expect(result.classification).toBe('workday')
  })

  it('classifies Thanksgiving 2024 as federal-holiday', () => {
    const result = classifyDay('2024-11-28', basePolicy)
    expect(result.classification).toBe('federal-holiday')
    expect(result.reason).toContain('Thanksgiving')
  })
})

// ---------------------------------------------------------------------------
// classifyDay — company holidays and custom closures
// ---------------------------------------------------------------------------

describe('classifyDay — company holidays', () => {
  it('classifies a company holiday', () => {
    const p = policy({
      companyHolidays: [{ date: '2024-06-14', label: 'Company Picnic Day' }],
    })
    const result = classifyDay('2024-06-14', p)
    expect(result.classification).toBe('company-holiday')
    expect(result.reason).toContain('Company Picnic Day')
  })

  it('company holiday takes priority over weekend', () => {
    // Jun 15 2024 is a Saturday
    const p = policy({
      companyHolidays: [{ date: '2024-06-15', label: 'Special Friday' }],
    })
    const result = classifyDay('2024-06-15', p)
    // Saturday is also a weekend — company-holiday wins (priority 2 > 3)
    // Actually custom-closure would win, but company-holiday > weekend
    expect(result.classification).toBe('company-holiday')
  })

  it('company holiday takes priority over US federal holiday', () => {
    // Thanksgiving 2024 is Nov 28 (Thu) — override with custom label
    const p = policy({
      companyHolidays: [
        { date: '2024-11-28', label: 'Thanksgiving (Custom)' },
      ],
    })
    const result = classifyDay('2024-11-28', p)
    expect(result.classification).toBe('company-holiday')
  })
})

describe('classifyDay — custom closures', () => {
  it('classifies a custom closure', () => {
    const p = policy({
      customClosures: [{ date: '2024-08-05', label: 'Office Move' }],
    })
    const result = classifyDay('2024-08-05', p)
    expect(result.classification).toBe('custom-closure')
    expect(result.reason).toContain('Office Move')
  })

  it('custom closure overrides company holiday (highest priority)', () => {
    const p = policy({
      companyHolidays: [{ date: '2024-08-05', label: 'Team Outing' }],
      customClosures: [{ date: '2024-08-05', label: 'Emergency Closure' }],
    })
    const result = classifyDay('2024-08-05', p)
    expect(result.classification).toBe('custom-closure')
  })

  it('custom closure on a Sunday still returns custom-closure', () => {
    // Aug 4 2024 is Sunday
    const p = policy({
      customClosures: [{ date: '2024-08-04', label: 'Weekend Closure' }],
    })
    const result = classifyDay('2024-08-04', p)
    expect(result.classification).toBe('custom-closure')
  })
})

// ---------------------------------------------------------------------------
// classifyDay — workday default
// ---------------------------------------------------------------------------

describe('classifyDay — workday default', () => {
  it('classifies a plain Tuesday as workday', () => {
    const result = classifyDay('2024-06-11', basePolicy) // Tuesday
    expect(result.classification).toBe('workday')
    expect(result.reason).toBe('Workday')
  })
})

// ---------------------------------------------------------------------------
// isNonWorkday
// ---------------------------------------------------------------------------

describe('isNonWorkday', () => {
  it('returns true for weekends', () => {
    expect(isNonWorkday('2024-01-06', basePolicy)).toBe(true) // Saturday
  })

  it('returns true for federal holidays', () => {
    expect(isNonWorkday('2024-11-28', basePolicy)).toBe(true) // Thanksgiving
  })

  it('returns false for workdays', () => {
    expect(isNonWorkday('2024-06-11', basePolicy)).toBe(false)
  })
})
