/**
 * src/domain/presets/starterTemplates.ts
 *
 * Unbranded, illustrative starter templates for onboarding.
 *
 * IMPORTANT: These are generic examples only. Every number is a clearly-labeled
 * placeholder the user is expected to edit. None of these are presented as any
 * real employer's actual policy.
 *
 * Templates demonstrate distinct combinations of domain mechanisms:
 *   - simple-accrual:      Monthly accrual into one vacation bank, single year-end cap
 *   - annual-grant:        Lump annual grant, expires at year end, no accrual
 *   - two-stage-carryover: carryoverCap + separate carryoverDeadline (two distinct cliffs)
 *   - unpaid-observance:   Vacation bank + unpaid religious observance bank,
 *                          with preferredBankOrder so user can see/toggle unpaid-first vs paid-first
 *
 * The fully-custom template (id: 'custom') starts every bank at zero/blank —
 * same guided onboarding steps, no pre-filled numbers.
 */

import type { PTOBankPolicy, BankId } from '../models'

// ---------------------------------------------------------------------------
// Template definition type
// ---------------------------------------------------------------------------

export interface StarterTemplate {
  /** Unique template identifier */
  id: string
  /** Short display name */
  name: string
  /**
   * One or two sentence description of what this template demonstrates.
   * Must state plainly that it's a generic illustrative example.
   */
  description: string
  /** Mechanism labels shown on the template card (e.g. "Monthly accrual", "Use-by deadline") */
  mechanismLabels: string[]
  /** Pre-seeded bank definitions. Empty for the custom template. */
  banks: PTOBankPolicy[]
  /** Pre-seeded starting balances. Zero for all banks in all templates. */
  startingBalances: Record<string, number>
  /**
   * Suggested default bank order for holiday rules (vacation-first).
   * Templates with an unpaid bank list it first so the user sees the choice.
   */
  suggestedBankOrder: BankId[]
}

// ---------------------------------------------------------------------------
// Template 1: Simple Accrual with Rollover Cap
// ---------------------------------------------------------------------------

const SIMPLE_ACCRUAL_BANKS: PTOBankPolicy[] = [
  {
    id: 'vacation',
    label: 'Vacation Days',
    annualGrant: 0,             // no lump grant — accrues monthly
    accrualCadence: 'monthly',
    accrualAmount: 1,           // placeholder: ~12 days/year; edit to match your policy
    carryoverCap: 5,            // placeholder: 5-day cap at year end
    allowNegative: false,
    minimumBalance: 0,
    countsTowardVacationLossInvariant: true,
  },
  {
    id: 'personal',
    label: 'Personal Days',
    annualGrant: 3,             // placeholder: 3 days/year
    accrualCadence: 'annual',
    accrualAmount: 3,
    expiresAtYearEnd: true,
    allowNegative: false,
    minimumBalance: 0,
    countsTowardVacationLossInvariant: false,
  },
]

export const SIMPLE_ACCRUAL_TEMPLATE: StarterTemplate = {
  id: 'simple-accrual',
  name: 'Simple Accrual with Rollover Cap',
  description:
    'A generic example with monthly vacation accrual and a single use-it-or-lose-it ' +
    'cap at the policy-year boundary. Not any real employer\'s policy — edit all ' +
    'numbers to match your actual plan.',
  mechanismLabels: ['Monthly accrual', 'Year-end cap', 'Personal days (no carryover)'],
  banks: SIMPLE_ACCRUAL_BANKS,
  startingBalances: { vacation: 0, personal: 0 },
  suggestedBankOrder: ['vacation', 'personal'],
}

// ---------------------------------------------------------------------------
// Template 2: Annual Grant, No Carryover
// ---------------------------------------------------------------------------

const ANNUAL_GRANT_BANKS: PTOBankPolicy[] = [
  {
    id: 'vacation',
    label: 'PTO Days',
    annualGrant: 15,            // placeholder: 15 days/year lump grant; edit to match your policy
    grantDate: { month: 1, day: 1 },
    expiresAtYearEnd: true,     // use it or lose it — no carryover
    allowNegative: false,
    minimumBalance: 0,
    countsTowardVacationLossInvariant: true,
  },
]

export const ANNUAL_GRANT_TEMPLATE: StarterTemplate = {
  id: 'annual-grant',
  name: 'Annual Grant, No Carryover',
  description:
    'A generic example where the full year\'s PTO is granted on a single date and ' +
    'expires at year end — no accrual, no rollover. Not any real employer\'s policy ' +
    '— edit all numbers to match your actual plan.',
  mechanismLabels: ['Lump annual grant', 'Expires at year end (use-it-or-lose-it)'],
  banks: ANNUAL_GRANT_BANKS,
  startingBalances: { vacation: 0 },
  suggestedBankOrder: ['vacation'],
}

// ---------------------------------------------------------------------------
// Template 3: Two-Stage Carryover with Use-By Deadline
// ---------------------------------------------------------------------------

