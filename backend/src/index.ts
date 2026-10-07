import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chatHandler } from './chat'
import { getItineraryHandler } from './itinerary'
import {
  createSessionHandler,
  deletePreferenceHandler,
  getHistoryHandler,
  getPreferencesHandler,
} from './session'
import type { AppEnv } from './types'

const app = new Hono<AppEnv>()

app.use('/api/*', cors({
  origin: (origin, c) => {
    const allowed = String(c.env.FRONTEND_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    return allowed.includes(origin) ? origin : null
  },
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Session-Token'],
  maxAge: 86400,
}))

app.get('/', (c) => c.json({ status: 'ok', service: 'AI Travel Planner API' }))
app.post('/api/session', createSessionHandler)
app.post('/api/chat', chatHandler)
app.get('/api/history/:session_id', getHistoryHandler)
app.get('/api/preferences/:session_id', getPreferencesHandler)
app.delete('/api/preferences/:session_id/:category', deletePreferenceHandler)
app.get('/api/itinerary/:session_id', getItineraryHandler)

app.notFound((c) => c.json({ error: 'Endpoint tidak ditemukan.' }, 404))
app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
