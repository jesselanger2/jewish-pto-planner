/**
 * src/features/saved-plans/SavedPlansView.tsx
 *
 * List of named plan snapshots with save, load, duplicate, delete,
 * CSV export, and ICS export actions.
 */
import { useState } from 'react'
import { Save, Trash2, Download, Archive, Upload, User } from 'lucide-react'
import { useAppState, useAppActions } from '../../lib/AppContext'
import { EmptyState } from '../../components/EmptyState'
import { AlertBanner } from '../../components/AlertBanner'
import { Badge } from '../../components/Badge'
import { exportToCSV, exportToICS, triggerDownload } from './exportUtils'
import { AuthPanel } from '../auth/AuthPanel'
import { useAuth } from '../../auth/AuthContext'
import type { PlanSnapshot } from '../../domain/models'

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

interface DeleteConfirmProps {
  plan: PlanSnapshot
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirmModal({ plan, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2 id="delete-modal-title" style={{ fontSize: '1.1rem' }}>Delete Plan?</h2>
        </div>
        <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Delete <strong style={{ color: 'var(--slate-200)' }}>{plan.name}</strong>? This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} id="delete-plan-confirm">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export function SavedPlansView() {
  const { savedPlans, plan } = useAppState()
  const { savePlan, deletePlan, loadSavedPlan } = useAppActions()
  const { supabaseEnabled, user } = useAuth()

  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PlanSnapshot | null>(null)

  async function handleSave() {
    if (!plan || !saveName.trim()) return
    setSaving(true)
    await savePlan(saveName.trim())
    setSaveName('')
    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 3000)
  }

  async function handleDelete(p: PlanSnapshot) {
    await deletePlan(p.id)
    setDeleteTarget(null)
  }

  function handleExportCSV(p: PlanSnapshot) {
    const csv = exportToCSV(p)
    triggerDownload(csv, `${p.name.replace(/[^a-z0-9]/gi, '-')}.csv`, 'text/csv')
  }

  function handleExportICS(p: PlanSnapshot) {
    const ics = exportToICS(p)
    triggerDownload(ics, `${p.name.replace(/[^a-z0-9]/gi, '-')}.ics`, 'text/calendar')
  }

  const sorted = [...savedPlans].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1>Saved Plans</h1>

      {savedMsg && <AlertBanner variant="success" dismissible>Plan saved successfully.</AlertBanner>}

      {/* Account section — only when Supabase is configured */}
      {supabaseEnabled && (
        <section aria-label="Account" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontWeight: 700, color: 'var(--slate-300)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <User size={14} aria-hidden="true" /> Account
          </p>
          {user ? (
            <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--slate-300)' }}>
                Signed in as <strong style={{ color: 'var(--slate-200)' }}>{user.email}</strong> — plans sync across devices.
              </span>
            </div>
          ) : (
            <AuthPanel />
          )}
        </section>
      )}
      {/* Save current plan */}
      {plan && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontWeight: 700, color: 'var(--slate-300)', fontSize: '0.9rem' }}>Save Current Plan</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              id="save-plan-name"
              placeholder="Plan name…"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSave() }}
              aria-label="Plan name"
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={!saveName.trim() || saving}
              id="save-plan-btn"
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => plan && handleExportCSV(plan)} id="export-current-csv">
              <Download size={13} /> Export CSV
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => plan && handleExportICS(plan)} id="export-current-ics">
              <Download size={13} /> Export ICS
            </button>
          </div>
        </div>
      )}

      {/* Saved list */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<Archive size={28} />}
          heading="No saved plans"
          description="Save your current plan with a name to preserve it for later reference."
        />
      ) : (
        <section aria-labelledby="saved-plans-heading">
          <h2 id="saved-plans-heading" style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate-400)', marginBottom: '0.75rem' }}>
            {sorted.length} Saved Plan{sorted.length !== 1 ? 's' : ''}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sorted.map((p) => (
              <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--slate-200)', fontSize: '0.95rem' }}>{p.name}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <Badge variant={p.feasibility}>{p.feasibility}</Badge>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                        {formatDatetime(p.createdAt)} · engine v{p.engineVersion}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>
                        {p.bookings.length} bookings · {p.settings.horizonYears}yr horizon
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => loadSavedPlan(p)}
                      aria-label={`Load plan ${p.name}`}
                      id={`load-plan-${p.id}`}
                    >
                      <Upload size={13} /> Load
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleExportCSV(p)}
                      aria-label={`Export ${p.name} as CSV`}
                    >
                      <Download size={13} /> CSV
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleExportICS(p)}
                      aria-label={`Export ${p.name} as ICS`}
                    >
                      <Download size={13} /> ICS
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteTarget(p)}
                      aria-label={`Delete plan ${p.name}`}
                      id={`delete-plan-${p.id}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          plan={deleteTarget}
          onConfirm={() => void handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
