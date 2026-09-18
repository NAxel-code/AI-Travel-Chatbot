import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chatHandler } from './chat'
import { getItineraryHandler } from './itinerary'

type Bindings = {
  DB: D1Database
  CHAT_HISTORY: KVNamespace
  GEMINI_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}))

app.get('/', (c) => {
  return c.text('AI Travel Planner API is running!')
})

app.post('/api/chat', chatHandler)
app.get('/api/itinerary/:session_id', getItineraryHandler)

export default app
