/**
 * Tests for src/repositories/LocalStorageRepository.ts
 *
 * Uses a fake in-memory Storage implementation so tests never touch a real
 * browser localStorage. All test data uses fixed values — no system clock.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { ZodError } from 'zod'
import { LocalStorageRepository } from '../LocalStorageRepository'
import type { PlannerSettings, PlanSnapshot } from '../../domain/models'

// ---------------------------------------------------------------------------
// Fake in-memory Storage
// ---------------------------------------------------------------------------

class FakeStorage implements Storage {
  private store = new Map<string, string>()

  get length() {
    return this.store.size
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validSettings: PlannerSettings = {
  horizonStart: '2025-01-01',
  horizonYears: 3,
  jewishCalendar: {
    location: 'diaspora',
    timezone: 'America/New_York',
    includeModernHolidays: false,
  },
  employerPolicy: {
    policyYearStart: { month: 1, day: 1 },
    banks: [
      { id: 'vacation', label: 'Vacation', annualGrant: 15, carryoverCap: 5 },
      { id: 'heritage', label: 'Heritage', annualGrant: 5, carryoverCap: null },
      { id: 'religiousObservance', label: 'Religious Observance', annualGrant: 10, expiresAtYearEnd: true, unpaid: true },
    ],
    startingBalances: { vacation: 10, heritage: 0, religiousObservance: 0 },
    weekendDays: [0, 6],
    useUSFederalHolidays: true,
    companyHolidays: [],
    customClosures: [],
  },
  holidayRules: [
    {
      holidayId: 'rosh-hashana-1',
      observance: 'required',
      preferredBankOrder: ['heritage', 'vacation'],
    },
  ],
  lockedTimeOff: [],
}

const validPlanSnapshot: PlanSnapshot = {
  id: 'plan-001',
  name: 'My 2025 Plan',
  createdAt: '2025-01-01T00:00:00Z',
  engineVersion: '1.0.0',
  settings: validSettings,
  bookings: [],
  ledger: [],
  annotations: [],
  score: {
    feasibility: 'valid',
    vacationForfeited: 0,
    optionalObservancesCovered: 0,
    continuousSpanScore: 0,
    fragmentationPenalty: 0,
  },
  explanations: [],
  feasibility: 'valid',
  validationIssues: [],
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let storage: FakeStorage
let repo: LocalStorageRepository

beforeEach(() => {
  storage = new FakeStorage()
  repo = new LocalStorageRepository(storage)
})

// ---------------------------------------------------------------------------
// Settings — load / save round-trip
// ---------------------------------------------------------------------------

describe('loadSettings', () => {
  it('returns null when nothing has been saved', async () => {
    expect(await repo.loadSettings()).toBeNull()
  })

  it('returns null on corrupt JSON', async () => {
    storage.setItem('jewish-pto-planner:settings', 'not valid json{{{')
    expect(await repo.loadSettings()).toBeNull()
  })

  it('returns null when envelope schema is missing schemaVersion', async () => {
    storage.setItem(
      'jewish-pto-planner:settings',
      JSON.stringify({ data: validSettings }) // no schemaVersion
    )
    expect(await repo.loadSettings()).toBeNull()
  })

  it('returns null when data fails PlannerSettings schema', async () => {
    storage.setItem(
      'jewish-pto-planner:settings',
      JSON.stringify({ schemaVersion: 1, data: { horizonYears: 99 } })
    )
    expect(await repo.loadSettings()).toBeNull()
  })

  it('returns null for an unknown schema version with no migration', async () => {
    storage.setItem(
      'jewish-pto-planner:settings',
      JSON.stringify({ schemaVersion: 9999, data: validSettings })
    )
    expect(await repo.loadSettings()).toBeNull()
  })
})

describe('saveSettings → loadSettings round-trip', () => {
  it('saves and restores valid settings', async () => {
    await repo.saveSettings(validSettings)
    const loaded = await repo.loadSettings()
    expect(loaded).not.toBeNull()
    expect(loaded!.horizonYears).toBe(3)
    expect(loaded!.employerPolicy.banks).toHaveLength(3)
    expect(loaded!.holidayRules[0].holidayId).toBe('rosh-hashana-1')
  })

  it('saves the correct envelope schema version', async () => {
    await repo.saveSettings(validSettings)
    const raw = storage.getItem('jewish-pto-planner:settings')
    const envelope = JSON.parse(raw!) as { schemaVersion: number }
    expect(envelope.schemaVersion).toBe(2)
  })

  it('overwrites existing settings on second save', async () => {
    await repo.saveSettings(validSettings)
    const updated: PlannerSettings = { ...validSettings, horizonYears: 5 }
    await repo.saveSettings(updated)
    const loaded = await repo.loadSettings()
    expect(loaded!.horizonYears).toBe(5)
  })
})

describe('saveSettings — validation', () => {
  it('throws ZodError for invalid settings (horizonYears out of range)', async () => {
    const bad = { ...validSettings, horizonYears: 99 }
    await expect(repo.saveSettings(bad as PlannerSettings)).rejects.toBeInstanceOf(
      ZodError
    )
  })

  it('throws ZodError for invalid IsoDate in horizonStart', async () => {
    const bad = { ...validSettings, horizonStart: '2025-13-99' }
    await expect(repo.saveSettings(bad as PlannerSettings)).rejects.toBeInstanceOf(
      ZodError
    )
  })
})

// ---------------------------------------------------------------------------
// Plans — save / load / delete
// ---------------------------------------------------------------------------

describe('loadSavedPlans', () => {
  it('returns empty array when nothing has been saved', async () => {
    expect(await repo.loadSavedPlans()).toEqual([])
  })

  it('returns empty array on corrupt JSON', async () => {
    storage.setItem('jewish-pto-planner:plans', 'bad json{')
    expect(await repo.loadSavedPlans()).toEqual([])
  })

  it('returns empty array on unknown schema version', async () => {
    storage.setItem(
      'jewish-pto-planner:plans',
      JSON.stringify({ schemaVersion: 9999, data: [] })
    )
    expect(await repo.loadSavedPlans()).toEqual([])
  })

  it('silently drops corrupt snapshots in the array', async () => {
    storage.setItem(
      'jewish-pto-planner:plans',
      JSON.stringify({
        schemaVersion: 2,
        data: [validPlanSnapshot, { id: 'bad', name: 123 }],
      })
    )
    const plans = await repo.loadSavedPlans()
    expect(plans).toHaveLength(1)
    expect(plans[0].id).toBe('plan-001')
  })
})

describe('savePlan → loadSavedPlans round-trip', () => {
  it('saves and restores a valid plan snapshot', async () => {
    await repo.savePlan(validPlanSnapshot)
    const plans = await repo.loadSavedPlans()
    expect(plans).toHaveLength(1)
    expect(plans[0].id).toBe('plan-001')
    expect(plans[0].name).toBe('My 2025 Plan')
    expect(plans[0].feasibility).toBe('valid')
  })

  it('upserts: saving a plan with the same ID replaces it', async () => {
    await repo.savePlan(validPlanSnapshot)
    const updated = { ...validPlanSnapshot, name: 'Updated Plan' }
    await repo.savePlan(updated)
    const plans = await repo.loadSavedPlans()
    expect(plans).toHaveLength(1)
    expect(plans[0].name).toBe('Updated Plan')
  })

  it('stores multiple distinct plans', async () => {
    await repo.savePlan(validPlanSnapshot)
    await repo.savePlan({ ...validPlanSnapshot, id: 'plan-002', name: 'Plan 2' })
    const plans = await repo.loadSavedPlans()
    expect(plans).toHaveLength(2)
  })
})

describe('deletePlan', () => {
  it('removes a plan by ID', async () => {
    await repo.savePlan(validPlanSnapshot)
    await repo.deletePlan('plan-001')
    expect(await repo.loadSavedPlans()).toEqual([])
  })

  it('is a no-op for a non-existent ID', async () => {
    await repo.savePlan(validPlanSnapshot)
    await repo.deletePlan('does-not-exist')
    expect(await repo.loadSavedPlans()).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// clearAll
// ---------------------------------------------------------------------------

describe('clearAll', () => {
  it('removes both settings and plans', async () => {
    await repo.saveSettings(validSettings)
    await repo.savePlan(validPlanSnapshot)
    await repo.clearAll()
    expect(await repo.loadSettings()).toBeNull()
    expect(await repo.loadSavedPlans()).toEqual([])
  })

  it('is safe to call when storage is empty', async () => {
    await expect(repo.clearAll()).resolves.toBeUndefined()
  })
})
