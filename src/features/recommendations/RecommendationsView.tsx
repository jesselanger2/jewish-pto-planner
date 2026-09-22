/**
 * src/features/recommendations/RecommendationsView.tsx
 *
 * Grouped list of recommended PTO blocks with:
 * - Date range, bank used, resulting break span
 * - Nearby holidays/weekends that make the break valuable
 * - Plain-language explanation (from PlannerExplanation)
 * - Lock button → triggers re-plan with preserved locks
 * - "Dates to request" framing — never implies employer approval
 * - Infeasible state (impossible to miss)
 * - Disclaimer
 */
import { Lock, AlertTriangle, Calendar, Sparkles } from 'lucide-react'
import { useAppState, useAppActions } from '../../lib/AppContext'
import { Disclaimer } from '../../components/Disclaimer'
import { EmptyState } from '../../components/EmptyState'
import { Badge } from '../../components/Badge'
import { BankTag } from '../../components/BankTag'
import type { TimeOffBooking, PlannerExplanation, BookingReason, BankId } from '../../domain/models'

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function reasonBadge(reason: BookingReason) {
  switch (reason) {
    case 'required-holiday': return <Badge variant="required">Required</Badge>
    case 'optional-holiday': return <Badge variant="optional">Optional</Badge>
    case 'rollover-protection': return <Badge variant="rollover">Rollover Protection</Badge>
    case 'discretionary': return <Badge variant="discretionary">Discretionary</Badge>
    case 'locked': return <Badge variant="locked">Locked</Badge>
  }
}

// Group consecutive booking dates into blocks
function groupIntoBlocks(bookings: TimeOffBooking[]): TimeOffBooking[][] {
  if (bookings.length === 0) return []
  const sorted = [...bookings].sort((a, b) => a.date.localeCompare(b.date))
  const blocks: TimeOffBooking[][] = [[sorted[0]]]

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].date
    const curr = sorted[i].date
    const [py, pm, pd] = prev.split('-').map(Number)
    const [cy, cm, cd] = curr.split('-').map(Number)
    const prevMs = new Date(py, pm - 1, pd).getTime()
    const currMs = new Date(cy, cm - 1, cd).getTime()
    const daysDiff = (currMs - prevMs) / 86400000

    // Group if within 3 days (allows weekends in between)
    if (daysDiff <= 3 && sorted[i].bankId === sorted[i - 1].bankId) {
      blocks[blocks.length - 1].push(sorted[i])
    } else {
      blocks.push([sorted[i]])
    }
  }
  return blocks
}

interface RecommendationCardProps {
  block: TimeOffBooking[]
  explanation: PlannerExplanation | undefined
  holidayLabels: string[]
  isLocked: boolean
  onLock: (booking: TimeOffBooking) => void
}

