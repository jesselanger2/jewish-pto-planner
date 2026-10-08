/**
 * src/repositories/SupabaseRepository.ts
 *
 * Supabase-backed implementation of PlannerRepository.
 *
 * Table layout (see docs/supabase-migration.sql for DDL):
 *   planner_settings  — one row per user (upsert by user_id)
 *   saved_plans       — one row per snapshot (keyed by id + user_id)
 *
 * Security invariants:
 *   - All tables have RLS enabled with policies restricted to
 *     auth.uid() = user_id.  This adapter never reads another user's rows.
 *   - The anon key used to create the client cannot bypass RLS.
 *   - No service-role key is ever imported here or anywhere in src/.
 *
 * On read:
 *   - Network/schema errors → return null/[] (never throw, safe degradation)
 *   - Zod validation failure → silently drop corrupt records
 *
 * On write:
 *   - Zod-validate first; throw ZodError on failure (caller must validate)
 *   - Upsert to Supabase
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  PlannerSettingsSchema,
  PlanSnapshotSchema,
} from '../domain/schemas'
import type { PlannerSettings, PlanSnapshot } from '../domain/models'
import type { PlannerRepository } from './PlannerRepository'

// ---------------------------------------------------------------------------
// SupabaseRepository
// ---------------------------------------------------------------------------

export class SupabaseRepository implements PlannerRepository {
  private readonly client: SupabaseClient
  private readonly userId: string

  constructor(client: SupabaseClient, userId: string) {
    this.client = client
    this.userId = userId
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async loadSettings(): Promise<PlannerSettings | null> {
    try {
      const { data, error } = await this.client
        .from('planner_settings')
        .select('settings_json')
        .eq('user_id', this.userId)
        .maybeSingle()

      if (error || !data) return null

      const raw = data.settings_json as unknown
      const result = PlannerSettingsSchema.safeParse(raw)
      return result.success ? result.data : null
    } catch {
      return null
    }
  }

  async saveSettings(settings: PlannerSettings): Promise<void> {
    // Validate — throws ZodError on failure
    PlannerSettingsSchema.parse(settings)

    const { error } = await this.client
      .from('planner_settings')
      .upsert(
        {
          user_id: this.userId,
          settings_json: settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) throw new Error(`Failed to save settings: ${error.message}`)
  }

  // -------------------------------------------------------------------------
  // Saved plans
  // -------------------------------------------------------------------------

  async loadSavedPlans(): Promise<PlanSnapshot[]> {
    try {
      const { data, error } = await this.client
        .from('saved_plans')
        .select('snapshot_json')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })

      if (error || !data) return []

      const plans: PlanSnapshot[] = []
      for (const row of data) {
        const result = PlanSnapshotSchema.safeParse(row.snapshot_json)
        if (result.success) {
          plans.push(result.data)
        }
        // Silently drop corrupt snapshots
      }
      return plans
    } catch {
      return []
    }
  }

  async savePlan(plan: PlanSnapshot): Promise<void> {
    // Validate — throws ZodError on failure
    PlanSnapshotSchema.parse(plan)

    const { error } = await this.client
      .from('saved_plans')
      .upsert(
        {
          id: plan.id,
          user_id: this.userId,
          snapshot_json: plan,
          created_at: plan.createdAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id,user_id' }
      )

    if (error) throw new Error(`Failed to save plan: ${error.message}`)
  }

  async deletePlan(id: string): Promise<void> {
    const { error } = await this.client
      .from('saved_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', this.userId)

    if (error) throw new Error(`Failed to delete plan: ${error.message}`)
  }

  async clearAll(): Promise<void> {
    const [settingsResult, plansResult] = await Promise.all([
      this.client
        .from('planner_settings')
        .delete()
        .eq('user_id', this.userId),
      this.client
        .from('saved_plans')
        .delete()
        .eq('user_id', this.userId),
    ])

    if (settingsResult.error) {
      throw new Error(`Failed to clear settings: ${settingsResult.error.message}`)
    }
    if (plansResult.error) {
      throw new Error(`Failed to clear plans: ${plansResult.error.message}`)
    }
  }
}
