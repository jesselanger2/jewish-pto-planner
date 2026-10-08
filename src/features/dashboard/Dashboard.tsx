/**
 * src/features/dashboard/Dashboard.tsx
 *
 * Primary landing view. Shows plan health, bank balances, rollover status,
 * and next required dates. The infeasible alert is impossible to miss.
 *
 * Reads from AppContext — no domain calculations here.
 */
import { Sparkles, RotateCcw, AlertTriangle, CalendarDays, Shield } from 'lucide-react'
import { useAppState, useAppActions } from '../../lib/AppContext'
import { Disclaimer } from '../../components/Disclaimer'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { EmptyState } from '../../components/EmptyState'
import { AlertBanner } from '../../components/AlertBanner'
import { BankTag } from '../../components/BankTag'
import { Badge } from '../../components/Badge'
import type { PlanSnapshot } from '../../domain/models'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function daysLabel(n: number): string {
  return `${n} day${n === 1 ? '' : 's'}`
}

function getNextRolloverDate(plan: PlanSnapshot): string | null {
  const rollover = plan.ledger.find((e) => e.type === 'rollover' && e.date > new Date().toISOString().slice(0, 10))
  return rollover?.date ?? null
}

function getUpcomingRequired(plan: PlanSnapshot, count = 5): Array<{ date: string; label: string; bankId: string }> {
  const today = new Date().toISOString().slice(0, 10)
  return plan.bookings
    .filter((b) => b.reason === 'required-holiday' && b.date >= today)
    .slice(0, count)
    .map((b) => {
      const ann = plan.annotations.find((a) => a.date === b.date)
      const label = ann?.labels[0] ?? b.holidayId ?? 'Jewish holiday'
      return { date: b.date, label, bankId: b.bankId }
    })
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BalanceCard({
  bankId, label, balance, grant,
}: { bankId: string; label?: string; balance: number; grant: number }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <BankTag bankId={bankId} label={label} />
        <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
          {daysLabel(grant)} / year
        </span>
      </div>
      <div>
        <p className="stat-label">Current Balance</p>
        <p className="stat-value" style={{ fontSize: '2rem' }}>
          {balance}
          <span style={{ fontSize: '1rem', color: 'var(--slate-400)', fontWeight: 400, marginLeft: '0.25rem' }}>days</span>
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export function Dashboard({ onNavigate }: { onNavigate: (view: string) => void }) {
  const { plan, isGenerating, settings } = useAppState()
  const { generatePlan } = useAppActions()

  // Loading state
  if (isGenerating) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', paddingTop: '4rem' }}>
          <LoadingSpinner label="Generating plan…" size={36} />
          <p>Running the planning engine…</p>
        </div>
      </div>
    )
  }

  // No plan yet
  if (!plan) {
    return (
      <div className="page-container">
        <EmptyState
          icon={<CalendarDays size={28} />}
          heading="No plan generated yet"
          description="Generate your first plan to see balance projections, rollover status, and holiday recommendations."
          action={
            <button
              className="btn btn-primary btn-lg"
              id="dashboard-generate-first"
              onClick={() => generatePlan()}
              disabled={!settings}
            >
              <Sparkles size={18} /> Generate Plan
            </button>
          }
        />
      </div>
    )
  }

  const { score, feasibility, validationIssues } = plan
  const currentPlan = plan // non-null after the guards above

  // Derive balances for ALL banks in the policy, not just the hardcoded three
  function getBalance(bankId: string): number {
    const events = currentPlan.ledger.filter((e) => e.bankId === bankId)
    if (events.length === 0) return currentPlan.settings.employerPolicy.startingBalances[bankId] ?? 0
    return events[events.length - 1].resultingBalance
  }

  const allBanks = currentPlan.settings.employerPolicy.banks
  const nextRollover = getNextRolloverDate(currentPlan)
  const upcomingRequired = getUpcomingRequired(currentPlan)
  const horizon = currentPlan.settings.horizonYears

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page heading */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Dashboard</h1>
          <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
            {horizon}-year plan starting{' '}
            <strong style={{ color: 'var(--slate-300)' }}>{formatDate(plan.settings.horizonStart)}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Badge variant={feasibility}>{feasibility === 'valid' ? 'Valid Plan' : 'Infeasible'}</Badge>
          <button
            className="btn btn-secondary"
            id="dashboard-regenerate"
            onClick={() => generatePlan()}
          >
            <RotateCcw size={14} /> Regenerate
          </button>
        </div>
      </div>

      {/* --- Infeasible mega-alert (impossible to miss) --- */}
      {feasibility === 'infeasible' && (
        <div className="infeasible-banner" role="alert" aria-live="assertive">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={22} color="var(--rose-400)" aria-hidden="true" />
            <h3 style={{ fontSize: '1.1rem' }}>Plan is Infeasible — Vacation Days Will Be Lost</h3>
          </div>
          <p style={{ color: 'var(--rose-300)', fontSize: '0.9rem' }}>
            The engine could not find a plan that avoids all vacation forfeiture.{' '}
            {score.vacationForfeited > 0 && (
              <strong>{daysLabel(score.vacationForfeited)} of vacation would be forfeited</strong>
            )} at rollover.
          </p>
          {validationIssues.map((issue, i) => (
            <div key={i} style={{ fontSize: '0.85rem', color: 'var(--slate-300)', paddingLeft: '0.5rem', borderLeft: '2px solid var(--rose-500)' }}>
              <strong style={{ color: 'var(--rose-400)' }}>{issue.code}</strong>
              {' '}{issue.message}
              {issue.rolloverDate && (
                <span style={{ color: 'var(--slate-400)' }}> (rollover: {formatDate(issue.rolloverDate)})</span>
              )}
            </div>
          ))}
          <button
            className="btn btn-secondary"
            onClick={() => onNavigate('policy')}
            style={{ alignSelf: 'flex-start' }}
          >
            Review Policy Settings
          </button>
        </div>
      )}

      {/* --- Plan health summary --- */}
      <section aria-labelledby="health-heading">
        <h2 id="health-heading" style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
          Plan Health
        </h2>
        <div className="grid-cols-stats">
          <div className="card stat-card">
            <p className="stat-label">Status</p>
            <Badge variant={feasibility}>{feasibility === 'valid' ? '✓ Valid' : '✗ Infeasible'}</Badge>
          </div>
          <div className="card stat-card">
            <p className="stat-label">Vacation Forfeited</p>
            <p className="stat-value" style={{ color: score.vacationForfeited > 0 ? 'var(--rose-400)' : 'var(--emerald-400)' }}>
              {score.vacationForfeited}
              <span style={{ fontSize: '1rem', color: 'var(--slate-400)', fontWeight: 400, marginLeft: '0.25rem' }}>days</span>
            </p>
          </div>
          <div className="card stat-card">
            <p className="stat-label">Optional Holidays Covered</p>
            <p className="stat-value">{score.optionalObservancesCovered}</p>
          </div>
          <div className="card stat-card">
            <p className="stat-label">Total Bookings</p>
            <p className="stat-value">{plan.bookings.length}</p>
          </div>
        </div>
      </section>

      {/* --- Bank balances --- */}
      <section aria-labelledby="balances-heading">
        <h2 id="balances-heading" style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
          PTO Balances (Projected End of Plan)
        </h2>
        <div className="grid-cols-stats">
          {allBanks.map((bank) => (
            <BalanceCard
              key={bank.id}
              bankId={bank.id}
              label={bank.label}
              balance={getBalance(bank.id)}
              grant={bank.annualGrant}
            />
          ))}
        </div>
      </section>

      {/* --- Rollover status --- */}
      {nextRollover && (
        <section aria-labelledby="rollover-heading">
          <h2 id="rollover-heading" style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Rollover Status
          </h2>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Shield size={20} color="var(--violet-400)" aria-hidden="true" />
            <div>
              <p style={{ color: 'var(--slate-300)', fontWeight: 600 }}>
                Next rollover: <strong style={{ color: 'var(--slate-200)' }}>{formatDate(nextRollover)}</strong>
              </p>
              {score.vacationForfeited === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--emerald-400)' }}>
                  ✓ Zero vacation will be forfeited at this rollover
                </p>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--rose-400)' }}>
                  ⚠ {daysLabel(score.vacationForfeited)} projected to be forfeited
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* --- Next required observances --- */}
      {upcomingRequired.length > 0 && (
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
            Next Required Observances
          </h2>
          <div className="card" style={{ padding: 0 }}>
            <ul style={{ listStyle: 'none' }}>
              {upcomingRequired.map((item, i) => (
                <li
                  key={item.date}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1.25rem',
                    borderBottom: i < upcomingRequired.length - 1 ? '1px solid var(--glass-border)' : 'none',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--slate-200)', fontSize: '0.9rem' }}>{item.label}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--slate-400)' }}>{formatDate(item.date)}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Badge variant="required">Required</Badge>
                    <BankTag bankId={item.bankId} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Warning alerts (non-infeasible issues) */}
      {feasibility === 'valid' && validationIssues.length > 0 && (
        <AlertBanner variant="warning" title="Planner Warnings" dismissible>
          <ul style={{ paddingLeft: '1rem', fontSize: '0.875rem' }}>
            {validationIssues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </AlertBanner>
      )}

      <Disclaimer />
    </div>
  )
}
