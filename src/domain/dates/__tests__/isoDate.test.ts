/**
 * Tests for src/domain/dates/isoDate.ts
 *
 * All tests use fixed dates — no system clock dependency.
 */
import { describe, expect, it } from 'vitest'
import {
  addDays,
  compareDates,
  dayOfWeek,
  diffDays,
  daysInMonth,
  isoDateFromDate,
  isoDateRange,
  isLeapYear,
  isValidIsoDate,
  maxDate,
  minDate,
  parseIsoDate,
  toIsoDate,
} from '../isoDate'

// ---------------------------------------------------------------------------
// isValidIsoDate
// ---------------------------------------------------------------------------

describe('isValidIsoDate', () => {
  it('accepts valid dates', () => {
    expect(isValidIsoDate('2024-01-01')).toBe(true)
    expect(isValidIsoDate('2024-02-29')).toBe(true) // leap year
    expect(isValidIsoDate('2023-12-31')).toBe(true)
  })

  it('rejects wrong format', () => {
    expect(isValidIsoDate('2024-1-1')).toBe(false)
    expect(isValidIsoDate('20240101')).toBe(false)
    expect(isValidIsoDate('2024/01/01')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
    expect(isValidIsoDate('not-a-date')).toBe(false)
  })

  it('rejects non-existent dates', () => {
    expect(isValidIsoDate('2023-02-29')).toBe(false) // not a leap year
    expect(isValidIsoDate('2024-04-31')).toBe(false) // April has 30 days
    expect(isValidIsoDate('2024-13-01')).toBe(false) // month 13
    expect(isValidIsoDate('2024-00-01')).toBe(false) // month 0
    expect(isValidIsoDate('2024-01-00')).toBe(false) // day 0
  })
})

// ---------------------------------------------------------------------------
// toIsoDate / parseIsoDate
// ---------------------------------------------------------------------------

describe('toIsoDate', () => {
  it('pads single-digit month and day', () => {
    expect(toIsoDate(2024, 1, 5)).toBe('2024-01-05')
  })

  it('throws for invalid combinations', () => {
    expect(() => toIsoDate(2023, 2, 29)).toThrow(RangeError)
    expect(() => toIsoDate(2024, 13, 1)).toThrow(RangeError)
  })
})

describe('parseIsoDate', () => {
  it('returns correct parts', () => {
    expect(parseIsoDate('2024-03-15')).toEqual({ year: 2024, month: 3, day: 15 })
  })

  it('throws for invalid date', () => {
    expect(() => parseIsoDate('2023-02-29')).toThrow(RangeError)
    expect(() => parseIsoDate('bad')).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// isLeapYear / daysInMonth
// ---------------------------------------------------------------------------

describe('isLeapYear', () => {
  it('identifies leap years correctly', () => {
    expect(isLeapYear(2000)).toBe(true)  // divisible by 400
    expect(isLeapYear(2024)).toBe(true)  // divisible by 4, not 100
    expect(isLeapYear(1900)).toBe(false) // divisible by 100 but not 400
    expect(isLeapYear(2023)).toBe(false) // not divisible by 4
  })
})

describe('daysInMonth', () => {
  it('returns 28 for Feb in a non-leap year', () => {
    expect(daysInMonth(2023, 2)).toBe(28)
  })

  it('returns 29 for Feb in a leap year', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
  })

  it('returns correct days for 30-day months', () => {
    expect(daysInMonth(2024, 4)).toBe(30)
    expect(daysInMonth(2024, 6)).toBe(30)
    expect(daysInMonth(2024, 9)).toBe(30)
    expect(daysInMonth(2024, 11)).toBe(30)
  })

  it('returns 31 for 31-day months', () => {
    expect(daysInMonth(2024, 1)).toBe(31)
    expect(daysInMonth(2024, 12)).toBe(31)
  })
})

// ---------------------------------------------------------------------------
// addDays
// ---------------------------------------------------------------------------

describe('addDays', () => {
  it('returns the same date for n=0', () => {
    expect(addDays('2024-06-15', 0)).toBe('2024-06-15')
  })

  it('advances within a month', () => {
    expect(addDays('2024-06-15', 5)).toBe('2024-06-20')
  })

  it('crosses a month boundary', () => {
    expect(addDays('2024-01-30', 3)).toBe('2024-02-02')
  })

  it('crosses a year boundary', () => {
    expect(addDays('2024-12-30', 5)).toBe('2025-01-04')
  })

  it('handles leap year Feb 28 → Feb 29', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('handles leap year Feb 29 → Mar 1', () => {
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
  })

  it('handles non-leap year Feb 28 → Mar 1', () => {
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01')
  })

  it('subtracts days within a month', () => {
    expect(addDays('2024-06-15', -5)).toBe('2024-06-10')
  })

  it('subtracts days crossing a month boundary', () => {
    expect(addDays('2024-03-02', -3)).toBe('2024-02-28')
  })

  it('subtracts days crossing a year boundary', () => {
    expect(addDays('2024-01-02', -3)).toBe('2023-12-30')
  })

  it('handles large positive increments', () => {
    // 365 days from 2024-01-01 (leap year) should be 2024-12-31
    expect(addDays('2024-01-01', 365)).toBe('2024-12-31')
  })

  it('handles DST month (March) forward', () => {
    // March has DST in the US — result must be calendar-correct
    expect(addDays('2024-03-09', 1)).toBe('2024-03-10')
    expect(addDays('2024-03-10', 1)).toBe('2024-03-11') // DST spring-forward
  })
})

// ---------------------------------------------------------------------------
// diffDays
// ---------------------------------------------------------------------------

describe('diffDays', () => {
  it('returns 0 for same date', () => {
    expect(diffDays('2024-06-15', '2024-06-15')).toBe(0)
  })

  it('returns positive when b > a', () => {
    expect(diffDays('2024-01-01', '2024-01-08')).toBe(7)
  })

  it('returns negative when b < a', () => {
    expect(diffDays('2024-01-08', '2024-01-01')).toBe(-7)
  })

  it('is consistent with addDays', () => {
    const start = '2024-03-01'
    const end = addDays(start, 45)
    expect(diffDays(start, end)).toBe(45)
  })

  it('handles leap year span', () => {
    // 2024 is a leap year
    expect(diffDays('2024-01-01', '2025-01-01')).toBe(366)
  })

  it('handles non-leap year span', () => {
    expect(diffDays('2023-01-01', '2024-01-01')).toBe(365)
  })

  it('handles DST month correctly (no off-by-one)', () => {
    // Spring forward in US: 2024-03-10
    expect(diffDays('2024-03-09', '2024-03-11')).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// compareDates
// ---------------------------------------------------------------------------

describe('compareDates', () => {
  it('returns 0 for equal dates', () => {
    expect(compareDates('2024-06-15', '2024-06-15')).toBe(0)
  })

  it('returns -1 when a < b', () => {
    expect(compareDates('2024-01-01', '2024-12-31')).toBe(-1)
  })

  it('returns 1 when a > b', () => {
    expect(compareDates('2024-12-31', '2024-01-01')).toBe(1)
  })

  it('correctly orders across years', () => {
    expect(compareDates('2023-12-31', '2024-01-01')).toBe(-1)
  })
})

// ---------------------------------------------------------------------------
// isoDateRange
// ---------------------------------------------------------------------------

describe('isoDateRange', () => {
  it('returns a single-element array for same start and end', () => {
    expect(isoDateRange('2024-06-15', '2024-06-15')).toEqual(['2024-06-15'])
  })

  it('returns the correct length for a week', () => {
    const range = isoDateRange('2024-06-10', '2024-06-16')
    expect(range).toHaveLength(7)
    expect(range[0]).toBe('2024-06-10')
    expect(range[6]).toBe('2024-06-16')
  })

  it('crosses a month boundary correctly', () => {
    const range = isoDateRange('2024-01-30', '2024-02-02')
    expect(range).toEqual([
      '2024-01-30',
      '2024-01-31',
      '2024-02-01',
      '2024-02-02',
    ])
  })

  it('returns empty array when start > end', () => {
    expect(isoDateRange('2024-06-15', '2024-06-14')).toEqual([])
  })

  it('handles February in a leap year', () => {
    const range = isoDateRange('2024-02-27', '2024-03-01')
    expect(range).toEqual([
      '2024-02-27',
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ])
  })

  it('has the correct length for a DST month', () => {
    // March 2024 has DST change — should still be 31 days
    const range = isoDateRange('2024-03-01', '2024-03-31')
    expect(range).toHaveLength(31)
  })
})

// ---------------------------------------------------------------------------
// dayOfWeek
// ---------------------------------------------------------------------------

describe('dayOfWeek', () => {
  it('returns correct day for a known Monday', () => {
    expect(dayOfWeek('2024-09-09')).toBe(1) // Monday
  })

  it('returns correct day for a known Saturday', () => {
    expect(dayOfWeek('2024-09-07')).toBe(6) // Saturday
  })

  it('returns correct day for a known Sunday', () => {
    expect(dayOfWeek('2024-09-08')).toBe(0) // Sunday
  })
})

// ---------------------------------------------------------------------------
// minDate / maxDate
// ---------------------------------------------------------------------------

describe('minDate', () => {
  it('returns the earlier date', () => {
    expect(minDate('2024-06-15', '2024-06-10')).toBe('2024-06-10')
  })

  it('returns the date itself when equal', () => {
    expect(minDate('2024-06-15', '2024-06-15')).toBe('2024-06-15')
  })
})

describe('maxDate', () => {
  it('returns the later date', () => {
    expect(maxDate('2024-06-10', '2024-06-15')).toBe('2024-06-15')
  })

  it('returns the date itself when equal', () => {
    expect(maxDate('2024-06-15', '2024-06-15')).toBe('2024-06-15')
  })
})

// ---------------------------------------------------------------------------
// isoDateFromDate
// ---------------------------------------------------------------------------

describe('isoDateFromDate', () => {
  it('returns the civil date in the given IANA timezone', () => {
    // Midnight UTC on Jan 2 = Jan 1 in US Eastern (UTC-5)
    const d = new Date('2024-01-02T01:00:00Z') // 8pm ET Jan 1
    expect(isoDateFromDate(d, 'America/New_York')).toBe('2024-01-01')
    expect(isoDateFromDate(d, 'UTC')).toBe('2024-01-02')
  })

  it('handles dates near midnight in a positive-offset timezone', () => {
    // 11pm UTC Jan 1 = Jan 2 in Jerusalem (UTC+2)
    const d = new Date('2024-01-01T23:00:00Z')
    expect(isoDateFromDate(d, 'Asia/Jerusalem')).toBe('2024-01-02')
    expect(isoDateFromDate(d, 'UTC')).toBe('2024-01-01')
  })
})
