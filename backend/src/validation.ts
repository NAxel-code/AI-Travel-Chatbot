import type { BuildItineraryInput, ItineraryItemInput, UpdateItineraryDayInput } from './types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

export class ValidationError extends Error {}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${label} harus berupa objek.`)
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new ValidationError(`${label} wajib diisi.`)
  const result = value.trim()
  if (result.length > maxLength) throw new ValidationError(`${label} maksimal ${maxLength} karakter.`)
  return result
}

function optionalString(value: unknown, label: string, maxLength: number): string | null {
  if (value == null || value === '') return null
  return requiredString(value, label, maxLength)
}

function parseIsoDate(value: unknown, label: string): string {
  const date = requiredString(value, label, 10)
  if (!DATE_PATTERN.test(date)) throw new ValidationError(`${label} harus berformat YYYY-MM-DD.`)
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ValidationError(`${label} tidak valid.`)
  }
  return date
}

function dateInYear(monthDay: string, year: number): string | null {
  const candidate = `${year}-${monthDay}`
  const parsed = new Date(`${candidate}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate ? candidate : null
}

function adjustRangeToFuture(startDate: string, endDate: string, now: Date) {
  const duration = Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_MS) + 1
  if (duration < 1 || duration > 31) throw new ValidationError('Rentang itinerary harus 1-31 hari.')
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10)
  if (startDate >= today) return { startDate, endDate, duration, dateAdjusted: false }

  const monthDay = startDate.slice(5)
  let year = now.getUTCFullYear()
  let adjustedStart = dateInYear(monthDay, year)
  while (!adjustedStart || adjustedStart < today) {
    year += 1
    adjustedStart = dateInYear(monthDay, year)
  }
  const adjustedEnd = new Date(Date.parse(`${adjustedStart}T00:00:00Z`) + (duration - 1) * DAY_MS)
    .toISOString().slice(0, 10)
  return { startDate: adjustedStart, endDate: adjustedEnd, duration, dateAdjusted: true }
}

function optionalCoordinate(value: unknown, label: string, min: number, max: number): number | null {
  if (value == null || value === '') return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new ValidationError(`${label} tidak valid.`)
  }
  return value
}

function optionalHttpsUrl(value: unknown): string | null {
  if (value == null || value === '') return null
  const url = requiredString(value, 'source_url', 500)
  try {
    if (new URL(url).protocol !== 'https:') throw new Error()
  } catch {
    throw new ValidationError('source_url harus berupa URL HTTPS yang valid.')
  }
  return url
}

function parseItem(value: unknown, forcedDay?: number): ItineraryItemInput {
  const item = asRecord(value, 'Item itinerary')
  const dayNumber = forcedDay ?? item.day_number
  if (!Number.isInteger(dayNumber) || Number(dayNumber) < 1 || Number(dayNumber) > 31) {
    throw new ValidationError('day_number harus berupa bilangan 1-31.')
  }
  return {
    day_number: Number(dayNumber),
    time_slot: requiredString(item.time_slot, 'time_slot', 40),
    title: requiredString(item.title, 'title', 160),
    description: optionalString(item.description, 'description', 1000),
    category: optionalString(item.category, 'category', 60),
    location_name: optionalString(item.location_name, 'location_name', 160),
    address: optionalString(item.address, 'address', 300),
    latitude: optionalCoordinate(item.latitude, 'latitude', -90, 90),
    longitude: optionalCoordinate(item.longitude, 'longitude', -180, 180),
    source_url: optionalHttpsUrl(item.source_url),
  }
}

export function validateSessionId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new ValidationError('session_id tidak valid.')
  return value
}

export function parseChatRequest(value: unknown): { sessionId: string; message: string } {
  const body = asRecord(value, 'Request')
  return {
    sessionId: validateSessionId(body.session_id),
    message: requiredString(body.message, 'message', 4000),
  }
}

export function parseBuildItinerary(value: unknown, now = new Date()): BuildItineraryInput {
  const args = asRecord(value, 'Argumen build_itinerary')
  const destination = requiredString(args.destination, 'destination', 160)
  const originalStartDate = parseIsoDate(args.start_date, 'start_date')
  const originalEndDate = parseIsoDate(args.end_date, 'end_date')
  const adjusted = adjustRangeToFuture(originalStartDate, originalEndDate, now)
  if (!Array.isArray(args.items) || args.items.length < 1 || args.items.length > 80) {
    throw new ValidationError('items harus berisi 1-80 aktivitas.')
  }
  const timezone = requiredString(args.timezone, 'timezone', 64)
  if (timezone !== 'UTC' && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/.test(timezone)) {
    throw new ValidationError('timezone harus berupa zona waktu IANA, misalnya Asia/Jakarta.')
  }
  const items = args.items.map((item) => parseItem(item))
  if (items.some((item) => item.day_number > adjusted.duration)) {
    throw new ValidationError('day_number tidak boleh melebihi durasi perjalanan.')
  }
  return {
    destination,
    start_date: adjusted.startDate,
    end_date: adjusted.endDate,
    timezone,
    items,
    date_adjusted: adjusted.dateAdjusted,
  }
}

export function parseUpdateItineraryDay(value: unknown): UpdateItineraryDayInput {
  const args = asRecord(value, 'Argumen update_itinerary_day')
  if (!Number.isInteger(args.day_number) || Number(args.day_number) < 1 || Number(args.day_number) > 31) {
    throw new ValidationError('day_number harus berupa bilangan 1-31.')
  }
  if (!Array.isArray(args.items) || args.items.length < 1 || args.items.length > 12) {
    throw new ValidationError('items harus berisi 1-12 aktivitas untuk satu hari.')
  }
  const dayNumber = Number(args.day_number)
  return { day_number: dayNumber, items: args.items.map((item) => parseItem(item, dayNumber)) }
}

export function parsePreference(value: unknown): { category: string; value: string } {
  const args = asRecord(value, 'Argumen save_user_preference')
  const category = requiredString(args.category, 'category', 60).toLowerCase().replace(/\s+/g, '_')
  if (!/^[a-z0-9_-]+$/.test(category)) throw new ValidationError('category hanya boleh berisi huruf, angka, _ atau -.')
  return { category, value: requiredString(args.value, 'value', 300) }
}

export function parsePlaceSearch(value: unknown): { query: string; destination: string; limit: number } {
  const args = asRecord(value, 'Argumen search_places')
  const limit = args.limit == null ? 5 : Number(args.limit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new ValidationError('limit harus 1-5.')
  return {
    query: requiredString(args.query, 'query', 120),
    destination: requiredString(args.destination, 'destination', 160),
    limit,
  }
}

export function parseWeatherSearch(value: unknown, now = new Date()) {
  const args = asRecord(value, 'Argumen check_weather')
  const originalStartDate = parseIsoDate(args.start_date, 'start_date')
  const originalEndDate = parseIsoDate(args.end_date, 'end_date')
  const adjusted = adjustRangeToFuture(originalStartDate, originalEndDate, now)
  return {
    destination: requiredString(args.destination, 'destination', 160),
    startDate: adjusted.startDate,
    endDate: adjusted.endDate,
    dateAdjusted: adjusted.dateAdjusted,
  }
}
