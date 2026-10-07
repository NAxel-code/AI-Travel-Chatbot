import assert from 'node:assert/strict'
import test from 'node:test'
import { encodeSse } from '../src/sse.ts'
import { parseBuildItinerary, parseChatRequest, parseWeatherSearch, ValidationError } from '../src/validation.ts'

test('SSE payload remains valid when text contains quotes and newlines', () => {
  const output = new TextDecoder().decode(encodeSse({ type: 'system', message: 'budget = "hemat"\naman' }))
  const payload = output.slice('data: '.length).trim()
  assert.deepEqual(JSON.parse(payload), { type: 'system', message: 'budget = "hemat"\naman' })
})

test('chat request rejects invalid sessions and oversized messages', () => {
  assert.throws(() => parseChatRequest({ session_id: 'invalid', message: 'halo' }), ValidationError)
  assert.throws(() => parseChatRequest({ session_id: crypto.randomUUID(), message: 'x'.repeat(4001) }), ValidationError)
})

test('itinerary validation rejects days outside the date range', () => {
  assert.throws(() => parseBuildItinerary({
    destination: 'Bandung',
    start_date: '2026-10-07',
    end_date: '2026-10-08',
    timezone: 'Asia/Jakarta',
    items: [{ day_number: 3, time_slot: '09:00', title: 'Museum' }],
  }), ValidationError)
})

test('itinerary validation keeps grounded location fields', () => {
  const result = parseBuildItinerary({
    destination: 'Bandung',
    start_date: '2026-10-07',
    end_date: '2026-10-08',
    timezone: 'Asia/Jakarta',
    items: [{
      day_number: 1,
      time_slot: '09:00',
      title: 'Museum Geologi',
      latitude: -6.9007,
      longitude: 107.6215,
      source_url: 'https://www.openstreetmap.org/way/1',
    }],
  })
  assert.equal(result.items[0].latitude, -6.9007)
  assert.equal(result.items[0].source_url, 'https://www.openstreetmap.org/way/1')
})


test('model fallback skips unavailable models but not permanent failures', async () => {
  const { callWithFallback } = await import('../src/chat.ts')
  const tried: string[] = []
  const result = await callWithFallback(async (model) => {
    tried.push(model)
    if (tried.length === 1) throw Object.assign(new Error('model not found'), { status: 404 })
    return model
  })
  assert.equal(result.model, tried[1])
  assert.equal(tried.length, 2)

  const permanentAttempts: string[] = []
  await assert.rejects(() => callWithFallback(async (model) => {
    permanentAttempts.push(model)
    throw Object.assign(new Error('invalid API key'), { status: 401 })
  }), /invalid API key/)
  assert.equal(permanentAttempts.length, 1)
})

test('cancelled and unverified tool writes never reach D1', async () => {
  const { executeAgentTool } = await import('../src/agent-tools.ts')
  let databaseTouched = false
  const env = {
    DB: { prepare: () => { databaseTouched = true; throw new Error('unexpected DB access') } },
    CHAT_HISTORY: {},
  } as never

  await assert.rejects(() => executeAgentTool(
    env,
    crypto.randomUUID(),
    'save_user_preference',
    { category: 'budget', value: 'hemat' },
    { groundedPlaces: new Map(), placeSearches: 0, weatherChecked: false, isCancelled: () => true },
  ), { name: 'AbortError' })
  assert.equal(databaseTouched, false)

  const unverified = await executeAgentTool(
    env,
    crypto.randomUUID(),
    'build_itinerary',
    {
      destination: 'Bandung',
      start_date: '2026-10-07',
      end_date: '2026-10-08',
      timezone: 'Asia/Jakarta',
      items: [{
        day_number: 1,
        time_slot: '09:00',
        title: 'Museum',
        address: 'Alamat buatan',
        latitude: -6.9,
        longitude: 107.6,
        source_url: 'https://example.com/place',
      }],
    },
    { groundedPlaces: new Map(), placeSearches: 0, weatherChecked: false, isCancelled: () => false },
  )
  assert.equal(unverified.response.status, 'error')
  assert.equal(databaseTouched, false)
})


test('past itinerary and weather dates move to the nearest future occurrence', () => {
  const now = new Date('2026-10-07T12:00:00Z')
  const itinerary = parseBuildItinerary({
    destination: 'Bandung',
    start_date: '2024-09-10',
    end_date: '2024-09-12',
    timezone: 'Asia/Jakarta',
    items: [{ day_number: 1, time_slot: '09:00', title: 'Museum' }],
  }, now)
  assert.equal(itinerary.start_date, '2027-09-10')
  assert.equal(itinerary.end_date, '2027-09-12')
  assert.equal(itinerary.date_adjusted, true)

  const weather = parseWeatherSearch({
    destination: 'Bandung',
    start_date: '2024-12-20',
    end_date: '2024-12-21',
  }, now)
  assert.equal(weather.startDate, '2026-12-20')
  assert.equal(weather.endDate, '2026-12-21')
  assert.equal(weather.dateAdjusted, true)
})


test('model calls time out and skip directly to the next candidate', async () => {
  const { callWithFallback, ModelTimeoutError, withTimeout } = await import('../src/chat.ts')
  await assert.rejects(
    () => withTimeout(new Promise<never>(() => undefined), 5, 'test model'),
    ModelTimeoutError,
  )

  const tried: string[] = []
  const result = await callWithFallback(async (model) => {
    tried.push(model)
    if (model === 'slow') throw new ModelTimeoutError('slow model')
    return model
  }, ['slow', 'fast'])
  assert.deepEqual(tried, ['slow', 'fast'])
  assert.equal(result.model, 'fast')
})

test('place search limit stops repeated external lookups', async () => {
  const { executeAgentTool } = await import('../src/agent-tools.ts')
  const result = await executeAgentTool(
    { DB: {}, CHAT_HISTORY: {} } as never,
    crypto.randomUUID(),
    'search_places',
    { query: 'alam', destination: 'Bandung' },
    { groundedPlaces: new Map(), placeSearches: 2, weatherChecked: false, isCancelled: () => false },
  )
  assert.equal(result.response.status, 'error')
  assert.match(String(result.response.message), /Batas dua pencarian/)
})
