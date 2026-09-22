/**
 * src/features/calendar/LockDateModal.tsx
 *
 * Modal shown when clicking a booked date. Shows the date details,
 * explanation, and offers Lock / Remove actions that trigger re-planning.
 */
import { X, Lock, Unlock } from 'lucide-react'
import type { DayAnnotation, TimeOffBooking, PlannerExplanation } from '../../domain/models'
import { useAppActions } from '../../lib/AppContext'
import { BankTag } from '../../components/BankTag'
import { Badge } from '../../components/Badge'
import type { BankId } from '../../domain/models'

interface LockDateModalProps {
  date: string
  annotation: DayAnnotation
  booking: TimeOffBooking | undefined
  explanation: PlannerExplanation | undefined
  isLocked: boolean
  onClose: () => void
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function LockDateModal({ date, annotation, booking, explanation, isLocked, onClose }: LockDateModalProps) {
  const { lockDate, unlockDate } = useAppActions()

  function handleLock() {
    if (!booking) return
    lockDate(date, booking.bankId, booking.note ?? explanation?.humanReadable ?? 'Locked by user')
    onClose()
  }

  function handleUnlock() {
    unlockDate(date)
    onClose()
  }

  const labels = annotation.labels.filter(Boolean)
  const reason = booking?.reason

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal animate-slide-up">
        <div className="modal-header">
          <h2 id="lock-modal-title" style={{ fontSize: '1.1rem' }}>{formatDate(date)}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {labels.map((lbl, i) => (
              <span key={i} style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--amber-400)' }}>
                ✡ {lbl}
              </span>
            ))}
          </div>
        )}

        {/* Booking details */}
        {booking && (
          <div className="card card-sm" style={{ background: 'var(--navy-900)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {reason && <Badge variant={reason === 'locked' ? 'locked' : reason === 'rollover-protection' ? 'rollover' : reason === 'required-holiday' ? 'required' : reason === 'optional-holiday' ? 'optional' : 'discretionary'}>
                {reason.replace(/-/g, ' ')}
              </Badge>}
              <BankTag bankId={booking.bankId as BankId} />
              {isLocked && <Badge variant="locked"><Lock size={10} /> Locked</Badge>}
            </div>
            {explanation && (
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-300)' }}>{explanation.humanReadable}</p>
            )}
          </div>
        )}

        {/* Non-workday annotation only */}
        {!booking && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ color: 'var(--slate-400)', fontSize: '0.875rem' }}>
              {annotation.types.includes('weekend') && 'Weekend — no PTO consumed.'}
              {annotation.types.includes('federal-holiday') && 'US Federal Holiday — no PTO consumed.'}
              {annotation.types.includes('company-holiday') && 'Company Holiday — no PTO consumed.'}
              {annotation.types.includes('custom-closure') && 'Custom Closure — no PTO consumed.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {booking && !isLocked && (
            <button className="btn btn-primary" onClick={handleLock} id="lock-modal-lock">
              <Lock size={14} /> Lock This Date
            </button>
          )}
          {isLocked && (
            <button className="btn btn-secondary" onClick={handleUnlock} id="lock-modal-unlock">
              <Unlock size={14} /> Unlock &amp; Regenerate
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        {booking && (
          <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--slate-400)', borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
            <strong>Locking</strong> preserves this date across re-planning.{' '}
            <strong>Unlocking</strong> removes the lock and regenerates the plan.
            Changes are explained when the new plan is generated.
          </p>
        )}
      </div>
    </div>
  )
}
