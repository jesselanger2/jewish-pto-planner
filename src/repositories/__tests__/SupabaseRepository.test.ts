/**
 * Tests for src/repositories/SupabaseRepository.ts
 *
 * All Supabase client calls are mocked in-process — no network, no real DB.
 * The tests verify:
 *   1. Settings round-trip (save → load)
 *   2. Plans round-trip (save → load, upsert, delete)
 *   3. Corrupt / schema-invalid data is silently dropped
 *   4. User-isolation: queries always include user_id so a row belonging to a
 *      different user is never returned (simulates Postgres RLS filtering).
 */
import { describe, it, expect, vi } from 'vitest'
import { ZodError } from 'zod'
import { SupabaseRepository } from '../SupabaseRepository'
import type { PlannerSettings, PlanSnapshot } from '../../domain/models'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_A = 'user-aaaa-1111'
const USER_B = 'user-bbbb-2222'

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
      {
        id: 'religiousObservance',
        label: 'Religious Observance',
        annualGrant: 10,
        expiresAtYearEnd: true,
        unpaid: true,
      },
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

const validPlan: PlanSnapshot = {
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
// Mock Supabase client
// ---------------------------------------------------------------------------

type MockOpts = {
  settingsData?: unknown       // returned as settings_json (undefined = no row)
  plansData?: unknown[]        // returned as snapshot_json rows
  upsertError?: string | null
  deleteError?: string | null
}

/**
 * Builds a minimal mock of a Supabase query-builder chain.
 * Supports: from() → select() → eq() → order() → maybeSingle() / await / upsert / delete
 */
function buildMockClient(opts: MockOpts) {
  const fromCalls: Array<{ table: string }> = []
  const upsertPayloads: unknown[] = []

  function makeChain(table: string) {
    const filters: Array<[string, unknown]> = []
    let isDelete = false

    const c: Record<string, unknown> = {}
    c['select'] = (_cols?: string) => c
    c['order']  = (_col: string, _opts?: { ascending?: boolean }) => c
    c['eq'] = (col: string, val: unknown) => {
      filters.push([col, val])
      return c
    }

    // Thenable: used when the query is directly awaited (e.g. loadSavedPlans)
    function resolve(fn: (v: unknown) => void) {
      if (isDelete) {
        fn({ data: null, error: opts.deleteError ? { message: opts.deleteError } : null })
        return
      }
      if (table === 'saved_plans') {
        const userFilter = filters.find(([k]) => k === 'user_id')
        const rows = (opts.plansData ?? []).filter((r) => {
          if (!userFilter) return true
          const row = r as Record<string, unknown>
          // RLS simulation: include only rows whose user_id matches (or rows without a user_id field in test data)
          return !('user_id' in row) || row.user_id === userFilter[1]
        })
        fn({ data: rows.map((s) => ({ snapshot_json: s })), error: null })
      } else {
        fn({ data: null, error: null })
      }
    }

    Object.defineProperty(c, 'then', {
      get: () => (fn: (v: unknown) => void) => resolve(fn),
      configurable: true,
    })

    c['maybeSingle'] = async () => {
      if (table === 'planner_settings') {
        const userFilter = filters.find(([k]) => k === 'user_id')
        // RLS simulation: if settingsData has a user_id, only return it for the matching user
        if (opts.settingsData === undefined) return { data: null, error: null }
        if (userFilter) {
          const d = opts.settingsData as Record<string, unknown> | null
          if (d && 'user_id' in d && d.user_id !== userFilter[1]) {
            return { data: null, error: null }
          }
        }
        return { data: opts.settingsData !== undefined ? { settings_json: opts.settingsData } : null, error: null }
      }
      return { data: null, error: null }
    }

    c['upsert'] = async (data: unknown, _opts?: unknown) => {
      upsertPayloads.push(data)
      return { data: null, error: opts.upsertError ? { message: opts.upsertError } : null }
    }

    c['delete'] = () => {
      isDelete = true
      return c
    }

    return c
  }

  const mockClient = {
    from: vi.fn((table: string) => {
      fromCalls.push({ table })
      return makeChain(table)
    }),
    _fromCalls: fromCalls,
    _upsertPayloads: upsertPayloads,
  }

  return mockClient as unknown as import('@supabase/supabase-js').SupabaseClient & {
    _fromCalls: typeof fromCalls
    _upsertPayloads: typeof upsertPayloads
  }
}

// ---------------------------------------------------------------------------
// Tests — loadSettings
// ---------------------------------------------------------------------------

describe('SupabaseRepository — loadSettings', () => {
  it('returns null when no row exists', async () => {
    const repo = new SupabaseRepository(buildMockClient({}), USER_A)
    expect(await repo.loadSettings()).toBeNull()
  })

  it('returns null when data fails Zod schema', async () => {
    const repo = new SupabaseRepository(buildMockClient({ settingsData: { invalid: true } }), USER_A)
    expect(await repo.loadSettings()).toBeNull()
  })

  it('parses and returns valid settings', async () => {
    const repo = new SupabaseRepository(buildMockClient({ settingsData: validSettings }), USER_A)
    const loaded = await repo.loadSettings()
    expect(loaded).not.toBeNull()
    expect(loaded!.horizonYears).toBe(3)
    expect(loaded!.employerPolicy.banks).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// Tests — saveSettings
// ---------------------------------------------------------------------------

describe('SupabaseRepository — saveSettings', () => {
  it('throws ZodError for invalid settings', async () => {
    const repo = new SupabaseRepository(buildMockClient({}), USER_A)
    const bad = { ...validSettings, horizonYears: 99 }
    await expect(repo.saveSettings(bad as PlannerSettings)).rejects.toBeInstanceOf(ZodError)
  })

  it('throws when the upsert returns an error', async () => {
    const repo = new SupabaseRepository(buildMockClient({ upsertError: 'connection refused' }), USER_A)
    await expect(repo.saveSettings(validSettings)).rejects.toThrow('connection refused')
  })

  it('embeds user_id in the upserted payload', async () => {
    const client = buildMockClient({})
    const repo = new SupabaseRepository(client, USER_A)
    await repo.saveSettings(validSettings)
    const payload = client._upsertPayloads[0] as Record<string, unknown>
    expect(payload.user_id).toBe(USER_A)
  })

  it('calls from("planner_settings") when saving', async () => {
    const client = buildMockClient({})
    const repo = new SupabaseRepository(client, USER_A)
    await repo.saveSettings(validSettings)
    const tables = client._fromCalls.map((c) => c.table)
    expect(tables).toContain('planner_settings')
  })
})

// ---------------------------------------------------------------------------
// Tests — loadSavedPlans
// ---------------------------------------------------------------------------

describe('SupabaseRepository — loadSavedPlans', () => {
  it('returns empty array when no plans exist', async () => {
    const repo = new SupabaseRepository(buildMockClient({ plansData: [] }), USER_A)
    expect(await repo.loadSavedPlans()).toEqual([])
  })

  it('silently drops invalid snapshot objects', async () => {
    const repo = new SupabaseRepository(buildMockClient({ plansData: [{ corrupt: true }] }), USER_A)
    expect(await repo.loadSavedPlans()).toHaveLength(0)
  })

  it('parses valid plan snapshots', async () => {
    const repo = new SupabaseRepository(buildMockClient({ plansData: [validPlan] }), USER_A)
    const plans = await repo.loadSavedPlans()
    expect(plans).toHaveLength(1)
    expect(plans[0].id).toBe('plan-001')
    expect(plans[0].feasibility).toBe('valid')
  })

  it('keeps valid snapshots and drops corrupt ones in a mixed array', async () => {
    const repo = new SupabaseRepository(
      buildMockClient({ plansData: [validPlan, { bad: true }] }),
      USER_A
    )
    const plans = await repo.loadSavedPlans()
    expect(plans).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Tests — savePlan
// ---------------------------------------------------------------------------

describe('SupabaseRepository — savePlan', () => {
  it('throws ZodError for an invalid snapshot', async () => {
    const repo = new SupabaseRepository(buildMockClient({}), USER_A)
    await expect(
      repo.savePlan({ id: '', name: '' } as unknown as PlanSnapshot)
    ).rejects.toBeInstanceOf(ZodError)
  })

  it('throws when the upsert returns an error', async () => {
    const repo = new SupabaseRepository(buildMockClient({ upsertError: 'quota exceeded' }), USER_A)
    await expect(repo.savePlan(validPlan)).rejects.toThrow('quota exceeded')
  })

  it('embeds user_id in the upserted payload', async () => {
    const client = buildMockClient({})
    const repo = new SupabaseRepository(client, USER_A)
    await repo.savePlan(validPlan)
    const payload = client._upsertPayloads[0] as Record<string, unknown>
    expect(payload.user_id).toBe(USER_A)
    expect(payload.id).toBe('plan-001')
  })
})

// ---------------------------------------------------------------------------
// Tests — deletePlan
// ---------------------------------------------------------------------------

describe('SupabaseRepository — deletePlan', () => {
  it('throws when the delete returns an error', async () => {
    const repo = new SupabaseRepository(buildMockClient({ deleteError: 'row not found' }), USER_A)
    await expect(repo.deletePlan('plan-001')).rejects.toThrow('row not found')
  })

  it('resolves without error when delete succeeds', async () => {
    const repo = new SupabaseRepository(buildMockClient({}), USER_A)
    await expect(repo.deletePlan('plan-001')).resolves.toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// User-isolation tests
// ---------------------------------------------------------------------------

describe('SupabaseRepository — user isolation', () => {
  /**
   * Isolation strategy:
   *   Layer 1 (client): repository always passes .eq('user_id', this.userId)
   *     in every query, so PostgREST only requests the caller's own rows.
   *   Layer 2 (database): Postgres RLS (auth.uid() = user_id) prevents any
   *     attempt to bypass layer 1, even with a leaked anon key.
   *
   * These tests verify layer 1 by simulating RLS in the mock: the store holds
   * a row tagged with USER_A's id; a repository instantiated for USER_B sees
   * null because the user_id filter doesn't match.
   */

  it('USER_A sees their own settings, USER_B sees nothing', async () => {
    // Store with a row that belongs to USER_A
    const settingsWithOwner = { ...validSettings, _user_id: USER_A }

    // Mock that simulates RLS: returns settings only when filter matches USER_A
    function buildRlsMock(requestingUser: string) {
      const chain: Record<string, unknown> = {}
      let filterUserId: string | null = null

      chain['select'] = () => chain
      chain['eq'] = (_col: string, val: unknown) => {
        if (_col === 'user_id') filterUserId = val as string
        return chain
      }
      chain['order'] = () => chain
      chain['maybeSingle'] = async () => {
        if (filterUserId !== USER_A) return { data: null, error: null }
        return { data: { settings_json: validSettings }, error: null }
      }
      Object.defineProperty(chain, 'then', {
        get: () => (fn: (v: unknown) => void) => fn({ data: [], error: null }),
        configurable: true,
      })
      chain['upsert'] = async () => ({ data: null, error: null })
      chain['delete'] = () => chain

      return { from: (_t: string) => chain, _requestingUser: requestingUser } as unknown as import('@supabase/supabase-js').SupabaseClient
    }

    void settingsWithOwner // used only to document intent

    const repoA = new SupabaseRepository(buildRlsMock(USER_A), USER_A)
    const repoB = new SupabaseRepository(buildRlsMock(USER_B), USER_B)

    const settingsA = await repoA.loadSettings()
    const settingsB = await repoB.loadSettings()

    expect(settingsA).not.toBeNull()
    expect(settingsA!.horizonYears).toBe(3)

    // USER_B must see nothing from USER_A's store
    expect(settingsB).toBeNull()
  })

  it("savePlan always embeds the repository owner's user_id, not another user's", async () => {
    const payloads: unknown[] = []

    const chain: Record<string, unknown> = {}
    chain['select'] = () => chain
    chain['eq']     = () => chain
    chain['order']  = () => chain
    chain['maybeSingle'] = async () => ({ data: null, error: null })
    chain['upsert'] = async (data: unknown) => { payloads.push(data); return { data: null, error: null } }
    chain['delete'] = () => chain
    Object.defineProperty(chain, 'then', {
      get: () => (fn: (v: unknown) => void) => fn({ data: [], error: null }),
      configurable: true,
    })

    const mockClient = { from: (_t: string) => chain } as unknown as import('@supabase/supabase-js').SupabaseClient

    const repoA = new SupabaseRepository(mockClient, USER_A)
    await repoA.savePlan(validPlan)

    const payload = payloads[0] as Record<string, unknown>
    expect(payload.user_id).toBe(USER_A)
    expect(payload.user_id).not.toBe(USER_B)
  })
})
