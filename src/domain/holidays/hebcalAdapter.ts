/**
 * src/domain/holidays/hebcalAdapter.ts
 *
 * The ONE adapter between @hebcal/core and the app's domain types.
 * Responsibilities:
 *  1. Query @hebcal/core with the correct il/Diaspora flag and event mask.
 *  2. Add a 7-day boundary buffer so holidays at the horizon edge aren't lost.
 *  3. Map each Event's stable getDesc() string to a canonical holidayId slug.
 *  4. Produce NormalizedHoliday values — plain typed objects, no @hebcal
 *     types leak outside this file.
 *  5. Exclude EREV events (Erev X) — they are calendar reminders, not the
 *     holiday itself, and should not appear in planning logic.
 *
 * NOTE: Read the installed package's actual types — never guess flag names.
 *   Flags inspected from node_modules/@hebcal/core/dist/event.d.ts.
 */

import { HebrewCalendar, flags } from '@hebcal/core'
import type { IsoDate, NormalizedHoliday, JewishCalendarSettings } from '../models'
import { addDays, toIsoDate } from '../dates/isoDate'

// ---------------------------------------------------------------------------
// Boundary buffer
// ---------------------------------------------------------------------------

const BOUNDARY_BUFFER_DAYS = 7

// ---------------------------------------------------------------------------
// Event mask — what categories to request from hebcal
// ---------------------------------------------------------------------------

/** Always-requested: major holidays + major fasts. */
const ALWAYS_MASK =
  flags.CHAG | flags.YOM_TOV_ENDS | flags.MAJOR_FAST | flags.LIGHT_CANDLES

/** Minor fasts (Tzom Gedaliah, Asara B'Tevet, Ta'anit Esther,
 *  Ta'anit Bechorot, Tzom Tammuz) are included but filtered by the
 *  canonical mapping. Always request so adapter knows they exist. */
const MINOR_FAST_MASK = flags.MINOR_FAST

/** Modern holidays: Yom HaShoah, Yom HaZikaron, Yom HaAtzma'ut,
 *  Yom Yerushalayim, Yom HaAliyah, Sigd. Only requested when user enables. */
const MODERN_MASK = flags.MODERN_HOLIDAY

// ---------------------------------------------------------------------------
// Canonical holidayId mapping
// ---------------------------------------------------------------------------
// Keys are the stable getDesc() strings from @hebcal/core.
// Rosh Hashana I includes the Hebrew year number in the desc, so we strip it.

interface HolidayMapping {
  holidayId: string
  isSecondDay: boolean
}

/**
 * Returns the canonical mapping for an event description, or null if the
 * event should be skipped (e.g., Erev X, Chol HaMoed, unrecognised).
 */
function lookupMapping(desc: string): HolidayMapping | null {
  // Strip " (Observed)" or trailing whitespace
  const clean = desc.trim()

  // Rosh Hashana I — desc includes Hebrew year, e.g. "Rosh Hashana 5785"
  if (/^Rosh Hashana \d+$/.test(clean)) {
    return { holidayId: 'rosh-hashana-1', isSecondDay: false }
  }

  const STATIC_MAP: Record<string, HolidayMapping> = {
    'Rosh Hashana II':    { holidayId: 'rosh-hashana-2',   isSecondDay: true  },
    'Yom Kippur':         { holidayId: 'yom-kippur',        isSecondDay: false },
    'Sukkot I':           { holidayId: 'sukkot-1',          isSecondDay: false },
    'Sukkot II':          { holidayId: 'sukkot-2',          isSecondDay: true  },
    'Shmini Atzeret':     { holidayId: 'shmini-atzeret',    isSecondDay: false },
    'Simchat Torah':      { holidayId: 'simchat-torah',     isSecondDay: false },
    'Pesach I':           { holidayId: 'pesach-1',          isSecondDay: false },
    'Pesach II':          { holidayId: 'pesach-2',          isSecondDay: true  },
    'Pesach VII':         { holidayId: 'pesach-7',          isSecondDay: false },
    'Pesach VIII':        { holidayId: 'pesach-8',          isSecondDay: true  },
    'Shavuot I':          { holidayId: 'shavuot-1',         isSecondDay: false },
    'Shavuot II':         { holidayId: 'shavuot-2',         isSecondDay: true  },
    // Fasts
    "Tish'a B'Av":        { holidayId: 'tisha-bav',         isSecondDay: false },
    'Tzom Gedaliah':      { holidayId: 'tzom-gedaliah',     isSecondDay: false },
    "Asara B'Tevet":      { holidayId: 'asara-btevet',      isSecondDay: false },
    "Ta'anit Esther":     { holidayId: 'taanit-esther',     isSecondDay: false },
    "Ta'anit Bechorot":   { holidayId: 'taanit-bechorot',   isSecondDay: false },
    'Tzom Tammuz':        { holidayId: 'tzom-tammuz',       isSecondDay: false },
    // Modern holidays
    'Yom HaShoah':        { holidayId: 'yom-hashoah',       isSecondDay: false },
    'Yom HaZikaron':      { holidayId: 'yom-hazikaron',     isSecondDay: false },
    "Yom HaAtzma'ut":     { holidayId: 'yom-haatzmaut',     isSecondDay: false },
    'Yom Yerushalayim':   { holidayId: 'yom-yerushalayim',  isSecondDay: false },
    'Yom HaAliyah':       { holidayId: 'yom-haaliyah',      isSecondDay: false },
    'Sigd':               { holidayId: 'sigd',               isSecondDay: false },
  }

  return STATIC_MAP[clean] ?? null
}

