/**
 * src/components/Badge.tsx
 * Pill badge for observance levels, plan health, and booking reasons.
 */
import type { ReactNode } from 'react'

type BadgeVariant =
  | 'required' | 'optional' | 'ignore'
  | 'valid' | 'infeasible'
  | 'locked' | 'rollover' | 'discretionary'

interface BadgeProps {
  variant: BadgeVariant
  children: ReactNode
  icon?: ReactNode
}

export function Badge({ variant, children, icon }: BadgeProps) {
  return (
    <span className={`badge badge-${variant}`} aria-label={`${variant}: ${children}`}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  )
}
