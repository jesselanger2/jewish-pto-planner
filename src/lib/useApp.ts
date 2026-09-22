/**
 * src/lib/useApp.ts
 *
 * Re-exports app hooks from AppContext in a hooks-only file to satisfy
 * the react/only-export-components lint rule (Fast Refresh compatibility).
 *
 * Import from this file when you need useAppState or useAppActions.
 */
export { useAppState, useAppActions } from './AppContext'
