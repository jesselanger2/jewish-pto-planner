/**
 * Root application component.
 *
 * Responsibilities:
 * - Wraps everything in AppProvider (global state + domain engine access)
 * - Shows OnboardingWizard until settings are configured
 * - Shows NavBar + routed view when settings exist
 * - Shows a full-page loading state during the initial repository hydration
 */
import { useState } from 'react'
import { AppProvider, useAppState } from './lib/AppContext'
import { NavBar } from './components/NavBar'
import { LoadingSpinner } from './components/LoadingSpinner'
import { OnboardingWizard } from './features/onboarding/OnboardingWizard'
import { Dashboard } from './features/dashboard/Dashboard'
import { PolicySettings } from './features/settings/PolicySettings'
import { HolidayRulesView } from './features/holidays/HolidayRulesView'
import { CalendarView } from './features/calendar/CalendarView'
import { RecommendationsView } from './features/recommendations/RecommendationsView'
import { LedgerView } from './features/ledger/LedgerView'
import { SavedPlansView } from './features/saved-plans/SavedPlansView'
import type { ViewId } from './lib/router.ts'

// ---------------------------------------------------------------------------
// Inner app — requires AppProvider to already be mounted
// ---------------------------------------------------------------------------

function AppInner() {
  const { settings, settingsLoaded } = useAppState()
  const [activeView, setActiveView] = useState<ViewId>('dashboard')

  // Full-page loading state while reading from localStorage
  if (!settingsLoaded) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <LoadingSpinner size={40} label="Loading your plan…" />
        <p style={{ color: 'var(--slate-400)', fontSize: '0.9rem' }}>Loading your plan…</p>
      </div>
    )
  }

  // Onboarding wizard — shown if no settings have been saved yet
  if (!settings) {
    return <OnboardingWizard />
  }

  // Main app
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <NavBar activeView={activeView} onNavigate={setActiveView} />

      <main
        id={`panel-${activeView}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeView}`}
        style={{ flex: 1 }}
        tabIndex={-1}
      >
        {activeView === 'dashboard' && (
          <Dashboard onNavigate={(v) => setActiveView(v as ViewId)} />
        )}
        {activeView === 'recommendations' && <RecommendationsView />}
        {activeView === 'calendar' && <CalendarView />}
        {activeView === 'ledger' && <LedgerView />}
        {activeView === 'policy' && <PolicySettings />}
        {activeView === 'holiday-rules' && <HolidayRulesView />}
        {activeView === 'saved-plans' && <SavedPlansView />}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public root export
// ---------------------------------------------------------------------------

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
