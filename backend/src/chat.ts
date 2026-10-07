import type { Context } from 'hono'
import { GoogleGenAI } from '@google/genai'
import { executeAgentTool, type AgentToolState } from './agent-tools'
import { functionDeclarations, getSystemPrompt } from './ai'
import { encodeSse, type SseEvent } from './sse'
import { consumeRateLimit, isAuthorized } from './session'
import type { AppEnv, ChatMessage, ItineraryItemInput, Preference } from './types'
import { parseChatRequest, ValidationError } from './validation'

const MODEL_CANDIDATES = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']
const MAX_TOOL_ROUNDS = 4

type AgentCall = { name?: string; args?: unknown }
type CurrentItinerary = {
  id: string
  destination: string
  start_date: string
  end_date: string
  timezone: string
  items: ItineraryItemInput[]
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const value = (error as { status?: unknown; code?: unknown }).status
    ?? (error as { code?: unknown }).code
  if (typeof value === 'number') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isTransient(error: unknown): boolean {
  const status = errorStatus(error)
  return status === 429 || status === 503 || /RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|overload/i.test(errorMessage(error))
}

function isUnavailable(error: unknown): boolean {
  return errorStatus(error) === 404 || /NOT_FOUND|model.+not found|no longer available/i.test(errorMessage(error))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function callWithFallback<T>(
  call: (model: string) => Promise<T>,
  candidates = MODEL_CANDIDATES,
): Promise<{ result: T; model: string }> {
  let lastError: unknown
  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return { result: await call(model), model }
      } catch (error) {
        lastError = error
        if (isTransient(error) && attempt === 0) {
          await sleep(800)
          continue
        }
        if (!isTransient(error) && !isUnavailable(error)) throw error
        break
      }
    }
  }
  throw lastError
}

function candidateOrder(activeModel: string): string[] {
  return [activeModel, ...MODEL_CANDIDATES.filter((model) => model !== activeModel)]
}

function parseHistory(raw: string | null): ChatMessage[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ChatMessage => {
      if (!item || typeof item !== 'object') return false
      const message = item as Partial<ChatMessage>
      return (message.role === 'user' || message.role === 'model') && typeof message.content === 'string'
    }).slice(-20)
  } catch {
    return []
  }
}

async function getCurrentItinerary(env: AppEnv['Bindings'], sessionId: string): Promise<CurrentItinerary | null> {
  const itinerary = await env.DB.prepare(`
    SELECT id, destination, start_date, end_date, timezone
    FROM itineraries WHERE session_id = ? ORDER BY created_at DESC, id DESC LIMIT 1
  `).bind(sessionId).first<Omit<CurrentItinerary, 'items'>>()
  if (!itinerary) return null
  const items = await env.DB.prepare(`
    SELECT day_number, time_slot, title, description, category,
      location_name, address, latitude, longitude, source_url
    FROM itinerary_items WHERE itinerary_id = ? ORDER BY day_number, time_slot, id
  `).bind(itinerary.id).all<ItineraryItemInput>()
  return { ...itinerary, items: items.results || [] }
}

