/**
 * src/components/NavBar.tsx
 *
 * Top navigation bar with tab links, plan health indicator, and branding.
 * State-based routing — no react-router dependency needed.
 */
import { LayoutDashboard, Calendar, Sparkles, Settings, List, Archive, Star } from 'lucide-react'
import type { ViewId } from '../lib/router.ts'
import { useAppState } from '../lib/AppContext'
import { AuthPanel } from '../features/auth/AuthPanel'

interface NavBarProps {
  activeView: ViewId
  onNavigate: (view: ViewId) => void
}

const TABS: { id: ViewId; label: string; icon: React.ReactNode; shortLabel: string }[] = [
  { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', icon: <LayoutDashboard size={15} /> },
  { id: 'recommendations', label: 'Recommendations', shortLabel: 'Recs', icon: <Sparkles size={15} /> },
  { id: 'calendar', label: 'Calendar', shortLabel: 'Cal', icon: <Calendar size={15} /> },
  { id: 'ledger', label: 'Ledger', shortLabel: 'Ledger', icon: <List size={15} /> },
  { id: 'policy', label: 'Policy', shortLabel: 'Policy', icon: <Settings size={15} /> },
  { id: 'holiday-rules', label: 'Holiday Rules', shortLabel: 'Holidays', icon: <Star size={15} /> },
  { id: 'saved-plans', label: 'Saved Plans', shortLabel: 'Saved', icon: <Archive size={15} /> },
]

export function NavBar({ activeView, onNavigate }: NavBarProps) {
  const { plan } = useAppState()

  return (
    <header className="topnav" role="banner">
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {/* Branding row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontSize: '1.375rem' }} aria-hidden="true">✡</span>
            <span
              style={{
                fontSize: '1rem',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--slate-200)',
              }}
            >
              Jewish PTO Planner
            </span>
          </div>
          {plan && (
            <span
              className={`badge badge-${plan.feasibility}`}
              aria-label={`Plan status: ${plan.feasibility}`}
            >
              {plan.feasibility === 'valid' ? '✓ Valid Plan' : '✗ Infeasible'}
            </span>
          )}
          <AuthPanel />
        </div>

        {/* Navigation tabs */}
        <nav
          role="navigation"
          aria-label="Main navigation"
          style={{ paddingBottom: '0.5rem' }}
        >
          <div
            role="tablist"
            aria-label="Application views"
            style={{ display: 'flex', gap: '0.125rem', overflowX: 'auto', paddingBottom: '2px' }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeView === tab.id}
                id={`tab-${tab.id}`}
                aria-controls={`panel-${tab.id}`}
                onClick={() => onNavigate(tab.id)}
                className={`tab ${activeView === tab.id ? 'tab-active' : ''}`}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  )
}
