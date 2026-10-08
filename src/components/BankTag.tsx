/**
 * src/components/BankTag.tsx
 *
 * Colored tag for any PTO bank. Falls back gracefully for unknown bank IDs —
 * uses a human-readable label derived from the ID (or the optional label prop).
 */
import type { BankId } from '../domain/models'

interface BankTagProps {
  bankId: BankId
  label?: string
}

/** Fallback display labels for well-known bank IDs. */
const WELL_KNOWN_LABELS: Partial<Record<string, string>> = {
  vacation: 'Vacation',
  heritage: 'Heritage',
  religiousObservance: 'Religious',
  personal: 'Personal',
  volunteer: 'Volunteer',
  sick: 'Sick',
}

/** CSS class for well-known bank IDs; unknown banks get a neutral style. */
function bankClass(bankId: string): string {
  const known: Partial<Record<string, string>> = {
    vacation: 'bank-vacation',
    heritage: 'bank-heritage',
    religiousObservance: 'bank-religious',
    personal: 'bank-personal',
    volunteer: 'bank-volunteer',
    sick: 'bank-sick',
  }
  return known[bankId] ?? 'bank-other'
}

/** Derive a human-readable label from a raw bank ID as a last resort. */
function deriveLabel(bankId: string): string {
  return WELL_KNOWN_LABELS[bankId] ?? bankId.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').trim()
}

export function BankTag({ bankId, label }: BankTagProps) {
  return (
    <span className={`bank-tag ${bankClass(bankId)}`}>
      {label ?? deriveLabel(bankId)}
    </span>
  )
}
