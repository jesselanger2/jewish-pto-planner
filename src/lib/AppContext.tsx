/**
 * src/lib/AppContext.tsx
 *
 * Global application state via React context + useReducer.
 * The domain engine (runPlanner) is called here — never inside UI components.
 *
 * State:
 *   settings        — current PlannerSettings (null = not configured yet)
 *   plan            — most recent PlanSnapshot (null = not yet generated)
 *   savedPlans      — persisted snapshots loaded from storage
 *   isGenerating    — true while runPlanner is executing
 *   settingsLoaded  — true after the initial repository load is done
 *
 * Actions exposed via useAppDispatch():
 *   applySettings(settings)
 *   generatePlan()
 *   lockDate(date, bankId, reason)
 *   unlockDate(date)
 *   savePlan(name)
 *   deletePlan(id)
 *   loadSavedPlan(plan)
 *   clearAllData()
 */

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  type ReactNode,
  startTransition,
} from 'react'
import type { PlannerSettings, PlanSnapshot, BankId } from '../domain/models'
import { runPlanner } from '../domain/planner/runPlanner'
import { LocalStorageRepository } from '../repositories/LocalStorageRepository'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface AppState {
  settings: PlannerSettings | null
  plan: PlanSnapshot | null
  savedPlans: PlanSnapshot[]
  isGenerating: boolean
  settingsLoaded: boolean
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type Action =
  | { type: 'SETTINGS_LOADED'; settings: PlannerSettings | null; savedPlans: PlanSnapshot[] }
  | { type: 'APPLY_SETTINGS'; settings: PlannerSettings }
  | { type: 'GENERATING' }
  | { type: 'PLAN_READY'; plan: PlanSnapshot }
  | { type: 'SAVE_PLAN_DONE'; plan: PlanSnapshot }
  | { type: 'DELETE_PLAN_DONE'; id: string }
  | { type: 'LOAD_SAVED_PLAN'; plan: PlanSnapshot }
  | { type: 'CLEAR_ALL' }

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SETTINGS_LOADED':
      return {
        ...state,
        settings: action.settings,
        savedPlans: action.savedPlans,
        settingsLoaded: true,
      }
    case 'APPLY_SETTINGS':
      return { ...state, settings: action.settings }
    case 'GENERATING':
      return { ...state, isGenerating: true }
    case 'PLAN_READY':
      return { ...state, plan: action.plan, isGenerating: false }
    case 'SAVE_PLAN_DONE':
      return {
        ...state,
        savedPlans: [
          ...state.savedPlans.filter((p) => p.id !== action.plan.id),
          action.plan,
        ],
      }
    case 'DELETE_PLAN_DONE':
      return {
        ...state,
        savedPlans: state.savedPlans.filter((p) => p.id !== action.id),
      }
    case 'LOAD_SAVED_PLAN':
      return {
        ...state,
        settings: action.plan.settings,
        plan: action.plan,
      }
    case 'CLEAR_ALL':
      return {
        settings: null,
        plan: null,
        savedPlans: [],
        isGenerating: false,
        settingsLoaded: true,
      }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const StateContext = createContext<AppState | null>(null)
const DispatchContext = createContext<React.Dispatch<Action> | null>(null)

const initialState: AppState = {
  settings: null,
  plan: null,
  savedPlans: [],
  isGenerating: false,
  settingsLoaded: false,
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const repo = new LocalStorageRepository()

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const isMounted = useRef(true)

  // Load settings + saved plans from storage on mount.
  // Reset isMounted at the top so React StrictMode's double-invoke (unmount →
  // remount) doesn't leave the ref permanently false after the first cleanup.
  useEffect(() => {
    isMounted.current = true
    void (async () => {
      const [settings, savedPlans] = await Promise.all([
        repo.loadSettings(),
        repo.loadSavedPlans(),
      ])
      if (isMounted.current) {
        dispatch({ type: 'SETTINGS_LOADED', settings, savedPlans })
      }
    })()
    return () => { isMounted.current = false }
  }, [])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAppState(): AppState {
  const ctx = useContext(StateContext)
  if (!ctx) throw new Error('useAppState must be used inside AppProvider')
  return ctx
}

function useDispatch(): React.Dispatch<Action> {
  const ctx = useContext(DispatchContext)
  if (!ctx) throw new Error('useDispatch must be used inside AppProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Domain action hooks — these are the public API for the UI
// ---------------------------------------------------------------------------

export function useAppActions() {
  const dispatch = useDispatch()
  const state = useAppState()

  function applySettings(settings: PlannerSettings) {
    dispatch({ type: 'APPLY_SETTINGS', settings })
    // Persist in background
    void repo.saveSettings(settings)
  }

  function generatePlan(settingsOverride?: PlannerSettings) {
    const s = settingsOverride ?? state.settings
    if (!s) return
    dispatch({ type: 'GENERATING' })
    // Run the domain engine inside startTransition so the UI stays responsive
    startTransition(() => {
      const plan = runPlanner(s)
      dispatch({ type: 'PLAN_READY', plan })
    })
  }

  function applySettingsAndGenerate(settings: PlannerSettings) {
    applySettings(settings)
    generatePlan(settings)
  }

  function lockDate(date: string, bankId: BankId, reason: string) {
    if (!state.settings) return
    const already = state.settings.lockedTimeOff.some((lt) => lt.date === date)
    if (already) return
    const updated: PlannerSettings = {
      ...state.settings,
      lockedTimeOff: [...state.settings.lockedTimeOff, { date, bankId, reason }],
    }
    applySettings(updated)
    generatePlan(updated)
  }

  function unlockDate(date: string) {
    if (!state.settings) return
    const updated: PlannerSettings = {
      ...state.settings,
      lockedTimeOff: state.settings.lockedTimeOff.filter((lt) => lt.date !== date),
    }
    applySettings(updated)
    generatePlan(updated)
  }

  async function savePlan(name: string) {
    if (!state.plan) return
    const plan: PlanSnapshot = { ...state.plan, name, id: `plan-${Date.now()}` }
    await repo.savePlan(plan)
    dispatch({ type: 'SAVE_PLAN_DONE', plan })
  }

  async function deletePlan(id: string) {
    await repo.deletePlan(id)
    dispatch({ type: 'DELETE_PLAN_DONE', id })
  }

  function loadSavedPlan(plan: PlanSnapshot) {
    dispatch({ type: 'LOAD_SAVED_PLAN', plan })
  }

  async function clearAllData() {
    await repo.clearAll()
    dispatch({ type: 'CLEAR_ALL' })
  }

  return {
    applySettings,
    generatePlan,
    applySettingsAndGenerate,
    lockDate,
    unlockDate,
    savePlan,
    deletePlan,
    loadSavedPlan,
    clearAllData,
  }
}
