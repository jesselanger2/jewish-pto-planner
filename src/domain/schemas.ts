/**
 * src/domain/schemas.ts
 *
 * Zod schemas for all domain types.
 * Used for validating all persisted, form, and network data.
 * Every schema corresponds to a type in models.ts.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * A valid civil ISO date: YYYY-MM-DD, with calendar-aware validation.
 * Never accepts dates that don't exist (e.g. Feb 30).
 */
export const IsoDateSchema = z.string().refine(
  (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
    const [y, m, d] = s.split('-').map(Number)
    const dt = new Date(s + 'T12:00:00') // noon avoids DST edge cases
    return (
      dt.getFullYear() === y &&
      dt.getMonth() + 1 === m &&
      dt.getDate() === d
    )
  },
  { message: 'Invalid ISO date (YYYY-MM-DD)' }
)

/**
 * Integer count of days. v1 rejects fractional values.
 */
export const DayUnitsSchema = z
  .number()
  .int('Day values must be integers in v1')

export const ObservanceLevelSchema = z.enum(['required', 'optional', 'ignore'])

export const HolidayLocationSchema = z.enum(['diaspora', 'israel'])

export const AccrualCadenceSchema = z.enum([
  'annual',
  'monthly',
  'per-pay-period',
])

export const DayClassificationSchema = z.enum([
  'workday',
  'weekend',
  'company-holiday',
  'federal-holiday',
  'custom-closure',
])

/**
 * BankId: open string — validated further by EmployerPolicySchema
 * (startingBalances keys must match bank ids).
 */
export const BankIdSchema = z.string().min(1)

// ---------------------------------------------------------------------------
// Employer policy schemas
// ---------------------------------------------------------------------------

const MonthDaySchema = z.object({
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
})

export const PTOBankPolicySchema = z.object({
  id: BankIdSchema,
  label: z.string().min(1),
  annualGrant: DayUnitsSchema.nonnegative(),
  grantDate: MonthDaySchema.optional(),
  accrualCadence: AccrualCadenceSchema.optional(),
  accrualAmount: DayUnitsSchema.nonnegative().optional(),
  /** null means unlimited carry-over */
  carryoverCap: DayUnitsSchema.nonnegative().nullable().optional(),
  /** Second forfeiture cliff (e.g. a mid-year use-by deadline on carried-over days). */
  carryoverDeadline: MonthDaySchema.nullable().optional(),
  expiresAtYearEnd: z.boolean().optional(),
  allowNegative: z.boolean().optional(),
  minimumBalance: DayUnitsSchema.optional(),
  unpaid: z.boolean().optional(),
  isFloatingHoliday: z.boolean().optional(),
  countsTowardVacationLossInvariant: z.boolean().optional(),
})

export const EmployerPolicySchema = z.object({
  policyYearStart: MonthDaySchema,
  banks: z.array(PTOBankPolicySchema).min(1),
  /** Open record — must have an entry per bank id */
  startingBalances: z.record(z.string(), DayUnitsSchema),
  weekendDays: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(6)
    .default([0, 6]),
  useUSFederalHolidays: z.boolean(),
  companyHolidays: z.array(
    z.object({ date: IsoDateSchema, label: z.string().min(1) })
  ),
  customClosures: z.array(
    z.object({ date: IsoDateSchema, label: z.string().min(1) })
  ),
  bookingLeadTimeDays: z.number().int().nonnegative().optional(),
})

// ---------------------------------------------------------------------------
// Jewish calendar settings
// ---------------------------------------------------------------------------

export const JewishCalendarSettingsSchema = z.object({
  location: HolidayLocationSchema,
  timezone: z.string().min(1),
  includeModernHolidays: z.boolean(),
})

// ---------------------------------------------------------------------------
// Holiday rules
// ---------------------------------------------------------------------------

export const HolidayRuleSchema = z.object({
  holidayId: z.string().min(1),
  observance: ObservanceLevelSchema,
  preferredBankOrder: z.array(BankIdSchema).min(1),
})

// ---------------------------------------------------------------------------
// Planner settings (root persisted entity)
// ---------------------------------------------------------------------------

export const PlannerSettingsSchema = z.object({
  horizonStart: IsoDateSchema,
  horizonYears: z
    .number()
    .int()
    .min(1, 'Horizon must be at least 1 year')
    .max(5, 'Horizon cannot exceed 5 years'),
  jewishCalendar: JewishCalendarSettingsSchema,
  employerPolicy: EmployerPolicySchema,
  holidayRules: z.array(HolidayRuleSchema),
  lockedTimeOff: z.array(
    z.object({
      date: IsoDateSchema,
      bankId: BankIdSchema,
      reason: z.string().min(1),
    })
  ),
})

// ---------------------------------------------------------------------------
// Normalized holiday occurrence
// ---------------------------------------------------------------------------