function RecommendationCard({ block, explanation, holidayLabels, isLocked, onLock }: RecommendationCardProps) {
  const first = block[0]
  const last = block[block.length - 1]
  const isSingleDay = block.length === 1

  // Away span: from first date to last date inclusive
  const [fy, fm, fd] = first.date.split('-').map(Number)
  const [ly, lm, ld] = last.date.split('-').map(Number)
  const firstMs = new Date(fy, fm - 1, fd).getTime()
  const lastMs = new Date(ly, lm - 1, ld).getTime()
  const awaySpan = Math.round((lastMs - firstMs) / 86400000) + 1

  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', transition: 'all 0.2s' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
            <p style={{ fontWeight: 700, color: 'var(--slate-200)', fontSize: '0.95rem' }}>
              {isSingleDay
                ? formatDate(first.date)
                : `${formatShortDate(first.date)} – ${formatDate(last.date)}`}
            </p>
            {isLocked && <Badge variant="locked"><Lock size={10} /> Locked</Badge>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {reasonBadge(first.reason)}
            <BankTag bankId={first.bankId as BankId} />
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
              {block.length} PTO day{block.length !== 1 ? 's' : ''}
              {block.length < awaySpan && ` · ${awaySpan} days off total`}
            </span>
          </div>
        </div>
        {!isLocked && first.reason !== 'locked' && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onLock(first)}
            id={`lock-rec-${first.id}`}
            aria-label={`Lock date ${formatDate(first.date)}`}
          >
            <Lock size={13} /> Lock
          </button>
        )}
      </div>

      {/* Explanation */}
      {explanation && (
        <p style={{ fontSize: '0.875rem', color: 'var(--slate-300)', lineHeight: 1.6 }}>
          {explanation.humanReadable}
        </p>
      )}

      {/* Holiday labels */}
      {holidayLabels.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {holidayLabels.map((lbl, i) => (
            <span key={i} style={{ fontSize: '0.78rem', color: 'var(--amber-400)', background: 'rgba(245,158,11,0.1)', padding: '0.15rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.2)' }}>
              ✡ {lbl}
            </span>
          ))}
        </div>
      )}

      {/* Individual dates in block */}
      {block.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {block.map((b) => (
            <span
              key={b.id}
              style={{ fontSize: '0.75rem', color: 'var(--slate-400)', background: 'var(--navy-900)', padding: '0.15rem 0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)' }}
            >
              {formatShortDate(b.date)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function RecommendationsView() {
  const { plan, settings } = useAppState()
  const { lockDate } = useAppActions()

  if (!plan || !settings) {
    return (
      <div className="page-container">
        <EmptyState
          icon={<Sparkles size={28} />}
          heading="No recommendations yet"
          description="Generate a plan from the Dashboard to see your PTO recommendations."
        />
      </div>
    )
  }

  const { bookings, explanations, feasibility, validationIssues, score, annotations } = plan

  // Build explanation map by bookingId
  const expMap = new Map<string, PlannerExplanation>()
  for (const e of explanations) expMap.set(e.bookingId, e)

  // Build annotation map for holiday labels
  const annMap = new Map<string, string[]>()
  for (const a of annotations) annMap.set(a.date, a.labels)

  // Locked dates set
  const lockedDates = new Set(settings.lockedTimeOff.map((lt) => lt.date))

  // Separate locked from non-locked non-required
  const requiredBookings = bookings.filter((b) => b.reason === 'required-holiday')
  const recommendedBookings = bookings.filter((b) => b.reason !== 'required-holiday' && !b.locked)
  const lockedBookings = bookings.filter((b) => b.locked || b.reason === 'locked')

  const requiredBlocks = groupIntoBlocks(requiredBookings)
  const recommendedBlocks = groupIntoBlocks(recommendedBookings)
  const lockedBlocks = groupIntoBlocks(lockedBookings)

  function handleLock(booking: TimeOffBooking) {
    lockDate(booking.date, booking.bankId as BankId, explanations.find(e => e.bookingId === booking.id)?.humanReadable ?? 'Locked by user')
  }

  function getHolidayLabels(block: TimeOffBooking[]): string[] {
    const labels: string[] = []
    for (const b of block) {
      const ann = annMap.get(b.date) ?? []
      labels.push(...ann.filter(Boolean))
    }
    return [...new Set(labels)]
  }

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Dates to Request</h1>
          <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
            {bookings.length} days planned across {plan.settings.horizonYears} year{plan.settings.horizonYears !== 1 ? 's' : ''}
          </p>
        </div>
        <Badge variant={feasibility}>{feasibility === 'valid' ? 'Valid Plan' : 'Infeasible'}</Badge>
      </div>

      {/* Infeasible alert */}
      {feasibility === 'infeasible' && (
        <div className="infeasible-banner" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={20} color="var(--rose-400)" aria-hidden="true" />
            <h3 style={{ fontSize: '1rem' }}>Plan is Infeasible</h3>
          </div>
          <p style={{ color: 'var(--rose-300)', fontSize: '0.875rem' }}>
            {score.vacationForfeited > 0 && `${score.vacationForfeited} vacation day${score.vacationForfeited !== 1 ? 's' : ''} would be forfeited. `}
            This plan does not satisfy all hard constraints.
          </p>
          {validationIssues.map((issue, i) => (
            <p key={i} style={{ fontSize: '0.82rem', color: 'var(--slate-300)', borderLeft: '2px solid var(--rose-400)', paddingLeft: '0.5rem' }}>
              {issue.message}
            </p>
          ))}
        </div>
      )}

      {/* Required observances */}
      {requiredBlocks.length > 0 && (
        <section aria-labelledby="required-heading">
          <h2 id="required-heading" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate-400)', marginBottom: '0.75rem' }}>
            Required Observances ({requiredBookings.length} days)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {requiredBlocks.map((block) => (
              <RecommendationCard
                key={block[0].id}
                block={block}
                explanation={expMap.get(block[0].id)}
                holidayLabels={getHolidayLabels(block)}
                isLocked={lockedDates.has(block[0].date)}
                onLock={handleLock}
              />
            ))}
          </div>
        </section>
      )}

      {/* Locked dates */}
      {lockedBlocks.length > 0 && (
        <section aria-labelledby="locked-heading">
          <h2 id="locked-heading" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate-400)', marginBottom: '0.75rem' }}>
            Locked Dates ({lockedBookings.length} days)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {lockedBlocks.map((block) => (
              <RecommendationCard
                key={block[0].id}
                block={block}
                explanation={expMap.get(block[0].id)}
                holidayLabels={getHolidayLabels(block)}
                isLocked={true}
                onLock={handleLock}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recommended PTO */}
      {recommendedBlocks.length > 0 && (
        <section aria-labelledby="recommended-heading">
          <h2 id="recommended-heading" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate-400)', marginBottom: '0.75rem' }}>
            Recommended PTO ({recommendedBookings.length} days)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recommendedBlocks.map((block) => (
              <RecommendationCard
                key={block[0].id}
                block={block}
                explanation={expMap.get(block[0].id)}
                holidayLabels={getHolidayLabels(block)}
                isLocked={lockedDates.has(block[0].date)}
                onLock={handleLock}
              />
            ))}
          </div>
        </section>
      )}

      {bookings.length === 0 && (
        <EmptyState
          icon={<Calendar size={28} />}
          heading="No recommendations"
          description="The planner found no bookings to recommend for your current settings. Try adjusting your policy or holiday rules."
        />
      )}

      <Disclaimer />
    </div>
  )
}
