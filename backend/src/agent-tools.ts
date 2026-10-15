import type { Bindings, ItineraryItemInput } from './types'
import { savePreference } from './session'
import type { GroundedPlace } from './travel-data'
import {
  parseBuildItinerary,
  parsePlaceSearch,
  parsePreference,
  parseUpdateItineraryDay,
  parseWeatherSearch,
  ValidationError,
} from './validation'
import { checkWeather, searchPlaces } from './travel-data'

type ToolResult = {
  response: Record<string, unknown>
  notification?: string
  itineraryChanged?: boolean
}

export type AgentToolState = {
  groundedPlaces: Map<string, GroundedPlace>
  placeSearches: number
  weatherChecked: boolean
  isCancelled: () => boolean
}

function assertActive(state: AgentToolState) {
  if (state.isCancelled()) throw new DOMException('Request cancelled', 'AbortError')
}

function itemInsertStatement(db: D1Database, itineraryId: string, item: ItineraryItemInput): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO itinerary_items (
      id, itinerary_id, day_number, time_slot, title, description, category,
      location_name, address, latitude, longitude, source_url, rating, user_ratings_total, source_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(), itineraryId, item.day_number, item.time_slot, item.title,
    item.description, item.category, item.location_name, item.address,
    item.latitude, item.longitude, item.source_url,
    item.rating ?? null, item.user_ratings_total ?? null, item.source_name || 'Google Maps',
  )
}

function applyGroundedProvenance(items: ItineraryItemInput[], state: AgentToolState): ItineraryItemInput[] {
  const usedUrls = new Set<string>()
  return items.map((item) => {
    const hasGrounding = Boolean(item.source_url || item.latitude != null || item.longitude != null || item.address)
    if (!hasGrounding) return item
    if (!item.source_url) throw new ValidationError(`Lokasi “${item.title}” tidak memiliki source_url hasil search_places.`)
    const grounded = state.groundedPlaces.get(item.source_url)
    if (!grounded) throw new ValidationError(`Sumber lokasi “${item.title}” belum diverifikasi dalam percakapan ini.`)
    if (usedUrls.has(item.source_url)) {
      return {
        ...item,
        latitude: null,
        longitude: null,
        source_url: null,
      }
    }
    usedUrls.add(item.source_url)
    return {
      ...item,
      location_name: item.location_name || grounded.name,
      address: grounded.address,
      latitude: grounded.latitude,
      longitude: grounded.longitude,
      source_url: grounded.source_url,
      rating: item.rating ?? grounded.rating ?? null,
      user_ratings_total: item.user_ratings_total ?? grounded.user_ratings_total ?? null,
      source_name: item.source_name || grounded.source_name || 'Google Maps',
    }
  })
}

