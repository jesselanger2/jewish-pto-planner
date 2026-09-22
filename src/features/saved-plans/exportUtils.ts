/**
 * src/features/saved-plans/exportUtils.ts
 *
 * Pure functions for exporting a PlanSnapshot to CSV or ICS.
 * No React, no side effects — just string construction.
 */
import type { PlanSnapshot, TimeOffBooking } from '../../domain/models'

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function formatDateFriendly(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

/**
 * Exports all bookings in a PlanSnapshot as a CSV string.
 * Columns: Date, Day, Bank, Reason, Holiday, Locked, Note
 */
export function exportToCSV(plan: PlanSnapshot): string {
  const header = ['Date', 'Day', 'Bank', 'Reason', 'Holiday', 'Locked', 'Note']
  const expMap = new Map(plan.explanations.map((e) => [e.bookingId, e.humanReadable]))
  const annMap = new Map(plan.annotations.map((a) => [a.date, a.labels.join('; ')]))

  const rows = plan.bookings.map((b: TimeOffBooking) => {
    const holiday = annMap.get(b.date) ?? b.holidayId ?? ''
    const note = b.note ?? expMap.get(b.id) ?? ''
    return [
      escapeCsv(b.date),
      escapeCsv(formatDateFriendly(b.date)),
      escapeCsv(b.bankId),
      escapeCsv(b.reason),
      escapeCsv(holiday),
      b.locked ? 'Yes' : 'No',
      escapeCsv(note),
    ]
  })

  return [header, ...rows].map((r) => r.join(',')).join('\r\n')
}

// ---------------------------------------------------------------------------
// ICS (iCalendar) export
// ---------------------------------------------------------------------------

function formatIcsDate(iso: string): string {
  // DATE (all-day event): YYYYMMDD
  return iso.replace(/-/g, '')
}

function formatIcsDatetime(dt: string): string {
  // e.g. 2026-09-14T10:00:00.000Z → 20260914T100000Z
  return dt.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('T', 'T')
}

function sanitizeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/**
 * Exports all bookings in a PlanSnapshot as an ICS string.
 * Each booking becomes a VEVENT with the appropriate SUMMARY and DESCRIPTION.
 */
export function exportToICS(plan: PlanSnapshot): string {
  const expMap = new Map(plan.explanations.map((e) => [e.bookingId, e.humanReadable]))
  const annMap = new Map(plan.annotations.map((a) => [a.date, a.labels.join(', ')]))

  const stamp = formatIcsDatetime(plan.createdAt)

  const events = plan.bookings.map((b: TimeOffBooking): string => {
    const holiday = annMap.get(b.date) ?? ''
    const summary = holiday
      ? `${holiday} — ${b.bankId} PTO`
      : `${b.reason.replace(/-/g, ' ')} — ${b.bankId} PTO`
    const description = expMap.get(b.id) ?? b.note ?? ''
    // All-day: DTSTART;VALUE=DATE, DTEND = next day
    const startDate = formatIcsDate(b.date)
    const [y, m, d] = b.date.split('-').map(Number)
    const next = new Date(y, m - 1, d + 1)
    const endDate = `${next.getFullYear()}${String(next.getMonth() + 1).padStart(2, '0')}${String(next.getDate()).padStart(2, '0')}`

    return [
      'BEGIN:VEVENT',
      `UID:jewish-pto-${b.id}@jewish-pto-planner`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${startDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      `SUMMARY:${sanitizeIcsText(summary)}`,
      description ? `DESCRIPTION:${sanitizeIcsText(description)}` : '',
      `CATEGORIES:PTO,${b.bankId.toUpperCase()}`,
      b.locked ? 'STATUS:CONFIRMED' : 'STATUS:TENTATIVE',
      'END:VEVENT',
    ].filter(Boolean).join('\r\n')
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jewish PTO Planner//EN',
    `X-WR-CALNAME:${sanitizeIcsText(plan.name)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

// ---------------------------------------------------------------------------
// Download trigger (browser only, not imported in domain layer)
// ---------------------------------------------------------------------------

export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