/**
 * Produces a slugified fallback ID for unrecognised events so they don't
 * crash the adapter — they will appear as `unknown-*` and won't match any
 * HolidayRule.
 */
function fallbackId(desc: string): string {
  return 'unknown-' + desc.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// ---------------------------------------------------------------------------
// IsoDate helper for @hebcal Date objects
// ---------------------------------------------------------------------------

function gregToIso(d: Date): IsoDate {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return toIsoDate(y, m, day)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all Jewish holiday occurrences in the range [start, end] (inclusive),
 * with a 7-day boundary buffer applied on both sides so holidays at the edge
 * of the horizon are never lost.
 *
 * @param start    First date of the planning horizon (IsoDate)
 * @param end      Last date of the planning horizon (IsoDate)
 * @param settings JewishCalendarSettings (location + modern holiday toggle)
 */
export function getHolidayOccurrences(
  start: IsoDate,
  end: IsoDate,
  settings: JewishCalendarSettings
): NormalizedHoliday[] {
  const bufferedStart = addDays(start, -BOUNDARY_BUFFER_DAYS)
  const bufferedEnd = addDays(end, BOUNDARY_BUFFER_DAYS)

  const isIsrael = settings.location === 'israel'

  let mask = ALWAYS_MASK | MINOR_FAST_MASK
  if (settings.includeModernHolidays) {
    mask = mask | MODERN_MASK
  }

  const events = HebrewCalendar.calendar({
    start: new Date(`${bufferedStart}T12:00:00`),
    end: new Date(`${bufferedEnd}T12:00:00`),
    il: isIsrael,
    mask,
    // Disable unrelated categories
    sedrot: false,
    omer: false,
    shabbatMevarchim: false,
    noRoshChodesh: true,
    noSpecialShabbat: true,
  })

  const results: NormalizedHoliday[] = []

  for (const ev of events) {
    const desc = ev.getDesc()

    // Skip EREV events — they are calendar reminders, not the holiday
    if (ev.mask & flags.EREV) continue

    // Skip Chol HaMoed (intermediate days — handled separately if needed)
    if (ev.mask & flags.CHOL_HAMOED) continue

    // Only include modern holidays when user opted in
    if (!settings.includeModernHolidays && (ev.mask & flags.MODERN_HOLIDAY)) continue

    const mapping = lookupMapping(desc)

    const gregDate = ev.getDate().greg()
    const isoDate = gregToIso(gregDate)

    const holidayId = mapping?.holidayId ?? fallbackId(desc)
    const isSecondDay = mapping?.isSecondDay ?? false

    // Determine location: CHUL_ONLY = diaspora, IL_ONLY = israel
    const location: 'diaspora' | 'israel' =
      ev.mask & flags.IL_ONLY ? 'israel' : 'diaspora'

    // Build category string for traceability
    let hebcalCategory = 'holiday'
    if (ev.mask & flags.MAJOR_FAST) hebcalCategory = 'major-fast'
    else if (ev.mask & flags.MINOR_FAST) hebcalCategory = 'minor-fast'
    else if (ev.mask & flags.MODERN_HOLIDAY) hebcalCategory = 'modern'
    else if (ev.mask & flags.CHAG) hebcalCategory = 'major'

    results.push({
      holidayId,
      hebrewName: ev.render('he'),
      displayName: ev.render('en'),
      date: isoDate,
      isSecondDay,
      location,
      hebcalCategory,
    })
  }

  return results
}
