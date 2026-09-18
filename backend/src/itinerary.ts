import { Context } from 'hono'

export async function getItineraryHandler(c: Context) {
  const sessionId = c.req.param('session_id')
  
  if (!sessionId) {
    return c.json({ error: 'Missing session_id' }, 400)
  }

  // Fetch the latest itinerary for this session
  const itineraryResult = await c.env.DB.prepare(`
    SELECT * FROM itineraries WHERE session_id = ? ORDER BY created_at DESC LIMIT 1
  `).bind(sessionId).all()

  if (!itineraryResult.results || itineraryResult.results.length === 0) {
    return c.json({ data: null }) // No itinerary yet
  }

  const itinerary = itineraryResult.results[0]
  
  // Fetch items
  const itemsResult = await c.env.DB.prepare(`
    SELECT * FROM itinerary_items WHERE itinerary_id = ? ORDER BY day_number ASC
  `).bind(itinerary.id).all()

  return c.json({
    data: {
      ...itinerary,
      items: itemsResult.results || []
    }
  })
}
