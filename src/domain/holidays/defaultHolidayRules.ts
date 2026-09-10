/**
 * src/domain/holidays/defaultHolidayRules.ts
 *
 * Starter HolidayRule[] — an editable, non-universal default profile.
 *
 * Per user preference: ALL festival days (including second days) default to
 * `required`. Fast days and modern holidays default to `ignore`.
 *
 * This profile is seeded on first run and the user is expected to adjust
 * it. It is never claimed as universal practice.
 *
 * Bank preference order: heritage days are used first (that's their
 * purpose), then vacation days as the fallback.
 */

import type { HolidayRule } from '../models'

export const DEFAULT_HOLIDAY_RULES: HolidayRule[] = [
  // -------------------------------------------------------------------------
  // High Holidays
  // -------------------------------------------------------------------------
  {
    holidayId: 'rosh-hashana-1',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },
  {
    holidayId: 'rosh-hashana-2',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },
  {
    holidayId: 'yom-kippur',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },

  // -------------------------------------------------------------------------
  // Sukkot / Shmini Atzeret / Simchat Torah
  // -------------------------------------------------------------------------
  {
    holidayId: 'sukkot-1',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },
  {
    holidayId: 'sukkot-2',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },
  {
    holidayId: 'shmini-atzeret',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },
  {
    holidayId: 'simchat-torah',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },

  // -------------------------------------------------------------------------
  // Pesach
  // -------------------------------------------------------------------------
  {
    holidayId: 'pesach-1',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },
  {
    holidayId: 'pesach-2',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },
  {
    holidayId: 'pesach-7',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },
  {
    holidayId: 'pesach-8',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },

  // -------------------------------------------------------------------------
  // Shavuot
  // -------------------------------------------------------------------------
  {
    holidayId: 'shavuot-1',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },
  {
    holidayId: 'shavuot-2',
    observance: 'required',
    preferredBankOrder: ['heritage', 'vacation'],
  },

  // -------------------------------------------------------------------------
  // Fasts — default ignore (user opts in)
  // -------------------------------------------------------------------------
  {
    holidayId: 'tisha-bav',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
  {
    holidayId: 'tzom-gedaliah',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
  {
    holidayId: 'asara-btevet',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
  {
    holidayId: 'taanit-esther',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
  {
    holidayId: 'taanit-bechorot',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
  {
    holidayId: 'tzom-tammuz',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },

  // -------------------------------------------------------------------------
  // Modern holidays — default ignore (user opts in)
  // -------------------------------------------------------------------------
  {
    holidayId: 'yom-hashoah',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
  {
    holidayId: 'yom-hazikaron',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
  {
    holidayId: 'yom-haatzmaut',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
  {
    holidayId: 'yom-yerushalayim',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
  {
    holidayId: 'yom-haaliyah',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
  {
    holidayId: 'sigd',
    observance: 'ignore',
    preferredBankOrder: ['heritage', 'personal', 'vacation'],
  },
]

/** Convenience: look up the rule for a given holidayId (O(n) — small list). */
export function getDefaultRule(holidayId: string): HolidayRule | undefined {
  return DEFAULT_HOLIDAY_RULES.find((r) => r.holidayId === holidayId)
}
