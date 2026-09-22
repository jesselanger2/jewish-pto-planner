/**
 * src/features/ledger/LedgerView.tsx
 *
 * Inspectable chronological ledger table.
 * Filterable by bank and event type.
 * Rollover/expiration events with projected loss are highlighted in red.
 */
import { useState } from 'react'
import { Filter, List } from 'lucide-react'
import { useAppState } from '../../lib/AppContext'
import { EmptyState } from '../../components/EmptyState'
import { BankTag } from '../../components/BankTag'
import type { LedgerEvent, BankId, LedgerEventType } from '../../domain/models'

const BANK_OPTIONS: Array<BankId | 'all'> = ['all', 'vacation', 'heritage', 'personal']
const TYPE_OPTIONS: Array<LedgerEventType | 'all'> = [
  'all', 'opening-balance', 'grant', 'accrual', 'booking', 'rollover', 'expiration', 'adjustment',
]

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function deltaColor(delta: number): string {
  if (delta > 0) return 'var(--emerald-400)'
  if (delta < 0) return 'var(--rose-400)'
  return 'var(--slate-400)'
}

function eventTypeLabel(type: LedgerEventType): string {
  const map: Record<LedgerEventType, string> = {
    'opening-balance': 'Opening Balance',
    'grant': 'Grant',
    'accrual': 'Accrual',
    'booking': 'Booking',
    'rollover': 'Rollover',
    'expiration': 'Expiration',
    'adjustment': 'Adjustment',
  }
  return map[type] ?? type
}

function isLossEvent(event: LedgerEvent): boolean {
  return (event.type === 'rollover' || event.type === 'expiration') && event.delta < 0
}

export function LedgerView() {
  const { plan } = useAppState()
  const [filterBank, setFilterBank] = useState<BankId | 'all'>('all')
  const [filterType, setFilterType] = useState<LedgerEventType | 'all'>('all')

  if (!plan) {
    return (
      <div className="page-container">
        <EmptyState
          icon={<List size={28} />}
          heading="No ledger yet"
          description="Generate a plan from the Dashboard to inspect the PTO ledger."
        />
      </div>
    )
  }

  const events = plan.ledger
    .filter((e) => filterBank === 'all' || e.bankId === filterBank)
    .filter((e) => filterType === 'all' || e.type === filterType)

  const totalLoss = plan.ledger
    .filter(isLossEvent)
    .reduce((sum, e) => sum + Math.abs(e.delta), 0)

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h1>Ledger</h1>
      <p style={{ fontSize: '0.9rem' }}>
        Chronological record of all PTO grants, accruals, bookings, rollovers, and expirations.
        {totalLoss > 0 && (
          <span style={{ color: 'var(--rose-400)', fontWeight: 600 }}>
            {' '}⚠ {totalLoss} day{totalLoss !== 1 ? 's' : ''} forfeited at rollover/expiration.
          </span>
        )}
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={14} color="var(--slate-400)" aria-hidden="true" />
        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="ledger-bank-filter" className="form-label" style={{ display: 'none' }}>Filter by bank</label>
          <select
            id="ledger-bank-filter"
            value={filterBank}
            onChange={(e) => setFilterBank(e.target.value as BankId | 'all')}
            style={{ width: 'auto' }}
            aria-label="Filter by bank"
          >
            {BANK_OPTIONS.map((b) => (
              <option key={b} value={b}>{b === 'all' ? 'All Banks' : b.charAt(0).toUpperCase() + b.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label htmlFor="ledger-type-filter" className="form-label" style={{ display: 'none' }}>Filter by event type</label>
          <select
            id="ledger-type-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as LedgerEventType | 'all')}
            style={{ width: 'auto' }}
            aria-label="Filter by event type"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t === 'all' ? 'All Events' : eventTypeLabel(t as LedgerEventType)}</option>
            ))}
          </select>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--slate-400)', marginLeft: 'auto' }}>
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {events.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>No ledger events match the current filters.</p>
        </div>
      ) : (
        <div className="table-wrapper" role="region" aria-label="Ledger table" tabIndex={0}>
          <table aria-label="PTO Ledger">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Bank</th>
                <th scope="col">Event</th>
                <th scope="col" style={{ textAlign: 'right' }}>Opening</th>
                <th scope="col" style={{ textAlign: 'right' }}>Delta</th>
                <th scope="col" style={{ textAlign: 'right' }}>Balance</th>
                <th scope="col">Reason</th>
                <th scope="col">Policy Year</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const isLoss = isLossEvent(event)
                return (
                  <tr
                    key={event.id}
                    style={isLoss ? { background: 'rgba(244,63,94,0.06)' } : undefined}
                    aria-label={isLoss ? 'Forfeiture event' : undefined}
                  >
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                      {formatDate(event.date)}
                    </td>
                    <td>
                      <BankTag bankId={event.bankId as BankId} />
                    </td>
                    <td style={{ fontSize: '0.82rem', color: isLoss ? 'var(--rose-400)' : 'var(--slate-300)' }}>
                      {isLoss && '⚠ '}{eventTypeLabel(event.type)}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>
                      {event.openingBalance}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: deltaColor(event.delta), fontVariantNumeric: 'tabular-nums' }}>
                      {event.delta > 0 ? '+' : ''}{event.delta}
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 700, color: event.resultingBalance < 0 ? 'var(--rose-400)' : 'var(--slate-200)', fontVariantNumeric: 'tabular-nums' }}>
                      {event.resultingBalance}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--slate-400)', maxWidth: '240px' }}>
                      <span title={event.reason}>{event.reason}</span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--slate-400)', whiteSpace: 'nowrap' }}>
                      {event.policyYearId}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