export async function executeAgentTool(
  env: Bindings,
  sessionId: string,
  name: string,
  rawArgs: unknown,
  state: AgentToolState,
): Promise<ToolResult> {
  try {
    assertActive(state)
    if (name === 'save_user_preference') {
      const args = parsePreference(rawArgs)
      assertActive(state)
      await savePreference(env.DB, sessionId, args.category, args.value)
      return {
        response: { status: 'success', message: 'Preference saved' },
        notification: `Preferensi disimpan: ${args.category.replaceAll('_', ' ')} = ${args.value}`,
      }
    }

    if (name === 'build_itinerary') {
      const args = parseBuildItinerary(rawArgs)
      const items = applyGroundedProvenance(args.items, state)
      const itineraryId = crypto.randomUUID()
      const statements = [
        env.DB.prepare(`
          INSERT INTO itineraries (id, session_id, destination, start_date, end_date, timezone, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(itineraryId, sessionId, args.destination, args.start_date, args.end_date, args.timezone, Date.now()),
        ...items.map((item) => itemInsertStatement(env.DB, itineraryId, item)),
      ]
      assertActive(state)
      await env.DB.batch(statements)
      return {
        response: {
          status: 'success',
          itinerary_id: itineraryId,
          start_date: args.start_date,
          end_date: args.end_date,
          date_adjusted: args.date_adjusted,
        },
        notification: args.date_adjusted
          ? `Tanggal lampau disesuaikan ke ${args.start_date}–${args.end_date}; itinerary sudah disimpan.`
          : 'Itinerary baru sudah disimpan.',
        itineraryChanged: true,
      }
    }

    if (name === 'update_itinerary_day') {
      const args = parseUpdateItineraryDay(rawArgs)
      const itinerary = await env.DB.prepare(`
        SELECT id, start_date, end_date FROM itineraries
        WHERE session_id = ? ORDER BY created_at DESC, id DESC LIMIT 1
      `).bind(sessionId).first<{ id: string; start_date: string; end_date: string }>()
      if (!itinerary) return { response: { status: 'error', message: 'No itinerary exists yet' } }
      const duration = Math.floor((Date.parse(`${itinerary.end_date}T00:00:00Z`) - Date.parse(`${itinerary.start_date}T00:00:00Z`)) / 86_400_000) + 1
      if (args.day_number > duration) {
        return { response: { status: 'error', message: 'Day is outside the itinerary date range' } }
      }

      const existingResult = await env.DB.prepare(`
        SELECT title, location_name, address, latitude, longitude, source_url, rating, user_ratings_total, source_name
        FROM itinerary_items WHERE itinerary_id = ? AND day_number = ?
      `).bind(itinerary.id, args.day_number).all<ItineraryItemInput>()
      const existingByTitle = new Map(
        (existingResult.results || []).map((item) => [item.title.trim().toLowerCase(), item]),
      )
      const mergedItems = args.items.map((item) => {
        const existing = existingByTitle.get(item.title.trim().toLowerCase())
        if (!existing || item.source_url) return item
        return {
          ...item,
          location_name: existing.location_name,
          address: existing.address,
          latitude: existing.latitude,
          longitude: existing.longitude,
          source_url: existing.source_url,
          rating: existing.rating,
          user_ratings_total: existing.user_ratings_total,
          source_name: existing.source_name,
        }
      })
      const items = applyGroundedProvenance(mergedItems, state)
      assertActive(state)
      await env.DB.batch([
        env.DB.prepare('DELETE FROM itinerary_items WHERE itinerary_id = ? AND day_number = ?')
          .bind(itinerary.id, args.day_number),
        ...items.map((item) => itemInsertStatement(env.DB, itinerary.id, item)),
      ])
      return {
        response: { status: 'success', itinerary_id: itinerary.id, day_number: args.day_number },
        notification: `Rencana hari ke-${args.day_number} sudah diperbarui.`,
        itineraryChanged: true,
      }
    }

    if (name === 'search_places') {
      if (state.placeSearches >= 2) {
        return { response: { status: 'error', message: 'Batas dua pencarian tempat per pesan sudah tercapai. Gunakan hasil yang tersedia.' } }
      }
      state.placeSearches += 1
      const args = parsePlaceSearch(rawArgs)
      const result = await searchPlaces(env.CHAT_HISTORY, args.query, args.destination, args.limit, env.GOOGLE_MAPS_API_KEY)
      for (const place of result.places) state.groundedPlaces.set(place.source_url, place)
      return {
        response: { status: 'success', ...result },
        notification: `Data tempat untuk “${args.query}” diverifikasi via ${result.source}.`,
      }
    }

    if (name === 'check_weather') {
      if (state.weatherChecked) {
        return { response: { status: 'error', message: 'Cuaca sudah diperiksa. Gunakan hasil yang tersedia.' } }
      }
      state.weatherChecked = true
      const args = parseWeatherSearch(rawArgs)
      const result = await checkWeather(env.CHAT_HISTORY, args.destination, args.startDate, args.endDate)
      return {
        response: result as Record<string, unknown>,
        notification: args.dateAdjusted
          ? `Tanggal cuaca disesuaikan ke ${args.startDate}–${args.endDate} dan diperiksa melalui Open-Meteo.`
          : 'Ketersediaan prakiraan cuaca diperiksa melalui Open-Meteo.',
      }
    }

    return { response: { status: 'error', message: `Unknown tool: ${name}` } }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof ValidationError) return { response: { status: 'error', message: error.message } }
    console.error(`Tool ${name} failed`, error)
    return { response: { status: 'error', message: 'External data or storage operation failed' } }
  }
}
