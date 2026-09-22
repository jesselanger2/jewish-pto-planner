/**
 * src/components/EmptyState.tsx
 * Centered empty state with icon, heading, description, and optional CTA.
 */
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  heading: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, heading, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state animate-fade-in">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <h3 style={{ color: 'var(--slate-300)', marginTop: '0.25rem' }}>{heading}</h3>
      <p style={{ maxWidth: '360px', fontSize: '0.9rem' }}>{description}</p>
      {action && <div>{action}</div>}
    </div>
  )
}
