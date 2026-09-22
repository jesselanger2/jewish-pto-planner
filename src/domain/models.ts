/**
 * src/domain/models.ts
 *
 * All domain types for the Jewish PTO Planner.
 * These are plain typed values — no React, no browser APIs, no DB calls.
 * Every function in the domain layer takes and returns values of these types.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** A civil local date in YYYY-MM-DD format. Never round-trip through UTC. */
export type IsoDate = string

/** Integer count of days (v1 — no fractional days). */
export type DayUnits = number

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export type ObservanceLevel = 'required' | 'optional' | 'ignore'

export type HolidayLocation = 'diaspora' | 'israel'

export type AccrualCadence = 'annual' | 'monthly' | 'per-pay-period'

export type DayClassification =
  | 'workday'
  | 'weekend'
  | 'company-holiday'
  | 'federal-holiday'
  | 'custom-closure'

/**
 * Well-known bank IDs used by the starter templates and defaults.
 * The type is open (string) to support custom employer banks.
 */
export type BankId =
  | 'vacation'
  | 'heritage'
  | 'religiousObservance'
  | 'volunteer'
  | 'sick'
  | string

// ---------------------------------------------------------------------------
// Employer policy
// ---------------------------------------------------------------------------

export interface PTOBankPolicy {
  id: BankId
  label: string
  annualGrant: DayUnits
  grantDate?: { month: number; day: number }
  accrualCadence?: AccrualCadence
  accrualAmount?: DayUnits
  /** null = unlimited carry-over */
  carryoverCap?: DayUnits | null
  /**
   * Second forfeiture cliff, distinct from the year-end cap.
   * Days that survived the cap must be used by this date or they're lost.
   * E.g. a mid-year use-by deadline on the carried-over vacation balance.
   */
  carryoverDeadline?: { month: number; day: number } | null
  expiresAtYearEnd?: boolean
  allowNegative?: boolean
  minimumBalance?: DayUnits
  /** True for banks (e.g. religiousObservance) that don't draw pay. */
  unpaid?: boolean
  /**
   * True for a fixed paid day the user schedules themselves (e.g. Heritage Day).
   * Grant is still tracked in the ledger; the "floating" is a UI/scheduling concern.
   */
  isFloatingHoliday?: boolean
  /**
   * When false, forfeiture of this bank at year-end is expected behavior —
   * surface as advisory only, not an infeasible result.
   * Defaults to true only for 'vacation'.
   */
  countsTowardVacationLossInvariant?: boolean
}

export interface EmployerPolicy {
  policyYearStart: { month: number; day: number }
  banks: PTOBankPolicy[]
  /** Open record — must have an entry for every bank id in `banks`. */
  startingBalances: Record<string, DayUnits>
  /** Day-of-week indices (0 = Sun, 6 = Sat). Default [0, 6]. */
  weekendDays: number[]
  useUSFederalHolidays: boolean
  companyHolidays: Array<{ date: IsoDate; label: string }>
  customClosures: Array<{ date: IsoDate; label: string }>
  bookingLeadTimeDays?: number
}

// ---------------------------------------------------------------------------
// Jewish calendar settings
// ---------------------------------------------------------------------------

export interface JewishCalendarSettings {
  location: HolidayLocation
  /** IANA timezone string, e.g. 'America/New_York' */
  timezone: string
  includeModernHolidays: boolean
}

// ---------------------------------------------------------------------------
// Holiday rules
// ---------------------------------------------------------------------------

export interface HolidayRule {
  /** Canonical app ID — never raw display text */
  holidayId: string
  observance: ObservanceLevel
  /** Banks tried in order when booking this holiday */
  preferredBankOrder: Array<BankId>
}

// ---------------------------------------------------------------------------
// Planner settings (root persisted entity)
// ---------------------------------------------------------------------------

export interface PlannerSettings {
  horizonStart: IsoDate
  /** Default 3, range 1–5 */
  horizonYears: number
  jewishCalendar: JewishCalendarSettings
  employerPolicy: EmployerPolicy
  holidayRules: HolidayRule[]
  lockedTimeOff: Array<{ date: IsoDate; bankId: BankId; reason: string }>
}

// ---------------------------------------------------------------------------
// Normalized holiday occurrence (produced by the @hebcal/core adapter)
// ---------------------------------------------------------------------------

