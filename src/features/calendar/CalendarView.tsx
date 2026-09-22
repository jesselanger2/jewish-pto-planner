/**
 * src/features/calendar/CalendarView.tsx
 *
 * Month-grid calendar with navigation. All day types are distinguishable
 * without color alone (icons + labels). Keyboard-navigable.
 *
 * Day type priority (highest wins for styling):
 *  pto-locked > pto-booked > required-holiday > optional-holiday >
 *  modern-holiday > federal-holiday > company-holiday > custom-closure >
 *  weekend > workday
 */
import { useState, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Lock, Star } from 'lucide-react'
import { useAppState } from '../../lib/AppContext'
import { EmptyState } from '../../components/EmptyState'
import { LockDateModal } from './LockDateModal'
import type { DayAnnotation, DayAnnotationType } from '../../domain/models'

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ---------------------------------------------------------------------------
// Day type classification helpers
// ---------------------------------------------------------------------------

function getDayClass(types: DayAnnotationType[]): string {
  if (types.includes('pto-locked')) return 'cal-day-pto-locked cal-day-clickable'
  if (types.includes('pto-booked')) return 'cal-day-pto-booked cal-day-clickable'
  if (types.includes('required-holiday')) return 'cal-day-required-holiday'
  if (types.includes('optional-holiday')) return 'cal-day-required-holiday' // reuse amber-ish but lighter
  if (types.includes('federal-holiday') || types.includes('company-holiday') || types.includes('custom-closure')) {
    return 'cal-day-non-work'
  }
  if (types.includes('weekend')) return 'cal-day-weekend'
  return ''
}

