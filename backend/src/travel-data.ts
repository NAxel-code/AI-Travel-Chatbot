export type GroundedPlace = {
  name: string
  address: string
  category: string | null
  latitude: number
  longitude: number
  source_url: string
}

type NominatimResult = {
  osm_type: 'node' | 'way' | 'relation'
  osm_id: number
  name?: string
  display_name: string
  lat: string
  lon: string
  type?: string
}

type GeocodingResponse = {
  results?: Array<{ name: string; country?: string; latitude: number; longitude: number; timezone?: string }>
}

type ForecastResponse = {
  timezone?: string
  daily?: {
    time: string[]
    weather_code: number[]
    temperature_2m_min: number[]
    temperature_2m_max: number[]
    precipitation_probability_max: number[]
  }
}

const NOMINATIM_USER_AGENT = 'AI-Travel-Chatbot/1.0 (https://github.com/NAxel-code/AI-Travel-Chatbot)'

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function weatherLabel(code: number): string {
  if (code === 0) return 'cerah'
  if (code <= 3) return 'berawan'
  if (code === 45 || code === 48) return 'berkabut'
  if (code <= 57) return 'gerimis'
  if (code <= 67) return 'hujan'
  if (code <= 77) return 'salju'
  if (code <= 82) return 'hujan singkat'
  return 'badai petir'
}

async function geocodeDestination(cache: KVNamespace, destination: string) {
  const cacheKey = `grounding:geocode:${destination.toLowerCase()}`
  const cached = await cache.get(cacheKey, 'json') as GeocodingResponse['results'] extends Array<infer T> ? T | null : never
  if (cached) return cached

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', destination)
  url.searchParams.set('count', '1')
  url.searchParams.set('language', 'id')
  url.searchParams.set('format', 'json')
  const response = await fetchWithTimeout(url.toString())
  if (!response.ok) throw new Error(`Open-Meteo geocoding returned ${response.status}`)
  const data = await response.json<GeocodingResponse>()
  const location = data.results?.[0] || null
  if (location) await cache.put(cacheKey, JSON.stringify(location), { expirationTtl: 86_400 })
  return location
}

export async function searchPlaces(
  cache: KVNamespace,
  query: string,
  destination: string,
  limit: number,
): Promise<{ source: string; attribution: string; timezone: string | null; places: GroundedPlace[] }> {
  const search = `${query}, ${destination}`
  const cacheKey = `grounding:places:${search.toLowerCase()}:${limit}`
  const cached = await cache.get(cacheKey, 'json') as {
    source: string
    attribution: string
    timezone: string | null
    places: GroundedPlace[]
  } | null
  if (cached) return cached

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', search)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', String(limit))

  const [response, destinationData] = await Promise.all([
    fetchWithTimeout(url.toString(), {
      headers: { 'Accept-Language': 'id,en', 'User-Agent': NOMINATIM_USER_AGENT },
    }),
    geocodeDestination(cache, destination),
  ])
  if (!response.ok) throw new Error(`Nominatim returned ${response.status}`)

  const data = await response.json<NominatimResult[]>()
  const result = {
    source: 'OpenStreetMap',
    attribution: '© OpenStreetMap contributors',
    timezone: destinationData?.timezone || null,
    places: data.map((place) => ({
      name: place.name || place.display_name.split(',')[0],
      address: place.display_name,
      category: place.type || null,
      latitude: Number(place.lat),
      longitude: Number(place.lon),
      source_url: `https://www.openstreetmap.org/${place.osm_type}/${place.osm_id}`,
    })),
  }
  await cache.put(cacheKey, JSON.stringify(result), { expirationTtl: 86_400 })
  return result
}

export async function checkWeather(
  cache: KVNamespace,
  destination: string,
  startDate: string,
  endDate: string,
) {
  const location = await geocodeDestination(cache, destination)
  if (!location) return { status: 'unavailable', reason: 'Lokasi tidak ditemukan.', timezone: null }

  const today = new Date()
  const todayIso = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10)
  const daysAhead = Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86_400_000)
  if (startDate < todayIso || daysAhead > 15) {
    return {
      status: 'unavailable',
      reason: 'Prakiraan hanya tersedia untuk perjalanan hari ini hingga 15 hari ke depan.',
      timezone: location.timezone || null,
    }
  }

  const cacheKey = `grounding:weather:${destination.toLowerCase()}:${startDate}:${endDate}`
  const cached = await cache.get(cacheKey, 'json')
  if (cached) return cached

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
  forecastUrl.searchParams.set('latitude', String(location.latitude))
  forecastUrl.searchParams.set('longitude', String(location.longitude))
  forecastUrl.searchParams.set('daily', 'weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max')
  forecastUrl.searchParams.set('timezone', location.timezone || 'auto')
  forecastUrl.searchParams.set('start_date', startDate)
  forecastUrl.searchParams.set('end_date', endDate)
  const forecastResponse = await fetchWithTimeout(forecastUrl.toString())
  if (!forecastResponse.ok) throw new Error(`Open-Meteo forecast returned ${forecastResponse.status}`)
  const forecast = await forecastResponse.json<ForecastResponse>()
  if (!forecast.daily) return { status: 'unavailable', reason: 'Prakiraan tidak tersedia.', timezone: location.timezone || null }

  const result = {
    status: 'success',
    source: 'Open-Meteo',
    location: `${location.name}${location.country ? `, ${location.country}` : ''}`,
    timezone: forecast.timezone || location.timezone || null,
    days: forecast.daily.time.map((date, index) => ({
      date,
      condition: weatherLabel(forecast.daily!.weather_code[index]),
      min_c: forecast.daily!.temperature_2m_min[index],
      max_c: forecast.daily!.temperature_2m_max[index],
      rain_probability_percent: forecast.daily!.precipitation_probability_max[index],
    })),
  }
  await cache.put(cacheKey, JSON.stringify(result), { expirationTtl: 3600 })
  return result
}
