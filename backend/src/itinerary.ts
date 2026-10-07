import type { Context } from 'hono'
import { isAuthorized } from './session'
import type { AppEnv } from './types'
import { validateSessionId, ValidationError } from './validation'

export async function getItineraryHandler(c: Context<AppEnv>) {
  try {
    const sessionId = validateSessionId(c.req.param('session_id'))
    if (!await isAuthorized(c, sessionId)) return c.json({ error: 'Sesi tidak valid.' }, 401)

    const itinerary = await c.env.DB.prepare(`
      SELECT * FROM itineraries
      WHERE session_id = ? ORDER BY created_at DESC, id DESC LIMIT 1
    `).bind(sessionId).first<Record<string, unknown>>()
    if (!itinerary) return c.json({ data: null })

    const items = await c.env.DB.prepare(`
      SELECT * FROM itinerary_items
      WHERE itinerary_id = ? ORDER BY day_number ASC, time_slot ASC, id ASC
    `).bind(itinerary.id).all()

    return c.json({ data: { ...itinerary, items: items.results || [] } })
  } catch (error) {
    if (error instanceof ValidationError) return c.json({ error: error.message }, 400)
    console.error(error)
    return c.json({ error: 'Gagal memuat itinerary.' }, 500)
  }
}
