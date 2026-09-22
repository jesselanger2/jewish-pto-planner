/**
 * src/components/BankTag.tsx
 * Colored tag for vacation / heritage / personal banks.
 */
import type { BankId } from '../domain/models'

interface BankTagProps {
  bankId: BankId
  label?: string
}

const LABELS: Record<BankId, string> = {
  vacation: 'Vacation',
  heritage: 'Heritage',
  personal: 'Personal',
}

export function BankTag({ bankId, label }: BankTagProps) {
  return (
    <span className={`bank-tag bank-${bankId}`}>
      {label ?? LABELS[bankId]}
    </span>
  )
}
