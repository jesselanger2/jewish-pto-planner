/**
 * src/components/Disclaimer.tsx
 * Visible disclaimer that this is a planning aid, not payroll software.
 * Must appear near any plan results per SPEC.
 */
import { Info } from 'lucide-react'

export function Disclaimer() {
  return (
    <p className="disclaimer" role="note">
      <Info size={13} aria-hidden="true" />
      <span>
        This is a planning aid, not payroll software or religious advice. All
        recommendations show <strong>dates to request</strong> — employer
        approval is not implied. Observance rules shown are editable defaults,
        not universal practice.
      </span>
    </p>
  )
}