function getDaySymbol(types: DayAnnotationType[]): string | null {
  if (types.includes('pto-locked')) return '🔒'
  if (types.includes('pto-booked')) return '📅'
  if (types.includes('required-holiday')) return '✡'
  if (types.includes('optional-holiday')) return '✦'
  if (types.includes('federal-holiday')) return '🇺🇸'
  if (types.includes('company-holiday')) return '🏢'
  if (types.includes('custom-closure')) return '📌'
  return null
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function CalendarLegend() {
  const items = [
    { symbol: '🔒', label: 'Locked PTO', cls: 'cal-day-pto-locked' },
    { symbol: '📅', label: 'PTO Booked', cls: 'cal-day-pto-booked' },
    { symbol: '✡', label: 'Required Holiday', cls: 'cal-day-required-holiday' },
    { symbol: '✦', label: 'Optional Holiday', cls: '' },
    { symbol: '🇺🇸', label: 'Federal Holiday', cls: 'cal-day-non-work' },
    { symbol: '🏢', label: 'Company Holiday', cls: 'cal-day-non-work' },
    { symbol: '', label: 'Weekend', cls: 'cal-day-weekend' },
  ]
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}
      aria-label="Calendar legend"
    >
      {items.map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--slate-400)' }}>
          <span
            className={item.cls}
            style={{ width: '14px', height: '14px', borderRadius: '3px', display: 'inline-block', border: '1px solid var(--glass-border)', flexShrink: 0 }}
            aria-hidden="true"
          />
          {item.symbol && <span aria-hidden="true">{item.symbol}</span>}
          {item.label}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CalendarView
// ---------------------------------------------------------------------------

export function CalendarView() {
  const { plan, settings } = useAppState()
  const today = new Date()
  const [displayYear, setDisplayYear] = useState(today.getFullYear())
  const [displayMonth, setDisplayMonth] = useState(today.getMonth()) // 0-indexed
  const [modalDate, setModalDate] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Keyboard navigation inside the grid — must be defined before any early return
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const focused = document.activeElement as HTMLElement
    if (!gridRef.current?.contains(focused)) return
    const dayButtons = Array.from(gridRef.current.querySelectorAll<HTMLButtonElement>('[data-day]'))
    const idx = dayButtons.indexOf(focused as HTMLButtonElement)
    if (idx === -1) return

    let next = idx
    if (e.key === 'ArrowRight') next = idx + 1
    else if (e.key === 'ArrowLeft') next = idx - 1
    else if (e.key === 'ArrowDown') next = idx + 7
    else if (e.key === 'ArrowUp') next = idx - 7
    else return

    e.preventDefault()
    if (next >= 0 && next < dayButtons.length) {
      dayButtons[next].focus()
    }
  }, [])

  if (!plan || !settings) {
    return (
      <div className="page-container">
        <EmptyState
          icon={<Star size={28} />}
          heading="No plan yet"
          description="Generate a plan from the Dashboard to view the calendar."
        />
      </div>
    )
  }

  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Build annotation index by date
  const annotationMap = new Map<string, DayAnnotation>()
  for (const a of plan.annotations) {
    annotationMap.set(a.date, a)
  }

  const bookingMap = new Map<string, typeof plan.bookings[number]>()
  for (const b of plan.bookings) {
    bookingMap.set(b.date, b)
  }

  const explanationMap = new Map<string, typeof plan.explanations[number]>()
  for (const e of plan.explanations) {
    explanationMap.set(e.bookingId, e)
  }

  const lockedDates = new Set(settings.lockedTimeOff.map((lt) => lt.date))

  // Month grid computation
  const firstOfMonth = new Date(displayYear, displayMonth, 1)
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate()
  const startDow = firstOfMonth.getDay() // 0 = Sun

  // Cells: leading empties + day cells
  const cells: Array<{ day: number | null }> = [
    ...Array.from({ length: startDow }, () => ({ day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1 })),
  ]
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push({ day: null })

  function isoForDay(day: number): string {
    return `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function prevMonth() {
    if (displayMonth === 0) { setDisplayYear((y) => y - 1); setDisplayMonth(11) }
    else setDisplayMonth((m) => m - 1)
  }

  function nextMonth() {
    if (displayMonth === 11) { setDisplayYear((y) => y + 1); setDisplayMonth(0) }
    else setDisplayMonth((m) => m + 1)
  }

  const modalAnnotation = modalDate ? annotationMap.get(modalDate) : undefined
  const modalBooking = modalDate ? bookingMap.get(modalDate) : undefined
  const modalExplanation = modalBooking ? explanationMap.get(modalBooking.id) : undefined
  const modalIsLocked = modalDate ? lockedDates.has(modalDate) : false

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h1>Calendar</h1>

      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={prevMonth}
            aria-label="Previous month"
            id="cal-prev-month"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 style={{ fontSize: '1.2rem', minWidth: '180px', textAlign: 'center' }}>
            {MONTH_NAMES[displayMonth]} {displayYear}
          </h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={nextMonth}
            aria-label="Next month"
            id="cal-next-month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setDisplayYear(today.getFullYear()); setDisplayMonth(today.getMonth()) }}
          id="cal-today"
        >
          Today
        </button>
      </div>

      <CalendarLegend />

      {/* Day headers */}
      <div role="grid" aria-label={`${MONTH_NAMES[displayMonth]} ${displayYear} calendar`}>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '2px' }}
          role="row"
        >
          {DAY_HEADERS.map((name) => (
            <div
              key={name}
              role="columnheader"
              aria-label={name}
              style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, color: 'var(--slate-400)', padding: '0.375rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Grid cells */}
        <div
          ref={gridRef}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}
          onKeyDown={handleGridKeyDown}
        >
          {cells.map((cell, idx) => {
            if (cell.day === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  role="gridcell"
                  aria-hidden="true"
                  style={{ minHeight: '72px', borderRadius: '6px', background: 'rgba(99,102,241,0.03)' }}
                />
              )
            }

            const iso = isoForDay(cell.day)
            const annotation = annotationMap.get(iso)
            const types = annotation?.types ?? ['workday']
            const labels = annotation?.labels ?? []
            const isClickable = types.includes('pto-booked') || types.includes('pto-locked')
            const isToday = iso === todayIso
            const symbol = getDaySymbol(types)
            const dayClass = getDayClass(types)

            const cellContent = (
              <>
                <div
                  className={`cal-day-number ${isToday ? 'cal-day-today' : ''}`}
                  style={{ marginBottom: '0.25rem' }}
                >
                  {cell.day}
                  {isToday && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: '5px', height: '5px',
                        borderRadius: '50%',
                        background: 'var(--indigo-400)',
                        marginLeft: '3px',
                        verticalAlign: 'middle',
                      }}
                      aria-hidden="true"
                    />
                  )}
                </div>
                {symbol && (
                  <div style={{ fontSize: '0.7rem', lineHeight: 1.2 }} aria-hidden="true">{symbol}</div>
                )}
                {labels.slice(0, 2).map((lbl, i) => (
                  <div
                    key={i}
                    style={{ fontSize: '0.6rem', lineHeight: 1.2, color: 'var(--amber-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
                  >
                    {lbl}
                  </div>
                ))}
                {types.includes('pto-locked') && (
                  <div style={{ marginTop: 'auto' }}>
                    <Lock size={9} color="var(--violet-400)" aria-hidden="true" />
                  </div>
                )}
              </>
            )

            const ariaLabel = [
              `${MONTH_NAMES[displayMonth]} ${cell.day}`,
              isToday ? '(today)' : '',
              ...types.map((t) => t.replace(/-/g, ' ')),
              ...labels,
            ].filter(Boolean).join(', ')

            if (isClickable) {
              return (
                <button
                  key={iso}
                  role="gridcell"
                  data-day={cell.day}
                  className={`cal-day ${dayClass}`}
                  onClick={() => setModalDate(iso)}
                  aria-label={ariaLabel}
                  aria-pressed={modalDate === iso}
                  style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', width: '100%', fontFamily: 'var(--font-sans)' }}
                >
                  {cellContent}
                </button>
              )
            }

            return (
              <div
                key={iso}
                role="gridcell"
                data-day={cell.day}
                tabIndex={0}
                className={`cal-day ${dayClass}`}
                aria-label={ariaLabel}
              >
                {cellContent}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lock modal */}
      {modalDate && modalAnnotation && (
        <LockDateModal
          date={modalDate}
          annotation={modalAnnotation}
          booking={modalBooking}
          explanation={modalExplanation}
          isLocked={modalIsLocked}
          onClose={() => setModalDate(null)}
        />
      )}
    </div>
  )
}