export async function chatHandler(c: Context<AppEnv>) {
  try {
    const rawBody = await c.req.json().catch(() => {
      throw new ValidationError('Request JSON tidak valid.')
    })
    const { sessionId, message } = parseChatRequest(rawBody)
    if (!await isAuthorized(c, sessionId)) return c.json({ error: 'Sesi tidak valid.' }, 401)
    if (!c.env.GEMINI_API_KEY || c.env.GEMINI_API_KEY.startsWith('PASTE_')) {
      return c.json({ error: 'GEMINI_API_KEY belum dikonfigurasi.' }, 500)
    }

    const ip = c.req.header('CF-Connecting-IP') || 'local'
    const [sessionRate, ipRate] = await Promise.all([
      consumeRateLimit(c.env.DB, `chat-session:${sessionId}`, 12, 60),
      consumeRateLimit(c.env.DB, `chat-ip:${ip}`, 30, 60),
    ])
    if (!sessionRate.allowed || !ipRate.allowed) {
      const retryAfter = Math.max(sessionRate.retryAfter, ipRate.retryAfter)
      c.header('Retry-After', String(retryAfter))
      return c.json({ error: 'Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.' }, 429)
    }

    const [preferencesResult, historyRaw, currentItinerary] = await Promise.all([
      c.env.DB.prepare(`
        SELECT preference_category, preference_value
        FROM user_preferences WHERE session_id = ? ORDER BY preference_category
      `).bind(sessionId).all<Preference>(),
      c.env.CHAT_HISTORY.get(`session:${sessionId}`),
      getCurrentItinerary(c.env, sessionId),
    ])
    const history = parseHistory(historyRaw)
    history.push({ role: 'user', content: message })
    const contents = history.map((entry) => ({ role: entry.role, parts: [{ text: entry.content }] }))
    const systemPrompt = getSystemPrompt(preferencesResult.results || [], currentItinerary)
    const ai = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY })
    let { result: responseStream, model: activeModel } = await callWithFallback((model) =>
      ai.models.generateContentStream({
        model,
        contents,
        config: { systemInstruction: systemPrompt, tools: [{ functionDeclarations }] },
      }),
    )

    const requestSignal = c.req.raw.signal
    let streamCancelled = false
    const isCancelled = () => streamCancelled || requestSignal.aborted
    const ensureActive = () => {
      if (isCancelled()) throw new DOMException('Request cancelled', 'AbortError')
    }

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: SseEvent | '[DONE]') => {
          ensureActive()
          controller.enqueue(encodeSse(event))
        }
        let fullText = ''
        const toolState: AgentToolState = { groundedPlaces: new Map(), isCancelled }
        for (const item of currentItinerary?.items || []) {
          if (item.source_url && item.location_name && item.address && item.latitude != null && item.longitude != null) {
            toolState.groundedPlaces.set(item.source_url, {
              name: item.location_name,
              address: item.address,
              category: item.category,
              latitude: item.latitude,
              longitude: item.longitude,
              source_url: item.source_url,
            })
          }
        }

        async function consumeInitialStream(currentStream: typeof responseStream) {
          let calls: AgentCall[] | undefined
          let modelContent: any
          for await (const chunk of currentStream) {
            ensureActive()
            const chunkCalls = chunk.functionCalls as AgentCall[] | undefined
            if (chunkCalls?.length) {
              calls = chunkCalls
              modelContent = chunk.candidates?.[0]?.content ?? {
                role: 'model',
                parts: chunkCalls.map((call) => ({ functionCall: call })),
              }
              break
            }
            if (chunk.text) {
              fullText += chunk.text
              send({ type: 'text', text: chunk.text })
            }
          }
          return { calls, modelContent }
        }

        try {
          let initial
          try {
            initial = await consumeInitialStream(responseStream)
          } catch (error) {
            const alternatives = MODEL_CANDIDATES.filter((model) => model !== activeModel)
            if (fullText || !isTransient(error) || !alternatives.length) throw error
            const fallback = await callWithFallback((model) => ai.models.generateContentStream({
              model,
              contents,
              config: { systemInstruction: systemPrompt, tools: [{ functionDeclarations }] },
            }), alternatives)
            responseStream = fallback.result
            activeModel = fallback.model
            initial = await consumeInitialStream(responseStream)
          }

          let { calls, modelContent } = initial
          const conversation: any[] = [...contents]
          for (let round = 0; calls?.length && round < MAX_TOOL_ROUNDS; round += 1) {
            ensureActive()
            const responseParts = []
            const hasLookupAndWrite = calls.some((call) => call.name === 'search_places' || call.name === 'check_weather')
              && calls.some((call) => call.name === 'build_itinerary' || call.name === 'update_itinerary_day')

            for (const call of calls) {
              ensureActive()
              const name = call.name || 'unknown'
              const result = hasLookupAndWrite && (name === 'build_itinerary' || name === 'update_itinerary_day')
                ? { response: { status: 'error', message: 'Use lookup results, then call the itinerary tool in the next round.' } }
                : await executeAgentTool(c.env, sessionId, name, call.args, toolState)
              responseParts.push({ functionResponse: { name, response: result.response } })
              if ('notification' in result && result.notification) send({ type: 'system', message: result.notification })
              if ('itineraryChanged' in result && result.itineraryChanged && result.response.status === 'success') {
                send({ type: 'function_call', name, status: 'success' })
              }
            }

            conversation.push(modelContent, { role: 'user', parts: responseParts })
            const generated = await callWithFallback((model) => ai.models.generateContent({
              model,
              contents: conversation,
              config: { systemInstruction: systemPrompt, tools: [{ functionDeclarations }] },
            }), candidateOrder(activeModel))
            activeModel = generated.model
            const response = generated.result
            const nextCalls = response.functionCalls as AgentCall[] | undefined
            if (nextCalls?.length) {
              calls = nextCalls
              modelContent = response.candidates?.[0]?.content ?? {
                role: 'model',
                parts: nextCalls.map((call) => ({ functionCall: call })),
              }
              continue
            }

            calls = undefined
            const responseText = response.text?.trim() || 'Selesai. Rencana perjalananmu sudah diperbarui.'
            const separator = fullText && !/\s$/.test(fullText) ? '\n\n' : ''
            fullText += `${separator}${responseText}`
            send({ type: 'text', text: `${separator}${responseText}` })
          }

          if (calls?.length) throw new Error('Maximum tool rounds reached')
          if (!fullText) {
            fullText = 'Maaf, saya belum bisa menyusun jawaban. Silakan coba lagi.'
            send({ type: 'text', text: fullText })
          }

          ensureActive()
          history.push({ role: 'model', content: fullText })
          await c.env.CHAT_HISTORY.put(
            `session:${sessionId}`,
            JSON.stringify(history.slice(-20)),
            { expirationTtl: 60 * 60 * 24 * 30 },
          )
          send('[DONE]')
        } catch (error) {
          if (!isCancelled()) {
            console.error('Chat stream failed', error)
            controller.enqueue(encodeSse({ type: 'error', message: 'Proses AI terhenti. Coba kirim ulang pesanmu.' }))
            controller.enqueue(encodeSse('[DONE]'))
          }
        } finally {
          try {
            controller.close()
          } catch {
            // The client may already have cancelled the response body.
          }
        }
      },
      cancel() {
        streamCancelled = true
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error instanceof ValidationError) return c.json({ error: error.message }, 400)
    console.error('Chat request failed', error)
    return c.json({ error: 'Permintaan tidak dapat diproses.' }, 500)
  }
}
