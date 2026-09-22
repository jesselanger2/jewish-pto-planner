/**
 * src/features/holidays/HolidayRulesView.tsx
 *
 * Searchable list of holidays with per-holiday observance levels.
 * Diaspora/Israel switcher is prominent at the top — it affects displayed days.
 * Changes are saved + plan regenerated on submit.
 */
import { useState, useMemo } from 'react'
import { Search, Save, Globe } from 'lucide-react'
import type { ObservanceLevel, HolidayRule } from '../../domain/models'
import { useAppState, useAppActions } from '../../lib/AppContext'
import { getHolidayOccurrences } from '../../domain/holidays/hebcalAdapter'
import { Badge } from '../../components/Badge'
import { AlertBanner } from '../../components/AlertBanner'
import { toIsoDate, parseIsoDate } from '../../domain/dates/isoDate'

const OBSERVANCE_OPTIONS: ObservanceLevel[] = ['required', 'optional', 'ignore']

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Group holidays by canonical category for display
const CATEGORY_LABELS: Record<string, string> = {
  'major': 'Major Festivals',
  'major-fast': 'Major Fasts',
  'minor-fast': 'Minor Fasts',
  'modern': 'Modern Israeli Holidays',
}

export function HolidayRulesView() {
  const { settings } = useAppState()
  const { applySettingsAndGenerate } = useAppActions()

  const [search, setSearch] = useState('')
  const [saved, setSaved] = useState(false)
  const [rules, setRules] = useState<HolidayRule[]>(settings?.holidayRules ?? [])
  const [location, setLocation] = useState(settings?.jewishCalendar.location ?? 'diaspora')
  const [includeModern, setIncludeModern] = useState(settings?.jewishCalendar.includeModernHolidays ?? false)

  // Generate a sample of holiday occurrences to display names and dates
  const holidays = useMemo(() => {
    if (!settings) return []
    const { year } = parseIsoDate(settings.horizonStart)
    const start = toIsoDate(year, 1, 1)
    const end = toIsoDate(year + 1, 12, 31)
    return getHolidayOccurrences(start, end, { location, timezone: settings.jewishCalendar.timezone, includeModernHolidays: includeModern })
  }, [settings, location, includeModern])

  // Build a display list: one entry per unique holidayId, with a representative date
  const holidayIndex = useMemo(() => {
    const map = new Map<string, { displayName: string; hebrewName: string; date: string; category: string }>()
    for (const h of holidays) {
      if (!map.has(h.holidayId)) {
        map.set(h.holidayId, {
          displayName: h.displayName,
          hebrewName: h.hebrewName,
          date: h.date,
          category: h.hebcalCategory,
        })
      }
    }
    return map
  }, [holidays])

  // Combine rules with display info
  const displayRules = useMemo(() => {
    return rules
      .map((rule) => ({
        rule,
        info: holidayIndex.get(rule.holidayId),
      }))
      .filter(({ info, rule }) => {
        if (!info && !includeModern) return false
        const query = search.toLowerCase()
        if (!query) return !!info
        const name = info?.displayName ?? rule.holidayId
        return name.toLowerCase().includes(query) || info?.hebrewName.toLowerCase().includes(query)
      })
  }, [rules, holidayIndex, search, includeModern])

  // Group by category
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof displayRules>()
    for (const entry of displayRules) {
      const cat = entry.info?.category ?? 'other'
      const list = groups.get(cat) ?? []
      list.push(entry)
      groups.set(cat, list)
    }
    return groups
  }, [displayRules])

  function updateRule(holidayId: string, observance: ObservanceLevel) {
    setRules((rs) =>
      rs.map((r) => (r.holidayId === holidayId ? { ...r, observance } : r))
    )
    setSaved(false)
  }

  function handleSave() {
    if (!settings) return
    const updated = {
      ...settings,
      holidayRules: rules,
      jewishCalendar: { ...settings.jewishCalendar, location, includeModernHolidays: includeModern },
    }
    applySettingsAndGenerate(updated)
    setSaved(true)
  }

  if (!settings) return null

  const requiredCount = rules.filter((r) => r.observance === 'required').length
  const optionalCount = rules.filter((r) => r.observance === 'optional').length

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Holiday Rules</h1>
          <p style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
            {requiredCount} required · {optionalCount} optional
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} id="holiday-rules-save">
          <Save size={14} /> Save &amp; Regenerate
        </button>
      </div>

      {saved && <AlertBanner variant="success" dismissible>Holiday rules saved and plan regenerated.</AlertBanner>}

      {/* Location + modern toggle */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center' }}>
        <div>
          <p className="form-label" style={{ marginBottom: '0.5rem' }}>
            <Globe size={13} style={{ display: 'inline', marginRight: '0.3rem' }} aria-hidden="true" />
            Observance Location
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['diaspora', 'israel'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                className={`btn ${location === loc ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setLocation(loc); setSaved(false) }}
                aria-pressed={location === loc}
                id={`location-${loc}`}
              >
                {loc === 'diaspora' ? '🌍 Diaspora' : '🇮🇱 Israel'}
              </button>
            ))}
          </div>
          <p className="form-hint" style={{ marginTop: '0.375rem' }}>
            {location === 'diaspora'
              ? 'Includes Yom Tov Sheni (second festival days)'
              : 'Single-day festivals, Israel calendar'}
          </p>
        </div>

        <div className="divider" style={{ width: '1px', height: '60px', margin: 0, background: 'var(--glass-border)' }} />

        <label className="checkbox-group">
          <input
            type="checkbox"
            id="include-modern"
            checked={includeModern}
            onChange={(e) => { setIncludeModern(e.target.checked); setSaved(false) }}
          />
          <span>
            Include modern Israeli holidays<br />
            <small style={{ color: 'var(--slate-400)', fontWeight: 400 }}>
              Yom HaShoah, Yom HaAtzmaut, Yom Yerushalayim, etc.
            </small>
          </span>
        </label>
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          aria-hidden="true"
          style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', pointerEvents: 'none' }}
        />
        <input
          type="search"
          placeholder="Search holidays…"
          id="holiday-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '2.25rem' }}
          aria-label="Search holidays"
        />
      </div>

      {/* Holiday groups */}
      {Array.from(grouped.entries()).map(([cat, entries]) => (
        <section key={cat} aria-labelledby={`cat-${cat}-heading`}>
          <h2
            id={`cat-${cat}-heading`}
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--slate-400)',
              marginBottom: '0.625rem',
            }}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </h2>
          <div className="card" style={{ padding: 0 }}>
            {entries.map(({ rule, info }, i) => (
              <div
                key={rule.holidayId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.875rem 1.25rem',
                  borderBottom: i < entries.length - 1 ? '1px solid var(--glass-border)' : 'none',
                }}
              >
                <div>
                  <p style={{ fontWeight: 600, color: 'var(--slate-200)', fontSize: '0.9rem' }}>
                    {info?.displayName ?? rule.holidayId}
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                    {info?.hebrewName && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                        {info.hebrewName}
                      </span>
                    )}
                    {info?.date && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--slate-400)' }}>
                        {formatDate(info.date)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  {OBSERVANCE_OPTIONS.map((obs) => (
                    <label key={obs} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name={`obs-${rule.holidayId}`}
                        value={obs}
                        checked={rule.observance === obs}
                        onChange={() => updateRule(rule.holidayId, obs)}
                        aria-label={`${obs} for ${info?.displayName ?? rule.holidayId}`}
                        style={{ display: 'none' }}
                      />
                      <Badge
                        variant={obs}
                      >
                        {obs}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {displayRules.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p>No holidays match your search.</p>
        </div>
      )}

      <div style={{ position: 'sticky', bottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-lg" onClick={handleSave} id="holiday-rules-save-bottom">
          <Save size={16} /> Save &amp; Regenerate
        </button>
      </div>
    </div>
  )
}
