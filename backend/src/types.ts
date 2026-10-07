export type Bindings = {
  DB: D1Database
  CHAT_HISTORY: KVNamespace
  GEMINI_API_KEY: string
  FRONTEND_ORIGIN?: string
}

export type AppEnv = { Bindings: Bindings }

export type ChatMessage = {
  role: 'user' | 'model'
  content: string
}

export type Preference = {
  preference_category: string
  preference_value: string
}

export type ItineraryItemInput = {
  day_number: number
  time_slot: string
  title: string
  description: string | null
  category: string | null
  location_name: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  source_url: string | null
}

export type BuildItineraryInput = {
  destination: string
  start_date: string
  end_date: string
  timezone: string
  items: ItineraryItemInput[]
  date_adjusted: boolean
}

export type UpdateItineraryDayInput = {
  day_number: number
  items: ItineraryItemInput[]
}
