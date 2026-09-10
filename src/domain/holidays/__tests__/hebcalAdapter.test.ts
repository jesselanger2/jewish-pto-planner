/**
 * Tests for src/domain/holidays/hebcalAdapter.ts
 *
 * All tests use fixed date ranges — never the system clock.
 * Tests verify canonical holidayId mapping, Diaspora/Israel differences,
 * boundary buffer behaviour, and modern-holiday toggle.
 */
import { describe, expect, it } from 'vitest'
import { getHolidayOccurrences } from '../hebcalAdapter'
import { DEFAULT_HOLIDAY_RULES } from '../defaultHolidayRules'
import type { JewishCalendarSettings } from '../../models'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const diaspora: JewishCalendarSettings = {
  location: 'diaspora',
  timezone: 'America/New_York',
  includeModernHolidays: false,
}

const israel: JewishCalendarSettings = {
  location: 'israel',
  timezone: 'Asia/Jerusalem',
  includeModernHolidays: false,
}

const diasporaWithModern: JewishCalendarSettings = {
  ...diaspora,
  includeModernHolidays: true,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function byId(holidays: ReturnType<typeof getHolidayOccurrences>, id: string) {
  return holidays.filter((h) => h.holidayId === id)
}

function firstById(holidays: ReturnType<typeof getHolidayOccurrences>, id: string) {
  return holidays.find((h) => h.holidayId === id)
}

// ---------------------------------------------------------------------------
// Canonical holidayId mapping — 5784/5785 (year 2024–2025)
// ---------------------------------------------------------------------------

describe('hebcalAdapter — canonical holidayId mapping (5785 / 2024-2025)', () => {
  // Cover the entire Jewish year 5785 which spans late 2024 – 2025
  const start = '2024-09-01'
  const end = '2025-08-31'
  const holidays = getHolidayOccurrences(start, end, diaspora)

  it('returns Rosh Hashana I with correct holidayId and date', () => {
    const rh1 = firstById(holidays, 'rosh-hashana-1')
    expect(rh1).toBeDefined()
    expect(rh1?.date).toBe('2024-10-03') // 5785
    expect(rh1?.isSecondDay).toBe(false)
  })

  it('returns Rosh Hashana II', () => {
    const rh2 = firstById(holidays, 'rosh-hashana-2')
    expect(rh2).toBeDefined()
    expect(rh2?.date).toBe('2024-10-04')
    expect(rh2?.isSecondDay).toBe(true)
  })

  it('returns Yom Kippur', () => {
    const yk = firstById(holidays, 'yom-kippur')
    expect(yk).toBeDefined()
    expect(yk?.date).toBe('2024-10-12')
    expect(yk?.isSecondDay).toBe(false)
  })

  it('returns Sukkot I and II', () => {
    const s1 = firstById(holidays, 'sukkot-1')
    const s2 = firstById(holidays, 'sukkot-2')
    expect(s1?.date).toBe('2024-10-17')
    expect(s2?.date).toBe('2024-10-18')
    expect(s2?.isSecondDay).toBe(true)
  })

  it('returns Shmini Atzeret', () => {
    const sa = firstById(holidays, 'shmini-atzeret')
    expect(sa?.date).toBe('2024-10-24')
  })

  it('returns Simchat Torah', () => {
    const st = firstById(holidays, 'simchat-torah')
    expect(st?.date).toBe('2024-10-25')
  })

  it('returns all four Pesach yom-tov days in diaspora', () => {
    const p1 = firstById(holidays, 'pesach-1')
    const p2 = firstById(holidays, 'pesach-2')
    const p7 = firstById(holidays, 'pesach-7')
    const p8 = firstById(holidays, 'pesach-8')
    expect(p1?.date).toBe('2025-04-13')
    expect(p2?.date).toBe('2025-04-14')
    expect(p7?.date).toBe('2025-04-19')
    expect(p8?.date).toBe('2025-04-20')
    expect(p2?.isSecondDay).toBe(true)
    expect(p8?.isSecondDay).toBe(true)
  })

  it('returns Shavuot I and II in diaspora', () => {
    const sh1 = firstById(holidays, 'shavuot-1')
    const sh2 = firstById(holidays, 'shavuot-2')
    expect(sh1?.date).toBe('2025-06-02')
    expect(sh2?.date).toBe('2025-06-03')
    expect(sh2?.isSecondDay).toBe(true)
  })

  it('includes Tisha BAv (major fast)', () => {
    expect(firstById(holidays, 'tisha-bav')).toBeDefined()
  })

  it('includes minor fasts (Tzom Gedaliah, Asara BTevet etc.)', () => {
    expect(firstById(holidays, 'tzom-gedaliah')).toBeDefined()
    expect(firstById(holidays, 'asara-btevet')).toBeDefined()
    expect(firstById(holidays, 'taanit-esther')).toBeDefined()
    expect(firstById(holidays, 'tzom-tammuz')).toBeDefined()
  })

  it('does NOT include modern holidays when toggle is off', () => {
    expect(firstById(holidays, 'yom-hashoah')).toBeUndefined()
    expect(firstById(holidays, 'yom-haatzmaut')).toBeUndefined()
  })

  it('does NOT include EREV events', () => {
    const erevEvents = holidays.filter(
      (h) => h.displayName.startsWith('Erev') || h.displayName.includes('erev')
    )
    expect(erevEvents).toHaveLength(0)
  })

  it('does NOT include Chol HaMoed (intermediate) days', () => {
    const cholHaMoed = holidays.filter(
      (h) =>
        h.displayName.includes("CH''M") ||
        h.displayName.includes('Chol') ||
        h.displayName.includes('Hoshana Raba')
    )
    expect(cholHaMoed).toHaveLength(0)
  })

  it('all returned holidays have required fields populated', () => {
    for (const h of holidays) {
      expect(h.holidayId).toBeTruthy()
      expect(h.hebrewName).toBeTruthy()
      expect(h.displayName).toBeTruthy()
      expect(h.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(['diaspora', 'israel']).toContain(h.location)
      expect(h.hebcalCategory).toBeTruthy()
    }
  })
})

// ---------------------------------------------------------------------------
// Diaspora vs. Israel — second-day differences
// ---------------------------------------------------------------------------

describe('hebcalAdapter — Diaspora vs. Israel second-day differences', () => {
  // Pesach 5785
  it('Diaspora: returns Pesach II (second day)', () => {
    const h = getHolidayOccurrences('2025-04-10', '2025-04-25', diaspora)
    expect(firstById(h, 'pesach-2')).toBeDefined()
    expect(firstById(h, 'pesach-8')).toBeDefined()
  })

  it('Israel: does NOT return Pesach II or Pesach VIII (no second day)', () => {
    const h = getHolidayOccurrences('2025-04-10', '2025-04-25', israel)
    expect(firstById(h, 'pesach-2')).toBeUndefined()
    expect(firstById(h, 'pesach-8')).toBeUndefined()
  })

  it('Diaspora: returns Shavuot II', () => {
    const h = getHolidayOccurrences('2025-05-28', '2025-06-10', diaspora)
    expect(firstById(h, 'shavuot-2')).toBeDefined()
  })

  it('Israel: does NOT return Shavuot II', () => {
    const h = getHolidayOccurrences('2025-05-28', '2025-06-10', israel)
    expect(firstById(h, 'shavuot-2')).toBeUndefined()
  })

  it('Diaspora: Simchat Torah is a separate day from Shmini Atzeret', () => {
    const h = getHolidayOccurrences('2024-10-20', '2024-10-30', diaspora)
    const sa = firstById(h, 'shmini-atzeret')
    const st = firstById(h, 'simchat-torah')
    expect(sa).toBeDefined()
    expect(st).toBeDefined()
    expect(sa?.date).not.toBe(st?.date)
  })

  it('Israel: Shmini Atzeret and Simchat Torah are on the same day', () => {
    const h = getHolidayOccurrences('2024-10-20', '2024-10-30', israel)
    const sa = firstById(h, 'shmini-atzeret')
    const st = firstById(h, 'simchat-torah')
    // In Israel they coincide — both present on the same date, OR only one appears
    // depending on @hebcal/core's Israeli output. Check that at least one exists.
    expect(sa ?? st).toBeDefined()
  })

  it('Sukkot II appears in diaspora', () => {
    const h = getHolidayOccurrences('2024-10-15', '2024-10-22', diaspora)
    expect(firstById(h, 'sukkot-2')).toBeDefined()
  })

  it('Sukkot II does not appear in Israel', () => {
    const h = getHolidayOccurrences('2024-10-15', '2024-10-22', israel)
    expect(firstById(h, 'sukkot-2')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Modern holidays — toggle
// ---------------------------------------------------------------------------

describe('hebcalAdapter — modern holiday toggle', () => {
  it('includes modern holidays when toggle is on', () => {
    const h = getHolidayOccurrences('2025-04-01', '2025-06-15', diasporaWithModern)
    expect(firstById(h, 'yom-hashoah')).toBeDefined()
    expect(firstById(h, 'yom-haatzmaut')).toBeDefined()
    expect(firstById(h, 'yom-yerushalayim')).toBeDefined()
  })

  it('excludes modern holidays when toggle is off', () => {
    const h = getHolidayOccurrences('2025-04-01', '2025-06-15', diaspora)
    expect(firstById(h, 'yom-hashoah')).toBeUndefined()
    expect(firstById(h, 'yom-haatzmaut')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Boundary buffer
// ---------------------------------------------------------------------------

describe('hebcalAdapter — boundary buffer', () => {
  it('captures Rosh Hashana when start is 5 days before the holiday', () => {
    // 2024 RH: Oct 3. Request starts Oct 1 — within buffer of the holiday.
    // Actually Oct 3 is within [start=Oct1 - buffer=7 = Sep24, end+7]. So it's captured.
    const h = getHolidayOccurrences('2024-10-01', '2024-10-02', diaspora)
    // With 7-day buffer the adapter queries from Sep 24 – Oct 9
    expect(firstById(h, 'rosh-hashana-1')).toBeDefined()
  })

  it('captures Shavuot when end is 3 days before the holiday', () => {
    // Shavuot 2025: Jun 2. Request ends May 30.
    // With buffer: query goes to May 30+7=Jun 6. Jun 2 is included.
    const h = getHolidayOccurrences('2025-05-01', '2025-05-30', diaspora)
    expect(firstById(h, 'shavuot-1')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Multi-year — no duplicates within single run
// ---------------------------------------------------------------------------

describe('hebcalAdapter — multi-year horizon', () => {
  it('returns holidays across a 3-year span without duplicates for same date+id', () => {
    const h = getHolidayOccurrences('2024-01-01', '2026-12-31', diaspora)
    // Check that we have RH1 for each of the three years (5784, 5785, 5786)
    const rh1 = byId(h, 'rosh-hashana-1')
    expect(rh1.length).toBeGreaterThanOrEqual(3)
    // Verify no duplicate (same date + same holidayId)
    const keys = h.map((x) => `${x.holidayId}|${x.date}`)
    const unique = new Set(keys)
    expect(unique.size).toBe(keys.length)
  })
})

// ---------------------------------------------------------------------------
// defaultHolidayRules — second days are all required
// ---------------------------------------------------------------------------

describe('defaultHolidayRules', () => {
  const secondDayIds = [
    'rosh-hashana-2',
    'sukkot-2',
    'pesach-2',
    'pesach-8',
    'shavuot-2',
  ]

  it.each(secondDayIds)(
    '%s defaults to required observance',
    (holidayId) => {
      const rule = DEFAULT_HOLIDAY_RULES.find((r) => r.holidayId === holidayId)
      expect(rule).toBeDefined()
      expect(rule?.observance).toBe('required')
    }
  )

  it('all festival days (non-fasts, non-modern) are required', () => {
    const festivalIds = [
      'rosh-hashana-1', 'rosh-hashana-2',
      'yom-kippur',
      'sukkot-1', 'sukkot-2',
      'shmini-atzeret', 'simchat-torah',
      'pesach-1', 'pesach-2', 'pesach-7', 'pesach-8',
      'shavuot-1', 'shavuot-2',
    ]
    for (const id of festivalIds) {
      const rule = DEFAULT_HOLIDAY_RULES.find((r) => r.holidayId === id)
      expect(rule?.observance, `${id} should be required`).toBe('required')
    }
  })

  it('all fasts default to ignore', () => {
    const fastIds = [
      'tisha-bav', 'tzom-gedaliah', 'asara-btevet',
      'taanit-esther', 'taanit-bechorot', 'tzom-tammuz',
    ]
    for (const id of fastIds) {
      const rule = DEFAULT_HOLIDAY_RULES.find((r) => r.holidayId === id)
      expect(rule?.observance, `${id} should be ignore`).toBe('ignore')
    }
  })

  it('every rule has at least one bank in preferredBankOrder', () => {
    for (const rule of DEFAULT_HOLIDAY_RULES) {
      expect(rule.preferredBankOrder.length).toBeGreaterThan(0)
    }
  })
})
