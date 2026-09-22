/**
 * src/features/onboarding/OnboardingWizard.tsx
 *
 * Multi-step wizard shown on first load when no settings exist.
 * Produces a complete PlannerSettings, then calls applySettingsAndGenerate.
 *
 * Steps:
 *  0. Template Picker (template cards + "Start from scratch")
 *  1. Policy year + horizon
 *  2. PTO banks (vacation, heritage, personal)
 *  3. Rollover / caps
 *  4. Work calendar
 *  5. Jewish calendar (location + timezone)
 *  6. Review + generate
 *
 * All fields use native controls with visible labels + Zod validation.
 * No free text for constrained fields.
 */
import { useState } from 'react'
import { ChevronRight, ChevronLeft, Sparkles, CheckCircle, Layers } from 'lucide-react'
import type { PlannerSettings } from '../../domain/models'
import { makeDefaultSettings } from '../../lib/defaultSettings'
import { useAppActions } from '../../lib/AppContext'
import { Disclaimer } from '../../components/Disclaimer'
import {
  ALL_STARTER_TEMPLATES,
  CUSTOM_TEMPLATE,
  type StarterTemplate,
} from '../../domain/presets/starterTemplates'

const STEPS = [
  'Choose a Starting Template',
  'Policy Year',
  'PTO Banks',
  'Rollover & Caps',
  'Work Calendar',
  'Jewish Calendar',
  'Review & Generate',
] as const

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Jerusalem',
  'Asia/Jerusalem', 'Australia/Sydney', 'Canada/Eastern',
]

/** Color accent per template id for card styling */
const TEMPLATE_ACCENT: Record<string, string> = {
  'simple-accrual':     'var(--indigo-500)',
  'annual-grant':       'var(--emerald-500)',
  'two-stage-carryover':'var(--amber-500)',
  'unpaid-observance':  'var(--violet-500)',
  'custom':             'var(--slate-500)',
}

function templateAccentRgb(id: string): string {
  const map: Record<string, string> = {
    'simple-accrual':     '99,102,241',
    'annual-grant':       '16,185,129',
    'two-stage-carryover':'245,158,11',
    'unpaid-observance':  '139,92,246',
    'custom':             '100,116,139',
  }
  return map[id] ?? '99,102,241'
}

function applyTemplateToSettings(
  base: PlannerSettings,
  template: StarterTemplate
): PlannerSettings {
  return {
    ...base,
    employerPolicy: {
      ...base.employerPolicy,
      banks: template.banks,
      startingBalances: template.startingBalances,
    },
  }
}