const TWO_STAGE_CARRYOVER_BANKS: PTOBankPolicy[] = [
  {
    id: 'vacation',
    label: 'Vacation Days',
    annualGrant: 0,
    accrualCadence: 'monthly',
    accrualAmount: 1,             // placeholder: ~12 days/year; edit to match your policy
    carryoverCap: 5,              // placeholder: up to 5 days survive the year-end boundary …
    carryoverDeadline: { month: 4, day: 1 }, // … but must be used by April 1 or forfeited
    allowNegative: false,
    minimumBalance: 0,
    countsTowardVacationLossInvariant: true,
  },
  {
    id: 'personal',
    label: 'Personal Days',
    annualGrant: 3,
    accrualCadence: 'annual',
    accrualAmount: 3,
    expiresAtYearEnd: true,
    allowNegative: false,
    minimumBalance: 0,
    countsTowardVacationLossInvariant: false,
  },
]

export const TWO_STAGE_CARRYOVER_TEMPLATE: StarterTemplate = {
  id: 'two-stage-carryover',
  name: 'Two-Stage Carryover with Use-By Deadline',
  description:
    'A generic example with two distinct forfeiture cliffs: a year-end cap that lets ' +
    'some days carry over, plus a mid-year deadline by which those carried-over days ' +
    'must be used or they\'re forfeited too. Not any real employer\'s policy — edit ' +
    'all numbers to match your actual plan.',
  mechanismLabels: ['Monthly accrual', 'Year-end carryover cap', 'Mid-year use-by deadline (second cliff)'],
  banks: TWO_STAGE_CARRYOVER_BANKS,
  startingBalances: { vacation: 0, personal: 0 },
  suggestedBankOrder: ['vacation', 'personal'],
}

// ---------------------------------------------------------------------------
// Template 4: Unpaid Observance Bank with Paid Substitution
// ---------------------------------------------------------------------------

const UNPAID_OBSERVANCE_BANKS: PTOBankPolicy[] = [
  {
    id: 'vacation',
    label: 'Vacation Days',
    annualGrant: 0,
    accrualCadence: 'monthly',
    accrualAmount: 1,           // placeholder; edit to match your policy
    carryoverCap: 5,
    allowNegative: false,
    minimumBalance: 0,
    countsTowardVacationLossInvariant: true,
  },
  {
    id: 'religiousObservance',
    label: 'Religious Observance (Unpaid)',
    annualGrant: 10,            // placeholder: up to 10 unpaid observance days/year; edit to match your policy
    grantDate: { month: 1, day: 1 },
    unpaid: true,               // draws from this bank but no pay is deducted
    expiresAtYearEnd: true,     // unused days don't carry over (advisory only — not vacation loss)
    allowNegative: false,
    minimumBalance: 0,
    countsTowardVacationLossInvariant: false,
  },
]

export const UNPAID_OBSERVANCE_TEMPLATE: StarterTemplate = {
  id: 'unpaid-observance',
  name: 'Unpaid Observance Bank with Paid Substitution',
  description:
    'A generic example with a separate unpaid religious-observance bank alongside ' +
    'vacation. The preferred bank order controls whether observances draw from the ' +
    'unpaid bank first (preserving vacation) or from vacation first (paid). Not any ' +
    'real employer\'s policy — edit all numbers to match your actual plan.',
  mechanismLabels: ['Monthly accrual (vacation)', 'Unpaid observance bank', 'Toggle unpaid-first vs. paid-first'],
  banks: UNPAID_OBSERVANCE_BANKS,
  startingBalances: { vacation: 0, religiousObservance: 0 },
  suggestedBankOrder: ['religiousObservance', 'vacation'], // unpaid-first default
}

// ---------------------------------------------------------------------------
// Custom (blank-slate) template
// ---------------------------------------------------------------------------

/**
 * The fully-custom path: same guided onboarding steps as the named templates,
 * but every bank starts blank/zero. The user builds their own policy from scratch.
 * This must be presented as a first-class, equally-visible option.
 */
export const CUSTOM_TEMPLATE: StarterTemplate = {
  id: 'custom',
  name: 'Start from Scratch',
  description:
    'Build your own policy from the ground up. You\'ll go through the same guided ' +
    'steps as the starter templates, but every bank starts blank — enter your own ' +
    'accrual rules, caps, and balances.',
  mechanismLabels: ['No pre-filled numbers', 'Full control over every setting'],
  banks: [
    {
      id: 'vacation',
      label: 'Vacation Days',
      annualGrant: 0,
      allowNegative: false,
      minimumBalance: 0,
      countsTowardVacationLossInvariant: true,
    },
  ],
  startingBalances: { vacation: 0 },
  suggestedBankOrder: ['vacation'],
}

// ---------------------------------------------------------------------------
// Ordered list of all templates (used for rendering the picker)
// ---------------------------------------------------------------------------

export const ALL_STARTER_TEMPLATES: StarterTemplate[] = [
  SIMPLE_ACCRUAL_TEMPLATE,
  ANNUAL_GRANT_TEMPLATE,
  TWO_STAGE_CARRYOVER_TEMPLATE,
  UNPAID_OBSERVANCE_TEMPLATE,
]

/**
 * Returns the template with the given id, or null if not found.
 * Also handles the 'custom' id by returning CUSTOM_TEMPLATE.
 */
export function getTemplateById(id: string): StarterTemplate | null {
  if (id === 'custom') return CUSTOM_TEMPLATE
  return ALL_STARTER_TEMPLATES.find((t) => t.id === id) ?? null
}