export interface NormalizedHoliday {
  holidayId: string
  /** Hebrew name */
  hebrewName: string
  /** Localized English name */
  displayName: string
  date: IsoDate
  /** True for the second day of a two-day festival */
  isSecondDay: boolean
  location: HolidayLocation
  /** Raw @hebcal/core event category, preserved for traceability */
  hebcalCategory: string
}

// ---------------------------------------------------------------------------
// PTO ledger
// ---------------------------------------------------------------------------

export type LedgerEventType =
  | 'opening-balance'
  | 'grant'
  | 'accrual'
  | 'booking'
  | 'rollover'
  | 'expiration'
  | 'adjustment'

export interface LedgerEvent {
  id: string
  date: IsoDate
  bankId: BankId
  type: LedgerEventType
  openingBalance: DayUnits
  delta: DayUnits
  resultingBalance: DayUnits
  reason: string
  /** Foreign key to a booking, holiday rule, policy year, etc. */
  sourceId?: string
  policyYearId: string
}

// ---------------------------------------------------------------------------
// Time-off bookings
// ---------------------------------------------------------------------------

export type BookingReason =
  | 'required-holiday'
  | 'rollover-protection'
  | 'optional-holiday'
  | 'discretionary'
  | 'locked'

export interface TimeOffBooking {
  id: string
  date: IsoDate
  bankId: BankId
  reason: BookingReason
  holidayId?: string
  /** True = user locked this date; survives re-planning */
  locked: boolean
  note?: string
}

// ---------------------------------------------------------------------------
// Candidate break (optimizer input/output)
// ---------------------------------------------------------------------------

export interface CandidateBreak {
  id: string
  /** First date of the proposed PTO block */
  startDate: IsoDate
  /** Last date of the proposed PTO block */
  endDate: IsoDate
  /** Workdays that would consume a bank day */
  workdaysConsumed: DayUnits
  /** Total calendar span including surrounding weekends/holidays */
  awaySpanDays: number
  bankId: BankId
  /** Holiday(s) this break covers or extends */
  relatedHolidayIds: string[]
  /** Latest date by which these days must be used to avoid rollover loss */
  rolloverDeadline?: IsoDate
  reason: BookingReason
}

// ---------------------------------------------------------------------------
// Planner output
// ---------------------------------------------------------------------------

export type ValidationIssueCode =
  | 'required-holiday-uncovered'
  | 'insufficient-balance'
  | 'below-minimum-balance'
  | 'vacation-loss-at-rollover'
  | 'booking-on-non-workday'
  | 'no-eligible-workdays-before-cap'
  /** Non-invariant bank (heritage, religiousObservance, volunteer) expired at year end — advisory only, never infeasible. */
  | 'advisory-bank-expiration'

export interface ValidationIssue {
  code: ValidationIssueCode
  message: string
  /** Affected date(s) */
  dates?: IsoDate[]
  bankId?: BankId
  /** For rollover-loss: the exact days that would be forfeited */
  projectedLossDays?: DayUnits
  /** The specific rollover/expiration event date */
  rolloverDate?: IsoDate
}

export type PlanFeasibility = 'valid' | 'infeasible'

export interface PlannerObjectiveScore {
  feasibility: PlanFeasibility
  vacationForfeited: DayUnits
  optionalObservancesCovered: number
  continuousSpanScore: number
  fragmentationPenalty: number
}

export interface PlannerExplanation {
  bookingId: string
  reason: BookingReason
  humanReadable: string
}

export type DayAnnotationType =
  | 'workday'
  | 'weekend'
  | 'company-holiday'
  | 'federal-holiday'
  | 'custom-closure'
  | 'required-holiday'
  | 'optional-holiday'
  | 'modern-holiday'
  | 'pto-booked'
  | 'pto-locked'

export interface DayAnnotation {
  date: IsoDate
  types: DayAnnotationType[]
  labels: string[]
  bankId?: BankId
  holidayId?: string
}

// ---------------------------------------------------------------------------
// Plan snapshot (immutable, stored with all inputs for reproducibility)
// ---------------------------------------------------------------------------

export interface PlanSnapshot {
  id: string
  name: string
  createdAt: string // ISO-8601 timestamp
  engineVersion: string
  /** Complete copy of settings at plan time */
  settings: PlannerSettings
  bookings: TimeOffBooking[]
  ledger: LedgerEvent[]
  annotations: DayAnnotation[]
  score: PlannerObjectiveScore
  explanations: PlannerExplanation[]
  feasibility: PlanFeasibility
  validationIssues: ValidationIssue[]
}
