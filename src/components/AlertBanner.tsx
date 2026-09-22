/**
 * src/components/AlertBanner.tsx
 * Dismissible alert banner with severity variants.
 */
import { useState } from 'react'
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'

type AlertVariant = 'info' | 'warning' | 'error' | 'success'

interface AlertBannerProps {
  variant: AlertVariant
  children: ReactNode
  dismissible?: boolean
  title?: string
}

const ICONS: Record<AlertVariant, ReactNode> = {
  info: <Info size={16} />,
  warning: <AlertTriangle size={16} />,
  error: <AlertCircle size={16} />,
  success: <CheckCircle size={16} />,
}

export function AlertBanner({ variant, children, dismissible, title }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div
      className={`alert alert-${variant} animate-fade-in`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <span aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }}>
        {ICONS[variant]}
      </span>
      <div style={{ flex: 1 }}>
        {title && (
          <strong style={{ display: 'block', marginBottom: '0.2rem' }}>{title}</strong>
        )}
        {children}
      </div>
      {dismissible && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss alert"
          style={{ flexShrink: 0, padding: '0.1rem', marginLeft: 'auto' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
