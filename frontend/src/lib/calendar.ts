type CalendarItem = {
  id?: string
  day_number: number
  time_slot: string
  title: string
  description?: string | null
  address?: string | null
  source_url?: string | null
}

type CalendarItinerary = {
  id: string
  start_date: string
  timezone: string
  items: CalendarItem[]
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function parseTime(value: string): { hours: number; minutes: number } {
  const exact = value.match(/(?:^|\D)([01]?\d|2[0-3])[:.]([0-5]\d)(?:\D|$)/)
  if (exact) return { hours: Number(exact[1]), minutes: Number(exact[2]) }
  const normalized = value.toLowerCase()
  if (normalized.includes('siang')) return { hours: 12, minutes: 0 }
  if (normalized.includes('sore')) return { hours: 16, minutes: 0 }
  if (normalized.includes('malam')) return { hours: 19, minutes: 0 }
  return { hours: 9, minutes: 0 }
}

function formatLocalDateTime(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hours = String(date.getUTCHours()).padStart(2, '0')
  const minutes = String(date.getUTCMinutes()).padStart(2, '0')
  return `${year}${month}${day}T${hours}${minutes}00`
}

export function createIcs(itinerary: CalendarItinerary): string {
  const [year, month, day] = itinerary.start_date.split('-').map(Number)
  if (!year || !month || !day) throw new Error('Tanggal mulai itinerary tidak valid.')
  if (!itinerary.timezone) throw new Error('Zona waktu itinerary tidak tersedia.')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const timezone = escapeIcs(itinerary.timezone)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'PRODID:-//AI Travel Planner//ID',
    `X-WR-TIMEZONE:${timezone}`,
  ]

  itinerary.items.forEach((item, index) => {
    const time = parseTime(item.time_slot)
    const startsAt = new Date(Date.UTC(year, month - 1, day + item.day_number - 1, time.hours, time.minutes))
    const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000)
    const description = [item.description, item.source_url].filter(Boolean).join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(`${itinerary.id}-${item.id || index}@ai-travel-planner`)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${timezone}:${formatLocalDateTime(startsAt)}`,
      `DTEND;TZID=${timezone}:${formatLocalDateTime(endsAt)}`,
      `SUMMARY:${escapeIcs(item.title)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `LOCATION:${escapeIcs(item.address || '')}`,
      'END:VEVENT',
    )
  })

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}
