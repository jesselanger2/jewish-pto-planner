/**
 * src/repositories/LocalStorageRepository.ts
 *
 * Versioned local-storage implementation of PlannerRepository.
 *
 * Storage layout:
 *   jewish-pto-planner:settings  → StorageEnvelope<PlannerSettings>
 *   jewish-pto-planner:plans     → StorageEnvelope<PlanSnapshot[]>
 *
 * Each value is wrapped in a versioned envelope:
 *   { schemaVersion: number, data: unknown }
 *
 * On read:
 *   - JSON.parse failure → return null/[] (corrupt record, never throw)
 *   - Envelope schema failure → return null/[] (never throw)
 *   - Schema version mismatch → attempt migration; if none available → null/[]
 *   - Data schema failure → return null/[] (do not surface corrupt data)
 *
 * On write:
 *   - Zod-validate data first; throw ZodError on failure
 *   - Wrap in envelope and JSON.stringify to storage
 */
import {
  CURRENT_SCHEMA_VERSION,
  PlannerSettingsSchema,
  PlanSnapshotSchema,
  StorageEnvelopeSchema,
} from '../domain/schemas'
import type { PlannerSettings, PlanSnapshot } from '../domain/models'
import type { PlannerRepository } from './PlannerRepository'

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEYS = {
  settings: 'jewish-pto-planner:settings',
  plans: 'jewish-pto-planner:plans',
} as const

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Read and parse raw JSON from localStorage. Returns null on any failure. */
function readRaw(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

/**
 * Parse a storage envelope from raw JSON.
 * Returns null if the envelope itself is malformed.
 */
function parseEnvelope(
  raw: unknown
): { schemaVersion: number; data?: unknown } | null {
  const result = StorageEnvelopeSchema.safeParse(raw)
  return result.success ? result.data : null
}

/**
 * Attempt to migrate settings data from an older schema version.
 * Returns null if migration is not possible.
 *
 * v1 is the initial version — no migrations yet.
 */
function migrateSettings(
  _data: unknown,
  fromVersion: number
): PlannerSettings | null {
  // Future migrations: if (fromVersion === 1) { ... return v2 data }
  void fromVersion
  return null
}

/**
 * Attempt to migrate plans data from an older schema version.
 * Returns null if migration is not possible.
 */
function migratePlans(
  _data: unknown,
  fromVersion: number
): PlanSnapshot[] | null {
  void fromVersion
  return null
}

// ---------------------------------------------------------------------------
// LocalStorageRepository implementation
// ---------------------------------------------------------------------------

/**
 * LocalStorageRepository — implements PlannerRepository using browser
 * localStorage.
 *
 * Pass a custom `storage` in tests to inject a fake (e.g. an object
 * implementing the Storage interface backed by a Map).
 */
export class LocalStorageRepository implements PlannerRepository {
  private readonly storage: Storage

  constructor(storage: Storage = globalThis.localStorage) {
    this.storage = storage
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async loadSettings(): Promise<PlannerSettings | null> {
    const raw = readRaw(this.storage, KEYS.settings)
    if (raw === null) return null

    const envelope = parseEnvelope(raw)
    if (envelope === null) return null

    let candidate = envelope.data

    // Attempt migration if schema version is outdated
    if (envelope.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      const migrated = migrateSettings(
        envelope.data,
        envelope.schemaVersion
      )
      if (migrated === null) return null
      candidate = migrated
    }

    const result = PlannerSettingsSchema.safeParse(candidate)
    return result.success ? result.data : null
  }

  async saveSettings(settings: PlannerSettings): Promise<void> {
    // Validate — throws ZodError on failure (caller's responsibility)
    PlannerSettingsSchema.parse(settings)

    const envelope = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: settings,
    }
    this.storage.setItem(KEYS.settings, JSON.stringify(envelope))
  }

  // -------------------------------------------------------------------------
  // Saved plans
  // -------------------------------------------------------------------------

  async loadSavedPlans(): Promise<PlanSnapshot[]> {
    const raw = readRaw(this.storage, KEYS.plans)
    if (raw === null) return []

    const envelope = parseEnvelope(raw)
    if (envelope === null) return []

    let candidate = envelope.data

    if (envelope.schemaVersion !== CURRENT_SCHEMA_VERSION) {
      const migrated = migratePlans(envelope.data, envelope.schemaVersion)
      if (migrated === null) return []
      candidate = migrated
    }

    // Expect an array; drop individual corrupt snapshots gracefully
    if (!Array.isArray(candidate)) return []

    const plans: PlanSnapshot[] = []
    for (const item of candidate) {
      const result = PlanSnapshotSchema.safeParse(item)
      if (result.success) {
        plans.push(result.data)
      }
      // Silently drop corrupt snapshots
    }
    return plans
  }

  async savePlan(plan: PlanSnapshot): Promise<void> {
    PlanSnapshotSchema.parse(plan) // throws ZodError on failure

    const existing = await this.loadSavedPlans()
    const updated = [
      ...existing.filter((p) => p.id !== plan.id),
      plan,
    ]

    const envelope = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: updated,
    }
    this.storage.setItem(KEYS.plans, JSON.stringify(envelope))
  }

  async deletePlan(id: string): Promise<void> {
    const existing = await this.loadSavedPlans()
    const updated = existing.filter((p) => p.id !== id)
    const envelope = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: updated,
    }
    this.storage.setItem(KEYS.plans, JSON.stringify(envelope))
  }

  async clearAll(): Promise<void> {
    this.storage.removeItem(KEYS.settings)
    this.storage.removeItem(KEYS.plans)
  }
}