export const NormalizedHolidaySchema = z.object({
  holidayId: z.string().min(1),
  hebrewName: z.string().min(1),
  displayName: z.string().min(1),
  date: IsoDateSchema,
  isSecondDay: z.boolean(),
  location: HolidayLocationSchema,
  hebcalCategory: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export const LedgerEventTypeSchema = z.enum([
  'opening-balance',
  'grant',
  'accrual',
  'booking',
  'rollover',
  'expiration',
  'adjustment',
])

export const LedgerEventSchema = z.object({
  id: z.string().min(1),
  date: IsoDateSchema,
  bankId: BankIdSchema,
  type: LedgerEventTypeSchema,
  openingBalance: DayUnitsSchema,
  delta: DayUnitsSchema,
  resultingBalance: DayUnitsSchema,
  reason: z.string().min(1),
  sourceId: z.string().min(1).optional(),
  policyYearId: z.string().min(1),
})

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export const BookingReasonSchema = z.enum([
  'required-holiday',
  'rollover-protection',
  'optional-holiday',
  'discretionary',
  'locked',
])

export const TimeOffBookingSchema = z.object({
  id: z.string().min(1),
  date: IsoDateSchema,
  bankId: BankIdSchema,
  reason: BookingReasonSchema,
  holidayId: z.string().min(1).optional(),
  locked: z.boolean(),
  note: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Candidate break
// ---------------------------------------------------------------------------

export const CandidateBreakSchema = z.object({
  id: z.string().min(1),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema,
  workdaysConsumed: DayUnitsSchema.nonnegative(),
  awaySpanDays: z.number().int().positive(),
  bankId: BankIdSchema,
  relatedHolidayIds: z.array(z.string()),
  rolloverDeadline: IsoDateSchema.optional(),
  reason: BookingReasonSchema,
})

// ---------------------------------------------------------------------------
// Validation issues
// ---------------------------------------------------------------------------

export const ValidationIssueCodeSchema = z.enum([
  'required-holiday-uncovered',
  'insufficient-balance',
  'below-minimum-balance',
  'vacation-loss-at-rollover',
  'booking-on-non-workday',
  'no-eligible-workdays-before-cap',
  'advisory-bank-expiration',
])

export const ValidationIssueSchema = z.object({
  code: ValidationIssueCodeSchema,
  message: z.string().min(1),
  dates: z.array(IsoDateSchema).optional(),
  bankId: BankIdSchema.optional(),
  projectedLossDays: DayUnitsSchema.nonnegative().optional(),
  rolloverDate: IsoDateSchema.optional(),
})

// ---------------------------------------------------------------------------
// Plan objective score
// ---------------------------------------------------------------------------

export const PlanFeasibilitySchema = z.enum(['valid', 'infeasible'])

export const PlannerObjectiveScoreSchema = z.object({
  feasibility: PlanFeasibilitySchema,
  vacationForfeited: DayUnitsSchema.nonnegative(),
  optionalObservancesCovered: z.number().int().nonnegative(),
  continuousSpanScore: z.number(),
  fragmentationPenalty: z.number(),
})

// ---------------------------------------------------------------------------
// Explanations and annotations
// ---------------------------------------------------------------------------

export const PlannerExplanationSchema = z.object({
  bookingId: z.string().min(1),
  reason: BookingReasonSchema,
  humanReadable: z.string().min(1),
})

export const DayAnnotationTypeSchema = z.enum([
  'workday',
  'weekend',
  'company-holiday',
  'federal-holiday',
  'custom-closure',
  'required-holiday',
  'optional-holiday',
  'modern-holiday',
  'pto-booked',
  'pto-locked',
])

export const DayAnnotationSchema = z.object({
  date: IsoDateSchema,
  types: z.array(DayAnnotationTypeSchema).min(1),
  labels: z.array(z.string()),
  bankId: BankIdSchema.optional(),
  holidayId: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Plan snapshot
// ---------------------------------------------------------------------------

export const PlanSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().min(1),
  engineVersion: z.string().min(1),
  settings: PlannerSettingsSchema,
  bookings: z.array(TimeOffBookingSchema),
  ledger: z.array(LedgerEventSchema),
  annotations: z.array(DayAnnotationSchema),
  score: PlannerObjectiveScoreSchema,
  explanations: z.array(PlannerExplanationSchema),
  feasibility: PlanFeasibilitySchema,
  validationIssues: z.array(ValidationIssueSchema),
})

// ---------------------------------------------------------------------------
// Versioned storage envelope (for safe migration)
// ---------------------------------------------------------------------------

export const StorageEnvelopeSchema = z.object({
  schemaVersion: z.number().int().positive(),
  data: z.unknown(),
})

export const CURRENT_SCHEMA_VERSION = 2
