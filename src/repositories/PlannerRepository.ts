/**
 * src/repositories/PlannerRepository.ts
 *
 * The PlannerRepository interface. Both the local-storage adapter and any
 * future Supabase adapter implement this interface identically, so the app
 * never depends on a concrete storage backend.
 */
import type { PlannerSettings, PlanSnapshot } from '../domain/models'

export interface PlannerRepository {
  /**
   * Load the user's planner settings. Returns null if no settings have been
   * saved yet or if the stored record is corrupt/unmigratable.
   */
  loadSettings(): Promise<PlannerSettings | null>

  /**
   * Persist planner settings. Throws ZodError if settings fail schema
   * validation — callers must validate before calling.
   */
  saveSettings(settings: PlannerSettings): Promise<void>

  /**
   * Load all saved plan snapshots for this user. Returns an empty array if
   * none exist. Silently drops any snapshots that fail schema validation.
   */
  loadSavedPlans(): Promise<PlanSnapshot[]>

  /**
   * Persist a plan snapshot. Throws ZodError if validation fails.
   */
  savePlan(plan: PlanSnapshot): Promise<void>

  /**
   * Delete a saved plan by ID. No-ops if the ID doesn't exist.
   */
  deletePlan(id: string): Promise<void>

  /**
   * Clear all data owned by this repository instance (settings + plans).
   * Used for "Delete all data" and testing teardown.
   */
  clearAll(): Promise<void>
}