export function OnboardingWizard() {
  const { applySettingsAndGenerate } = useAppActions()
  const [step, setStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<StarterTemplate>(ALL_STARTER_TEMPLATES[0])
  const [draft, setDraft] = useState<PlannerSettings>(() =>
    applyTemplateToSettings(makeDefaultSettings(), ALL_STARTER_TEMPLATES[0])
  )

  const totalSteps = STEPS.length
  const isFirst = step === 0
  const isLast = step === totalSteps - 1

  function update(patch: Partial<PlannerSettings>) {
    setDraft((d) => ({ ...d, ...patch }))
  }

  function updatePolicy(patch: Partial<PlannerSettings['employerPolicy']>) {
    setDraft((d) => ({ ...d, employerPolicy: { ...d.employerPolicy, ...patch } }))
  }

  function updateCalendar(patch: Partial<PlannerSettings['jewishCalendar']>) {
    setDraft((d) => ({ ...d, jewishCalendar: { ...d.jewishCalendar, ...patch } }))
  }

  function updateBank(
    bankId: string,
    patch: Partial<PlannerSettings['employerPolicy']['banks'][number]>
  ) {
    setDraft((d) => ({
      ...d,
      employerPolicy: {
        ...d.employerPolicy,
        banks: d.employerPolicy.banks.map((b) =>
          b.id === bankId ? { ...b, ...patch } : b
        ),
      },
    }))
  }

  function selectTemplate(template: StarterTemplate) {
    setSelectedTemplate(template)
    setDraft((d) => applyTemplateToSettings(d, template))
  }

  function toggleWeekend(day: number) {
    const current = draft.employerPolicy.weekendDays
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort()
    // Require at least 1 workday (max 6 weekend days)
    if (updated.length > 6) return
    updatePolicy({ weekendDays: updated })
  }

  function handleFinish() {
    applySettingsAndGenerate(draft)
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'var(--navy-950)',
      }}
    >
      {/* Step progress dots */}
      <div className="wizard-steps" aria-label={`Step ${step + 1} of ${totalSteps}`}>
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`wizard-step-dot ${
              i < step ? 'wizard-step-dot-done' : i === step ? 'wizard-step-dot-active' : ''
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      <div
        className="card card-lg animate-slide-up"
        style={{ width: '100%', maxWidth: step === 0 ? '720px' : '560px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Step label */}
          <div>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--indigo-400)', marginBottom: '0.5rem' }}>
              Step {step + 1} of {totalSteps}
            </p>
            <h1 style={{ fontSize: '1.5rem' }}>{STEPS[step]}</h1>
          </div>

          {/* --- STEP 0: Template Picker --- */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--slate-400)', margin: 0 }}>
                Pick a template to seed your policy with illustrative numbers, or start from scratch.
                <strong style={{ color: 'var(--slate-300)' }}> All numbers are placeholders you'll edit in the next steps.</strong>
              </p>

              {/* Template cards grid */}
              <div
                role="radiogroup"
                aria-label="Starter template options"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {[...ALL_STARTER_TEMPLATES, CUSTOM_TEMPLATE].map((template) => {
                  const isSelected = selectedTemplate.id === template.id
                  const accent = TEMPLATE_ACCENT[template.id] ?? 'var(--indigo-500)'
                  const rgb = templateAccentRgb(template.id)
                  return (
                    <button
                      key={template.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      id={`template-option-${template.id}`}
                      onClick={() => selectTemplate(template)}
                      style={{
                        textAlign: 'left',
                        padding: '1rem',
                        borderRadius: '12px',
                        border: `2px solid`,
                        borderColor: isSelected ? accent : 'var(--glass-border)',
                        background: isSelected ? `rgba(${rgb}, 0.12)` : 'var(--navy-900)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        fontFamily: 'var(--font-sans)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Layers
                          size={15}
                          style={{ color: isSelected ? accent : 'var(--slate-500)', flexShrink: 0 }}
                        />
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            color: isSelected ? 'var(--slate-100)' : 'var(--slate-300)',
                          }}
                        >
                          {template.name}
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--slate-400)',
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        {template.description}
                      </p>
                      {/* Mechanism labels */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                        {template.mechanismLabels.map((label) => (
                          <span
                            key={label}
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '99px',
                              background: isSelected ? `rgba(${rgb}, 0.2)` : 'rgba(148,163,184,0.08)',
                              color: isSelected ? accent : 'var(--slate-400)',
                              border: `1px solid`,
                              borderColor: isSelected ? `rgba(${rgb}, 0.35)` : 'rgba(148,163,184,0.12)',
                            }}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', margin: 0 }}>
                None of these templates represent any specific employer's actual policy.
                They are illustrative examples only — a planning aid, not payroll or legal advice.
              </p>
              <Disclaimer />
            </div>
          )}

          {/* --- STEP 1: Policy year + horizon --- */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label htmlFor="horizon-years" className="form-label">Planning Horizon</label>
                <select
                  id="horizon-years"
                  value={draft.horizonYears}
                  onChange={(e) => update({ horizonYears: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>
                  ))}
                </select>
                <span className="form-hint">Default is 3 years. Maximum 5 years.</span>
              </div>

              <fieldset style={{ border: 'none', padding: 0 }}>
                <legend className="form-label" style={{ marginBottom: '0.5rem' }}>Policy Year Start</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label htmlFor="policy-month" className="form-label">Month</label>
                    <select
                      id="policy-month"
                      value={draft.employerPolicy.policyYearStart.month}
                      onChange={(e) =>
                        updatePolicy({
                          policyYearStart: {
                            ...draft.employerPolicy.policyYearStart,
                            month: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {MONTHS.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="policy-day" className="form-label">Day</label>
                    <select
                      id="policy-day"
                      value={draft.employerPolicy.policyYearStart.day}
                      onChange={(e) =>
                        updatePolicy({
                          policyYearStart: {
                            ...draft.employerPolicy.policyYearStart,
                            day: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <span className="form-hint">Usually January 1. Some employers use hire date or fiscal year.</span>
              </fieldset>
            </div>
          )}

          {/* --- STEP 2: PTO Banks (annual grants + starting balances) --- */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {draft.employerPolicy.banks.map((bank) => {
                const bankId = bank.id
                return (
                  <fieldset key={bankId} style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '1rem' }}>
                    <legend
                      style={{ padding: '0 0.4rem', fontWeight: 700, color: 'var(--slate-300)', fontSize: '0.85rem' }}
                    >
                      <span className={`bank-tag bank-${bankId}`}>{bank.label}</span>
                    </legend>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <div className="form-group">
                        <label htmlFor={`${bankId}-grant`} className="form-label">Annual Grant (days)</label>
                        <input
                          id={`${bankId}-grant`}
                          type="number"
                          min={0}
                          step={1}
                          value={bank.annualGrant}
                          onChange={(e) => updateBank(bankId, { annualGrant: Math.max(0, Math.round(Number(e.target.value))) })}
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`${bankId}-balance`} className="form-label">Starting Balance (days)</label>
                        <input
                          id={`${bankId}-balance`}
                          type="number"
                          min={0}
                          step={1}
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
                    </div>
                  </fieldset>
                )
              })}
            </div>
          )}

          {/* --- STEP 3: Rollover & caps --- */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {draft.employerPolicy.banks.map((bank) => {
                const bankId = bank.id
                const hasCarryoverCap = bank.carryoverCap !== null && bank.carryoverCap !== undefined
                return (
                  <fieldset key={bankId} style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '1rem' }}>
                    <legend style={{ padding: '0 0.4rem', fontWeight: 700, color: 'var(--slate-300)', fontSize: '0.85rem' }}>
                      <span className={`bank-tag bank-${bankId}`}>{bank.label}</span>
                    </legend>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <label className="checkbox-group">
                        <input
                          type="checkbox"
                          id={`${bankId}-cap-check`}
                          checked={hasCarryoverCap}
                          onChange={(e) =>
                            updateBank(bankId, { carryoverCap: e.target.checked ? 10 : null })
                          }
                        />
                        <span>Has carryover cap (limited rollover)</span>
                      </label>

                      {hasCarryoverCap && (
                        <div className="form-group">
                          <label htmlFor={`${bankId}-cap`} className="form-label">Carryover Cap (days)</label>
                          <input
                            id={`${bankId}-cap`}
                            type="number"
                            min={0}
                            step={1}
                            value={bank.carryoverCap ?? 0}
                            onChange={(e) =>
                              updateBank(bankId, { carryoverCap: Math.max(0, Math.round(Number(e.target.value))) })
                            }
                          />
                        </div>
                      )}

                      <label className="checkbox-group">
                        <input
                          type="checkbox"
                          id={`${bankId}-expires`}
                          checked={bank.expiresAtYearEnd ?? false}
                          onChange={(e) => updateBank(bankId, { expiresAtYearEnd: e.target.checked })}
                        />
                        <span>Expires at year end (use-it-or-lose-it)</span>
                      </label>

                      <label className="checkbox-group">
                        <input
                          type="checkbox"
                          id={`${bankId}-negative`}
                          checked={bank.allowNegative ?? false}
                          onChange={(e) => updateBank(bankId, { allowNegative: e.target.checked })}
                        />
                        <span>Allow negative balance</span>
                      </label>

                      {(bank.allowNegative ?? false) && (
                        <div className="form-group">
                          <label htmlFor={`${bankId}-min`} className="form-label">Minimum Balance (days, e.g. -5)</label>
                          <input
                            id={`${bankId}-min`}
                            type="number"
                            step={1}
                            value={bank.minimumBalance ?? 0}
                            onChange={(e) =>
                              updateBank(bankId, { minimumBalance: Math.round(Number(e.target.value)) })
                            }
                          />
                        </div>
                      )}
                    </div>
                  </fieldset>
                )
              })}
            </div>
          )}

          {/* --- STEP 4: Work calendar --- */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <fieldset style={{ border: 'none', padding: 0 }}>
                <legend className="form-label" style={{ marginBottom: '0.625rem' }}>Weekend Days</legend>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {DAY_NAMES.map((name, i) => {
                    const isWeekend = draft.employerPolicy.weekendDays.includes(i)
                    return (
                      <label
                        key={i}
                        className="checkbox-group"
                        style={{
                          padding: '0.375rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: isWeekend ? 'var(--indigo-500)' : 'var(--glass-border)',
                          background: isWeekend ? 'rgba(99,102,241,0.15)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isWeekend}
                          onChange={() => toggleWeekend(i)}
                          aria-label={`${name} is a weekend day`}
                          style={{ display: 'none' }}
                        />
                        <span style={{ color: isWeekend ? 'var(--indigo-300)' : 'var(--slate-400)', fontWeight: 600, fontSize: '0.85rem' }}>
                          {name}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <p className="form-hint">Days when no PTO is consumed. Default: Saturday + Sunday.</p>
              </fieldset>

              <label className="checkbox-group">
                <input
                  type="checkbox"
                  id="fed-holidays"
                  checked={draft.employerPolicy.useUSFederalHolidays}
                  onChange={(e) => updatePolicy({ useUSFederalHolidays: e.target.checked })}
                />
                <span>
                  <strong>Enable US Federal Holidays</strong>
                  <br />
                  <small style={{ color: 'var(--slate-400)', fontWeight: 400 }}>
                    Includes observed dates (e.g. Monday when holiday falls on Sunday).
                    Uncheck if not applicable to your location.
                  </small>
                </span>
              </label>
            </div>
          )}

          {/* --- STEP 5: Jewish calendar --- */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Observance Location</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
                  {(['diaspora', 'israel'] as const).map((loc) => {
                    const active = draft.jewishCalendar.location === loc
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => updateCalendar({ location: loc })}
                        aria-pressed={active}
                        style={{
                          padding: '1rem',
                          borderRadius: '10px',
                          border: '2px solid',
                          borderColor: active ? 'var(--indigo-500)' : 'var(--glass-border)',
                          background: active ? 'rgba(99,102,241,0.15)' : 'var(--navy-900)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>
                          {loc === 'diaspora' ? '🌍' : '🇮🇱'}
                        </div>
                        <div style={{ fontWeight: 700, color: active ? 'var(--indigo-300)' : 'var(--slate-300)', fontSize: '0.95rem' }}>
                          {loc === 'diaspora' ? 'Diaspora' : 'Israel'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>
                          {loc === 'diaspora'
                            ? 'Adds second festival days (Yom Tov Sheni)'
                            : 'Single-day festivals, Israel calendar'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="timezone" className="form-label">Timezone</label>
                <select
                  id="timezone"
                  value={draft.jewishCalendar.timezone}
                  onChange={(e) => updateCalendar({ timezone: e.target.value })}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                  ))}
                </select>
                <span className="form-hint">Used for Hebrew calendar context and holiday display.</span>
              </div>

              <label className="checkbox-group">
                <input
                  type="checkbox"
                  id="modern-holidays"
                  checked={draft.jewishCalendar.includeModernHolidays}
                  onChange={(e) => updateCalendar({ includeModernHolidays: e.target.checked })}
                />
                <span>
                  Include modern Israeli holidays
                  <br />
                  <small style={{ color: 'var(--slate-400)', fontWeight: 400 }}>
                    Yom HaShoah, Yom HaZikaron, Yom HaAtzmaut, Yom Yerushalayim, etc.
                  </small>
                </span>
              </label>
            </div>
          )}

          {/* --- STEP 6: Review --- */}
          {step === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card card-sm" style={{ background: 'var(--navy-900)' }}>
                <p style={{ fontWeight: 700, color: 'var(--slate-300)', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                  Your Configuration Summary
                </p>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                  <li style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-400)' }}>
                    <span>Starting template</span>
                    <strong style={{ color: 'var(--slate-200)' }}>{selectedTemplate.name}</strong>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-400)' }}>
                    <span>Planning horizon</span>
                    <strong style={{ color: 'var(--slate-200)' }}>{draft.horizonYears} years</strong>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-400)' }}>
                    <span>Policy year start</span>
                    <strong style={{ color: 'var(--slate-200)' }}>
                      {MONTHS[draft.employerPolicy.policyYearStart.month - 1]} {draft.employerPolicy.policyYearStart.day}
                    </strong>
                  </li>
                  {draft.employerPolicy.banks.map((bank) => (
                    <li key={bank.id} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-400)' }}>
                      <span>{bank.label}</span>
                      <strong style={{ color: 'var(--slate-200)' }}>
                        {bank.accrualCadence === 'monthly'
                          ? `${bank.accrualAmount ?? 0} day/mo accrual`
                          : `${bank.annualGrant} days/yr`}
                      </strong>
                    </li>
                  ))}
                  <li style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-400)' }}>
                    <span>Location</span>
                    <strong style={{ color: 'var(--slate-200)', textTransform: 'capitalize' }}>
                      {draft.jewishCalendar.location}
                    </strong>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--slate-400)' }}>
                    <span>Observance profile</span>
                    <strong style={{ color: 'var(--slate-200)' }}>
                      {draft.holidayRules.filter((r) => r.observance === 'required').length} required,{' '}
                      {draft.holidayRules.filter((r) => r.observance === 'optional').length} optional
                    </strong>
                  </li>
                </ul>
              </div>
              <p style={{ fontSize: '0.85rem' }}>
                You can edit any of these settings later from the <strong style={{ color: 'var(--slate-300)' }}>Policy</strong> and <strong style={{ color: 'var(--slate-300)' }}>Holiday Rules</strong> tabs.
              </p>
              <Disclaimer />
            </div>
          )}

          {/* Navigation buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setStep((s) => s - 1)}
              disabled={isFirst}
              aria-label="Previous step"
            >
              <ChevronLeft size={16} /> Back
            </button>

            {isLast ? (
              <button
                className="btn btn-primary btn-lg"
                onClick={handleFinish}
                id="onboarding-generate"
              >
                <Sparkles size={16} /> Generate My Plan
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={() => setStep((s) => s + 1)}
                id={`onboarding-next-${step}`}
              >
                {step === 0 ? 'Next: Customize' : 'Next'} <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {step === 6 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', color: 'var(--emerald-400)', fontSize: '0.85rem' }}>
          <CheckCircle size={16} />
          <span>Your settings are saved locally — no account required.</span>
        </div>
      )}
    </div>
  )
}
