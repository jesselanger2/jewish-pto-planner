/**
 * src/features/settings/PolicySettings.tsx
 *
 * Full employer policy editor:
 * - Policy year start, horizon years
 * - Per-bank: annual grant, starting balance, carryover cap, negative/minimum, expires
 * - Weekend pattern, US federal holidays toggle
 * - Company holidays / custom closures (add/remove rows)
 * - Booking lead time
 *
 * All form state is kept local; changes are saved + a new plan generated on submit.
 * No domain logic here — only form management.
 */
import { useState } from 'react'
import { Plus, Trash2, Save, RotateCcw, Layers } from 'lucide-react'
import type { PlannerSettings, PTOBankPolicy } from '../../domain/models'
import { useAppState, useAppActions } from '../../lib/AppContext'
import { AlertBanner } from '../../components/AlertBanner'
import { BankTag } from '../../components/BankTag'
import { ALL_STARTER_TEMPLATES, CUSTOM_TEMPLATE, type StarterTemplate } from '../../domain/presets/starterTemplates'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function PolicySettings() {
  const { settings } = useAppState()
  const { applySettingsAndGenerate } = useAppActions()

  const [draft, setDraft] = useState<PlannerSettings>(
    settings ?? (() => { throw new Error('PolicySettings rendered without settings') })()
  )
  const [saved, setSaved] = useState(false)
  const [templateLoadId, setTemplateLoadId] = useState('')

  function update(patch: Partial<PlannerSettings>) {
    setDraft((d) => ({ ...d, ...patch }))
    setSaved(false)
  }

  function updatePolicy(patch: Partial<PlannerSettings['employerPolicy']>) {
    setDraft((d) => ({ ...d, employerPolicy: { ...d.employerPolicy, ...patch } }))
    setSaved(false)
  }

  function updateBank(
    bankId: string,
    patch: Partial<PTOBankPolicy>
  ) {
    setDraft((d) => ({
      ...d,
      employerPolicy: {
        ...d.employerPolicy,
        banks: d.employerPolicy.banks.map((b) => (b.id === bankId ? { ...b, ...patch } : b)),
      },
    }))
    setSaved(false)
  }

  function loadTemplate(template: StarterTemplate) {
    setDraft((d) => ({
      ...d,
      employerPolicy: {
        ...d.employerPolicy,
        banks: template.banks,
        startingBalances: template.startingBalances,
      },
    }))
    setSaved(false)
    setTemplateLoadId(template.id)
  }

  function toggleWeekend(day: number) {
    const current = draft.employerPolicy.weekendDays
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort()
    if (updated.length > 6) return
    updatePolicy({ weekendDays: updated })
  }

  function addCompanyHoliday() {
    updatePolicy({
      companyHolidays: [
        ...draft.employerPolicy.companyHolidays,
        { date: new Date().toISOString().slice(0, 10), label: '' },
      ],
    })
  }

  function removeCompanyHoliday(i: number) {
    updatePolicy({
      companyHolidays: draft.employerPolicy.companyHolidays.filter((_, idx) => idx !== i),
    })
  }

  function updateCompanyHoliday(i: number, field: 'date' | 'label', value: string) {
    updatePolicy({
      companyHolidays: draft.employerPolicy.companyHolidays.map((h, idx) =>
        idx === i ? { ...h, [field]: value } : h
      ),
    })
  }

  function addCustomClosure() {
    updatePolicy({
      customClosures: [
        ...draft.employerPolicy.customClosures,
        { date: new Date().toISOString().slice(0, 10), label: '' },
      ],
    })
  }

  function removeCustomClosure(i: number) {
    updatePolicy({
      customClosures: draft.employerPolicy.customClosures.filter((_, idx) => idx !== i),
    })
  }

  function updateCustomClosure(i: number, field: 'date' | 'label', value: string) {
    updatePolicy({
      customClosures: draft.employerPolicy.customClosures.map((h, idx) =>
        idx === i ? { ...h, [field]: value } : h
      ),
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    applySettingsAndGenerate(draft)
    setSaved(true)
  }

  function handleReset() {
    setDraft(settings!)
    setSaved(false)
  }

  if (!settings) return null

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>Policy &amp; Work Calendar</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-ghost" onClick={handleReset} id="policy-reset" type="button">
            <RotateCcw size={14} /> Reset
          </button>
          <button className="btn btn-primary" onClick={handleSave} id="policy-save" type="button">
            <Save size={14} /> Save &amp; Regenerate
          </button>
        </div>
      </div>

      {saved && <AlertBanner variant="success" dismissible>Settings saved and plan regenerated.</AlertBanner>}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} aria-label="Policy settings form" noValidate>

        {/* --- Planning horizon --- */}
        <section aria-labelledby="horizon-heading">
          <h2 id="horizon-heading" style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Planning Horizon</h2>
          <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="ps-horizon-years" className="form-label">Horizon (years)</label>
              <select
                id="ps-horizon-years"
                value={draft.horizonYears}
                onChange={(e) => update({ horizonYears: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* --- Policy year start --- */}
        <section aria-labelledby="policy-year-heading">
          <h2 id="policy-year-heading" style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Policy Year Start</h2>
          <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="ps-policy-month" className="form-label">Month</label>
              <select
                id="ps-policy-month"
                value={draft.employerPolicy.policyYearStart.month}
                onChange={(e) =>
                  updatePolicy({ policyYearStart: { ...draft.employerPolicy.policyYearStart, month: Number(e.target.value) } })
                }
              >
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="ps-policy-day" className="form-label">Day</label>
              <select
                id="ps-policy-day"
                value={draft.employerPolicy.policyYearStart.day}
                onChange={(e) =>
                  updatePolicy({ policyYearStart: { ...draft.employerPolicy.policyYearStart, day: Number(e.target.value) } })
                }
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* --- PTO Banks --- */}
        <section aria-labelledby="banks-heading">
          <h2 id="banks-heading" style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>PTO Banks</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Starter template loader */}
          <div className="card" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <p style={{ fontWeight: 600, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Layers size={15} style={{ color: 'var(--indigo-400)' }} />
                  Load a Starter Template
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--slate-400)', margin: 0 }}>
                  Pre-fills banks with illustrative placeholder values. All numbers are editable examples — not any employer's real policy.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  id="template-select"
                  aria-label="Select a starter template"
                  value={templateLoadId}
                  onChange={(e) => setTemplateLoadId(e.target.value)}
                  style={{ fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}
                >
                  <option value="">— pick a template —</option>
                  {[...ALL_STARTER_TEMPLATES, CUSTOM_TEMPLATE].map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={!templateLoadId}
                  onClick={() => {
                    const t = [...ALL_STARTER_TEMPLATES, CUSTOM_TEMPLATE].find((x) => x.id === templateLoadId)
                    if (t) loadTemplate(t)
                  }}
                  id="load-starter-template"
                >
                  <Layers size={13} /> Load Template
                </button>
              </div>
            </div>
          </div>

          {draft.employerPolicy.banks.map((bank) => {
            const bankId = bank.id
            const hasCarryoverCap = bank.carryoverCap !== null && bank.carryoverCap !== undefined
            const isInformational = bankId === 'sick'
            return (
                <div key={bankId} className="card" style={{ opacity: isInformational ? 0.85 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <BankTag bankId={bankId} label={bank.label} />
                    {bank.unpaid && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--amber-400)', background: 'rgba(245,158,11,0.12)', padding: '2px 8px', borderRadius: '99px', border: '1px solid rgba(245,158,11,0.2)', letterSpacing: '0.03em' }}>UNPAID</span>
                    )}
                    {isInformational && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--slate-400)', background: 'rgba(148,163,184,0.1)', padding: '2px 8px', borderRadius: '99px', border: '1px solid rgba(148,163,184,0.15)', letterSpacing: '0.03em' }}>INFORMATIONAL</span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                    <div className="form-group">
                      <label htmlFor={`ps-${bankId}-grant`} className="form-label">Annual Grant (days)</label>
                      <input
                        id={`ps-${bankId}-grant`}
                        type="number" min={0} step={1}
                        value={bank.annualGrant}
                        onChange={(e) => updateBank(bankId, { annualGrant: Math.max(0, Math.round(Number(e.target.value))) })}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor={`ps-${bankId}-balance`} className="form-label">Starting Balance (days)</label>
                      <input
                        id={`ps-${bankId}-balance`}
                        type="number" min={0} step={1}
                        value={draft.employerPolicy.startingBalances[bankId] ?? 0}
                        onChange={(e) =>
                          updatePolicy({
                            startingBalances: {
                              ...draft.employerPolicy.startingBalances,
                              [bankId]: Math.max(0, Math.round(Number(e.target.value))),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" id={`cap-label-${bankId}`}>Carryover Cap</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label className="checkbox-group">
                          <input
                            type="checkbox"
                            checked={hasCarryoverCap}
                            onChange={(e) => updateBank(bankId, { carryoverCap: e.target.checked ? 10 : null })}
                            aria-labelledby={`cap-label-${bankId}`}
                          />
                          <span>Has cap</span>
                        </label>
                        {hasCarryoverCap && (
                          <input
                            id={`ps-${bankId}-cap`}
                            type="number" min={0} step={1}
                            value={bank.carryoverCap ?? 0}
                            aria-label={`${bank.label} carryover cap in days`}
                            onChange={(e) => updateBank(bankId, { carryoverCap: Math.max(0, Math.round(Number(e.target.value))) })}
                          />
                        )}
                        {!hasCarryoverCap && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--emerald-400)' }}>Unlimited</span>
                        )}
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Other Options</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label className="checkbox-group">
                          <input
                            type="checkbox"
                            checked={bank.expiresAtYearEnd ?? false}
                            onChange={(e) => updateBank(bankId, { expiresAtYearEnd: e.target.checked })}
                          />
                          <span>Expires at year end</span>
                        </label>
                        <label className="checkbox-group">
                          <input
                            type="checkbox"
                            checked={bank.allowNegative ?? false}
                            onChange={(e) => updateBank(bankId, { allowNegative: e.target.checked })}
                          />
                          <span>Allow negative balance</span>
                        </label>
                        {(bank.allowNegative ?? false) && (
                          <div className="form-group" style={{ paddingLeft: '1.5rem' }}>
                            <label htmlFor={`ps-${bankId}-min`} className="form-label">Min balance</label>
                            <input
                              id={`ps-${bankId}-min`}
                              type="number" step={1}
                              value={bank.minimumBalance ?? 0}
                              onChange={(e) => updateBank(bankId, { minimumBalance: Math.round(Number(e.target.value)) })}
                            />
                          </div>
                        )}
                        {isInformational && (
                          <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', margin: '0.25rem 0 0', fontStyle: 'italic' }}>
                            Informational only — the planner does not draw from this bank.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
            )
          })}
          </div>
        </section>

        {/* --- Weekend pattern + federal holidays --- */}
        <section aria-labelledby="workcal-heading">
          <h2 id="workcal-heading" style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Work Calendar</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <fieldset style={{ border: 'none', padding: 0 }}>
              <legend className="form-label" style={{ marginBottom: '0.625rem' }}>Weekend Days (no PTO consumed)</legend>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {DAY_NAMES.map((name, i) => {
                  const isWeekend = draft.employerPolicy.weekendDays.includes(i)
                  return (
                    <label
                      key={i}
                      style={{
                        padding: '0.375rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isWeekend ? 'var(--indigo-500)' : 'var(--glass-border)',
                        background: isWeekend ? 'rgba(99,102,241,0.15)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isWeekend}
                        onChange={() => toggleWeekend(i)}
                        aria-label={`${name} is a weekend day`}
                        style={{ accentColor: 'var(--indigo-500)' }}
                      />
                      <span style={{ color: isWeekend ? 'var(--indigo-300)' : 'var(--slate-400)', fontWeight: 600 }}>
                        {name.slice(0, 3)}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <label className="checkbox-group">
              <input
                type="checkbox"
                id="ps-fed-holidays"
                checked={draft.employerPolicy.useUSFederalHolidays}
                onChange={(e) => updatePolicy({ useUSFederalHolidays: e.target.checked })}
              />
              <span>Enable US Federal Holidays (observed dates)</span>
            </label>

            <div className="form-group" style={{ maxWidth: '200px' }}>
              <label htmlFor="ps-lead-time" className="form-label">Booking Lead Time (days)</label>
              <input
                id="ps-lead-time"
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={draft.employerPolicy.bookingLeadTimeDays ?? ''}
                onChange={(e) =>
                  updatePolicy({
                    bookingLeadTimeDays: e.target.value === '' ? undefined : Math.max(0, Math.round(Number(e.target.value))),
                  })
                }
              />
              <span className="form-hint">Minimum days before requesting PTO.</span>
            </div>
          </div>
        </section>

        {/* --- Company holidays --- */}
        <section aria-labelledby="company-holidays-heading">
          <h2 id="company-holidays-heading" style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Company Holidays</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {draft.employerPolicy.companyHolidays.length === 0 && (
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-400)' }}>No company holidays added.</p>
            )}
            {draft.employerPolicy.companyHolidays.map((h, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                <input
                  type="date"
                  value={h.date}
                  aria-label={`Company holiday ${i + 1} date`}
                  onChange={(e) => updateCompanyHoliday(i, 'date', e.target.value)}
                  style={{ width: '160px' }}
                />
                <input
                  type="text"
                  value={h.label}
                  placeholder="Holiday name"
                  aria-label={`Company holiday ${i + 1} name`}
                  onChange={(e) => updateCompanyHoliday(i, 'label', e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeCompanyHoliday(i)}
                  aria-label={`Remove company holiday ${h.label || i + 1}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addCompanyHoliday} id="add-company-holiday">
              <Plus size={13} /> Add Company Holiday
            </button>
          </div>
        </section>

        {/* --- Custom closures --- */}
        <section aria-labelledby="closures-heading">
          <h2 id="closures-heading" style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Custom Closures</h2>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {draft.employerPolicy.customClosures.length === 0 && (
              <p style={{ fontSize: '0.875rem', color: 'var(--slate-400)' }}>No custom closures added.</p>
            )}
            {draft.employerPolicy.customClosures.map((h, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                <input
                  type="date"
                  value={h.date}
                  aria-label={`Custom closure ${i + 1} date`}
                  onChange={(e) => updateCustomClosure(i, 'date', e.target.value)}
                  style={{ width: '160px' }}
                />
                <input
                  type="text"
                  value={h.label}
                  placeholder="Closure name"
                  aria-label={`Custom closure ${i + 1} name`}
                  onChange={(e) => updateCustomClosure(i, 'label', e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removeCustomClosure(i)}
                  aria-label={`Remove custom closure ${h.label || i + 1}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomClosure} id="add-custom-closure">
              <Plus size={13} /> Add Custom Closure
            </button>
          </div>
        </section>

        {/* Sticky save bar */}
        <div style={{ position: 'sticky', bottom: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '0.75rem', background: 'rgba(6,11,24,0.92)', backdropFilter: 'blur(12px)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
          <button type="button" className="btn btn-ghost" onClick={handleReset} id="policy-reset-bottom">
            <RotateCcw size={14} /> Reset Changes
          </button>
          <button type="submit" className="btn btn-primary" id="policy-save-bottom">
            <Save size={14} /> Save &amp; Regenerate
          </button>
        </div>
      </form>
    </div>
  )
}
