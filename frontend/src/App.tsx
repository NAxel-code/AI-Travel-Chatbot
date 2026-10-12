import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import {
  Sparkles,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Square,
  RotateCcw,
  Calendar,
  CheckCircle2,
  X,
  Trash2,
  Database,
  Loader2,
  Compass,
  Map as MapIcon,
  Wallet,
  MessageSquare,
  LayoutGrid,
  Route,
  Waves,
  Mountain,
  UtensilsCrossed,
} from 'lucide-react'
import { Markdown } from './components/Markdown'
import { createIcs } from './lib/calendar'
import { openOrDownloadTravelReport } from './lib/travelReport'
import { readSse } from './lib/sse'
import { Navbar } from './components/Navbar'
import { DayCard } from './components/DayCard'
import { TravelMap } from './components/TravelMap'
import { ExpensesView } from './components/ExpensesView'
import type { ItineraryItem } from './components/DayCard'

function resolveApiBase(): string {
  const configured = String(import.meta.env.VITE_API_BASE || '').trim().replace(/\/$/, '')
  const isLocalHost =
    typeof window === 'undefined' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  if (configured && (isLocalHost || !configured.includes('localhost'))) {
    return configured
  }
  return isLocalHost ? 'http://localhost:8787/api' : '/api'
}

const API_BASE = resolveApiBase()
const SESSION_STORAGE_KEY = 'travel_session_credentials'
const LEGACY_SESSION_KEY = 'travel_session_id'
const INITIAL_GREETING =
  'Halo! Mau liburan ke mana kali ini? Sebutkan destinasi (misal: Bali, Bandung, Labuan Bajo), durasi hari, dan gaya traveling favoritmu. Rute akan menyusun itinerary lengkap beserta peta dan perkiraan anggarannya!'

const STARTER_PROMPTS = [
  {
    label: 'Labuan Bajo, 5 hari',
    hint: 'Island hopping + sewa motor',
    prompt:
      'Buatkan langsung itinerary 5 hari 4 malam di Labuan Bajo mulai minggu depan, lengkap tempat wisata, makan 3x sehari, dan sewa motor',
    Icon: Waves,
  },
  {
    label: 'Bali, 3 hari',
    hint: 'Pantai & kuliner, budget menengah',
    prompt: 'Buatkan itinerary liburan 3 hari ke Bali minggu depan, suka pantai dan kuliner, budget menengah',
    Icon: Mountain,
  },
  {
    label: 'Bandung, akhir pekan',
    hint: 'Kuliner & alam, budget hemat',
    prompt: 'Buatkan itinerary wisata kuliner dan alam 2 hari di Bandung akhir pekan depan, budget hemat',
    Icon: UtensilsCrossed,
  },
] as const

const WORKSPACE_TABS = [
  ['overview', 'Jadwal', LayoutGrid],
  ['map', 'Peta', MapIcon],
  ['expenses', 'Biaya', Wallet],
] as const

type Message = { role: 'user' | 'model'; content: string }
type Credentials = { sessionId: string; token: string }
type Preference = { preference_category: string; preference_value: string }
type Itinerary = {
  id: string
  destination: string
  start_date: string
  end_date: string
  timezone: string
  items: ItineraryItem[]
}
type Notice = { id: string; message: string }
type ApiEnvelope<T> = { data: T }
type TabType = 'overview' | 'map' | 'expenses' | 'chat'
type SessionCache = {
  messages?: Message[]
  itinerary?: Itinerary | null
  preferences?: Preference[]
}

function readSessionCache(sessionId: string): SessionCache {
  try {
    return (JSON.parse(localStorage.getItem(`travel_session_cache:${sessionId}`) || '{}') as SessionCache) || {}
  } catch {
    return {}
  }
}

function writeSessionCache(sessionId: string, patch: SessionCache) {
  try {
    const prev = readSessionCache(sessionId)
    localStorage.setItem(`travel_session_cache:${sessionId}`, JSON.stringify({ ...prev, ...patch }))
  } catch {
    // Ignore storage errors
  }
}

class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function storedCredentials(): Credentials | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null') as Partial<Credentials> | null
    return parsed?.sessionId && parsed.token ? { sessionId: parsed.sessionId, token: parsed.token } : null
  } catch {
    return null
  }
}

async function apiRequest<T>(path: string, credentials?: Credentials, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (credentials) headers.set('X-Session-Token', credentials.token)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const payload = (await response.json().catch(() => null)) as ({ error?: string } & T) | null
  if (!response.ok) throw new ApiError(response.status, payload?.error || `Server mengembalikan status ${response.status}.`)
  if (!payload) throw new ApiError(response.status, 'Respons server tidak valid.')
  return payload
}

async function createSession(legacySessionId?: string | null): Promise<Credentials> {
  const result = await apiRequest<ApiEnvelope<{ session_id: string; token: string }>>('/session', undefined, {
    method: 'POST',
    body: JSON.stringify(legacySessionId ? { session_id: legacySessionId } : {}),
  })
  const credentials = { sessionId: result.data.session_id, token: result.data.token }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(credentials))
  localStorage.setItem(LEGACY_SESSION_KEY, credentials.sessionId)
  return credentials
}

function calculateDayCount(start?: string, end?: string): number {
  if (!start || !end) return 1
  try {
    const s = new Date(`${start}T00:00:00Z`).getTime()
    const e = new Date(`${end}T00:00:00Z`).getTime()
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1
    return diff > 0 ? diff : 1
  } catch {
    return 1
  }
}

function formatRangeDates(start?: string, end?: string): string {
  if (!start || !end) return 'Rencana Perjalanan'
  try {
    const s = new Date(`${start}T00:00:00Z`)
    const e = new Date(`${end}T00:00:00Z`)
    const monthFormatter = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' })
    const dayCount = calculateDayCount(start, end)
    return `${dayCount} Hari â€” ${s.getUTCDate()} ${monthFormatter.format(s)} - ${e.getUTCDate()} ${monthFormatter.format(e)}`
  } catch {
    return `${start} - ${end}`
  }
}

export default function App() {
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [messages, setMessages] = useState<Message[]>([{ role: 'model', content: INITIAL_GREETING }])
  const [input, setInput] = useState('')
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [chatProgress, setChatProgress] = useState<string | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [showPreferences, setShowPreferences] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const [pageError, setPageError] = useState<string | null>(null)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0)
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<ItineraryItem | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isBootstrapping ? 'auto' : 'smooth' })
  }, [messages, isBootstrapping])

  useEffect(() => {
    if (!credentials || isBootstrapping) return
    writeSessionCache(credentials.sessionId, { messages, itinerary, preferences })
  }, [credentials, isBootstrapping, messages, itinerary, preferences])

  useEffect(() => {
    let active = true

    async function loadSession() {
      try {
        let session = storedCredentials()
        if (!session) session = await createSession(localStorage.getItem(LEGACY_SESSION_KEY))

        const load = (current: Credentials) =>
          Promise.all([
            apiRequest<ApiEnvelope<Message[]>>(`/history/${current.sessionId}`, current),
            apiRequest<ApiEnvelope<Itinerary | null>>(`/itinerary/${current.sessionId}`, current),
            apiRequest<ApiEnvelope<Preference[]>>(`/preferences/${current.sessionId}`, current),
          ])

        let data
        try {
          data = await load(session)
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401) throw error
          localStorage.removeItem(SESSION_STORAGE_KEY)
          session = await createSession()
          data = await load(session)
        }

        if (!active) return
        const [historyResult, itineraryResult, preferenceResult] = data
        const cached = readSessionCache(session.sessionId)
        setCredentials(session)
        setMessages(
          historyResult.data.length
            ? historyResult.data
            : cached.messages?.length
            ? cached.messages
            : [{ role: 'model', content: INITIAL_GREETING }],
        )
        setItinerary(itineraryResult.data ?? cached.itinerary ?? null)
        setPreferences(preferenceResult.data.length ? preferenceResult.data : cached.preferences ?? [])
      } catch (error) {
        if (active)
          setPageError(
            error instanceof TypeError
              ? 'Server Rute tidak dapat dihubungi. Periksa koneksi lalu coba lagi.'
              : error instanceof Error
              ? error.message
              : 'Aplikasi tidak dapat dimuat.',
          )
      } finally {
        if (active) setIsBootstrapping(false)
      }
    }

    void loadSession()
    return () => {
      active = false
      abortRef.current?.abort()
    }
  }, [bootstrapAttempt])

  function retryBootstrap() {
    setPageError(null)
    setIsBootstrapping(true)
    setBootstrapAttempt((attempt) => attempt + 1)
  }

  function addNotice(message: string) {
    const id = crypto.randomUUID()
    setNotices((current) => [...current, { id, message }])
    window.setTimeout(() => setNotices((current) => current.filter((notice) => notice.id !== id)), 6000)
  }

  async function refreshItinerary(session = credentials) {
    if (!session) return
    const result = await apiRequest<ApiEnvelope<Itinerary | null>>(`/itinerary/${session.sessionId}`, session)
    if (result.data) setItinerary(result.data)
  }

  async function refreshPreferences(session = credentials) {
    if (!session) return
    const result = await apiRequest<ApiEnvelope<Preference[]>>(`/preferences/${session.sessionId}`, session)
    if (result.data.length) setPreferences(result.data)
  }

  async function sendMessage(message: string) {
    if (isLoading || !message.trim()) return
    const cleanMessage = message.trim()
    const controller = new AbortController()
    abortRef.current = controller
    const priorHistory = messages.filter((m) => m.content !== INITIAL_GREETING && m.content.trim())
    setInput('')
    setPageError(null)
    setLastFailedMessage(null)
    setChatProgress('Menghubungkan ke perencanaâ€¦')
    setIsLoading(true)
    setMessages((current) => [...current, { role: 'user', content: cleanMessage }, { role: 'model', content: '' }])

    let activeSession = credentials
    let itineraryChanged = false
    let preferencesChanged = false
    try {
      if (!activeSession) {
        activeSession = await createSession(localStorage.getItem(LEGACY_SESSION_KEY))
        setCredentials(activeSession)
      }

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': activeSession.token,
        },
        body: JSON.stringify({
          session_id: activeSession.sessionId,
          message: cleanMessage,
          client_state: {
            itinerary,
            preferences,
            history: priorHistory.slice(-18),
          },
        }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new ApiError(response.status, payload?.error || 'Pesan tidak dapat diproses.')
      }

      await readSse(response, (event) => {
        if (event.type === 'progress') {
          setChatProgress(event.message)
        } else if (event.type === 'text') {
          setChatProgress(null)
          setMessages((current) => {
            const last = current.at(-1)
            if (!last || last.role !== 'model') return current
            return [...current.slice(0, -1), { ...last, content: last.content + event.text }]
          })
        } else if (event.type === 'function_call') {
          itineraryChanged = event.name === 'build_itinerary' || event.name === 'update_itinerary_day'
          if (event.itinerary && typeof event.itinerary === 'object') {
            setItinerary(event.itinerary as Itinerary)
          }
        } else if (event.type === 'system') {
          if (event.message.startsWith('Preferensi disimpan:')) {
            preferencesChanged = true
            const rawPref = event.message.replace(/^Preferensi disimpan:\s*/, '')
            const eqIdx = rawPref.indexOf('=')
            if (eqIdx !== -1) {
              const cat = rawPref.slice(0, eqIdx).trim().replace(/\s+/g, '_')
              const val = rawPref.slice(eqIdx + 1).trim()
              if (cat && val) {
                setPreferences((prev) => {
                  const filtered = prev.filter((p) => p.preference_category !== cat)
                  return [...filtered, { preference_category: cat, preference_value: val }].sort((a, b) =>
                    a.preference_category.localeCompare(b.preference_category),
                  )
                })
              }
            }
          }
          addNotice(event.message)
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      })
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      const message = aborted
        ? 'Permintaan dibatalkan.'
        : error instanceof Error
        ? error.message
        : 'Koneksi terputus. Coba lagi.'
      setMessages((current) => {
        const last = current.at(-1)
        if (!last || last.role !== 'model') return current
        const content = last.content ? `${last.content}\n\n_${message}_` : message
        return [...current.slice(0, -1), { ...last, content }]
      })
      if (!aborted) setLastFailedMessage(cleanMessage)
    } finally {
      if (activeSession && (itineraryChanged || preferencesChanged)) {
        await Promise.all([
          itineraryChanged ? refreshItinerary(activeSession).catch(() => undefined) : Promise.resolve(),
          preferencesChanged ? refreshPreferences(activeSession).catch(() => undefined) : Promise.resolve(),
        ])
      }
      abortRef.current = null
      setChatProgress(null)
      setIsLoading(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void sendMessage(input)
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  function cancelRequest() {
    abortRef.current?.abort()
  }

  async function deletePreference(category: string) {
    if (!credentials) return
    try {
      await apiRequest(`/preferences/${credentials.sessionId}/${encodeURIComponent(category)}`, credentials, {
        method: 'DELETE',
      })
      setPreferences((current) => current.filter((item) => item.preference_category !== category))
      addNotice('Preferensi dihapus dari memori.')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Preferensi tidak dapat dihapus.')
    }
  }

  function refineDay(day: number) {
    setInput(`Ubah itinerary hari ke-${day}: `)
    setActiveTab('chat')
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  function startNewTrip() {
    setSelectedDay(null)
    setSelectedPlace(null)
    setInput('Rencanakan perjalanan baru ke: ')
    setActiveTab('chat')
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function startNewSession() {
    if (isLoading || isStartingSession) return
    setIsStartingSession(true)
    try {
      abortRef.current?.abort()
      localStorage.removeItem(SESSION_STORAGE_KEY)
      localStorage.removeItem(LEGACY_SESSION_KEY)
      const session = await createSession()
      setCredentials(session)
      setMessages([{ role: 'model', content: INITIAL_GREETING }])
      setItinerary(null)
      setPreferences([])
      setInput('')
      setSelectedDay(null)
      setSelectedPlace(null)
      setLastFailedMessage(null)
      setPageError(null)
      setShowPreferences(false)
      setActiveTab('chat')
      addNotice('Sesi baru dimulai. Mulai rencanakan perjalanan dari awal.')
      window.setTimeout(() => inputRef.current?.focus(), 50)
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 429
          ? 'Terlalu banyak sesi baru. Coba lagi beberapa saat.'
          : error instanceof Error
          ? error.message
          : 'Sesi baru tidak dapat dibuat.'
      setPageError(message)
    } finally {
      setIsStartingSession(false)
    }
  }

  function exportCalendar() {
    if (!itinerary) return
    try {
      const blob = new Blob([createIcs(itinerary)], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `itinerary-${itinerary.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Kalender tidak dapat dibuat.')
    }
  }

  const groupedItems =
    itinerary?.items.reduce<Record<number, ItineraryItem[]>>((groups, item) => {
      ;(groups[item.day_number] ||= []).push(item)
      return groups
    }, {}) || {}

  const sortedDays = Object.keys(groupedItems)
    .map(Number)
    .sort((a, b) => a - b)

  const combinedContextText = [
    ...messages.filter((m) => m.role === 'user').map((m) => m.content),
    ...preferences.map((p) => p.preference_value),
  ].join(' ')

  const inferredDestination = (() => {
    if (itinerary?.destination) return itinerary.destination
    const known = [
      'Labuan Bajo',
      'Raja Ampat',
      'Yogyakarta',
      'Bandung',
      'Lombok',
      'Jakarta',
      'Surabaya',
      'Malang',
      'Bromo',
      'Danau Toba',
      'Belitung',
      'Manado',
      'Makassar',
      'Semarang',
      'Solo',
      'Bali',
    ]
    for (const place of known) {
      if (new RegExp(`\\b${place}\\b`, 'i').test(combinedContextText)) return place
    }
    if (/\bjogja\b/i.test(combinedContextText)) return 'Yogyakarta'
    return 'Bali'
  })()

  const inferredDayCount = (() => {
    if (itinerary) return calculateDayCount(itinerary.start_date, itinerary.end_date)
    const match = combinedContextText.match(/(\d{1,2})\s*hari/i)
    if (match) {
      const parsed = Number(match[1])
      if (parsed >= 1 && parsed <= 31) return parsed
    }
    return 3
  })()

  const hasAskedAi = messages.some((m) => m.role === 'user')

  function handleExportReport() {
    const latestAiMsg = [...messages]
      .reverse()
      .find((m) => m.role === 'model' && m.content !== INITIAL_GREETING && m.content.trim())?.content
    openOrDownloadTravelReport({
      destination: inferredDestination,
      dayCount: inferredDayCount,
      startDate: itinerary?.start_date,
      endDate: itinerary?.end_date,
      items: itinerary?.items || [],
      latestAiMessage: latestAiMsg,
      preferences,
    })
  }

  // On desktop the workspace is always visible; when the chat tab is active it shows the schedule.
  const workspaceTab: Exclude<TabType, 'chat'> = activeTab === 'chat' ? 'overview' : activeTab

  function runStarter(prompt: string) {
    setActiveTab('chat')
    void sendMessage(prompt)
  }

  if (isBootstrapping) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#faf8f4] px-6">
        <div className="flex items-center gap-3 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm text-stone-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
          Menyiapkan perjalananmu…
        </div>
      </main>
    )
  }

  return (
    <div className="app-shell flex h-[100dvh] w-full flex-col overflow-hidden bg-[#faf8f4] text-stone-800 antialiased">
      <Navbar
        destination={itinerary?.destination || (hasAskedAi ? inferredDestination : undefined)}
        hasItinerary={Boolean(itinerary) || hasAskedAi}
        onSearch={(query) => {
          setActiveTab('chat')
          void sendMessage(`Cari rekomendasi tempat terkait: ${query}`)
        }}
        onExportPdf={handleExportReport}
        onExportCalendar={exportCalendar}
        onTogglePreferences={() => {
          setActiveTab('chat')
          setShowPreferences((v) => !v)
        }}
        onNewTrip={startNewTrip}
        onNewSession={startNewSession}
        isStartingSession={isStartingSession}
      />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-2 sm:p-4 lg:p-5">
        {/* ───────── Chat panel ───────── */}
        <aside
          className={`min-h-0 flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm shadow-stone-900/[0.03] ${
            activeTab === 'chat' ? 'flex w-full' : 'hidden'
          } lg:flex lg:w-[400px] lg:shrink-0 xl:w-[440px]`}
        >
          <header className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative grid h-10 w-10 place-items-center rounded-2xl bg-teal-50 text-teal-700">
                <Sparkles className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div>
                <h2 className="text-sm font-bold leading-none text-stone-900">Asisten Rute</h2>
                <p className="mt-1 text-xs text-stone-500">
                  {isLoading ? 'Sedang menyusun…' : 'Siap membantu rencanamu'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPreferences((v) => !v)}
              aria-expanded={showPreferences}
              className={`flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition ${
                showPreferences
                  ? 'bg-teal-700 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
              title="Kelola preferensi yang diingat"
            >
              <Database className="h-3.5 w-3.5" />
              Memori{preferences.length > 0 ? ` · ${preferences.length}` : ''}
            </button>
          </header>

          {showPreferences && (
            <section className="animate-rise border-b border-stone-100 bg-stone-50/80 px-4 py-3" aria-label="Preferensi tersimpan">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500">Hal yang Rute ingat tentangmu</p>
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                  aria-label="Tutup memori"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {preferences.length === 0 ? (
                <p className="text-xs text-stone-500">
                  Belum ada. Sebutkan hal seperti “suka pantai” atau “budget hemat” di chat.
                </p>
              ) : (
                <ul className="thin-scrollbar flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {preferences.map((p) => (
                    <li
                      key={p.preference_category}
                      className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white py-1 pl-3 pr-1 text-xs text-stone-700"
                    >
                      <span className="font-semibold capitalize text-teal-800">
                        {p.preference_category.replaceAll('_', ' ')}:
                      </span>
                      <span className="max-w-[160px] truncate">{p.preference_value}</span>
                      <button
                        type="button"
                        onClick={() => void deletePreference(p.preference_category)}
                        className="grid h-6 w-6 place-items-center rounded-full text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label={`Hapus preferensi ${p.preference_category}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {notices.length > 0 && (
            <div className="space-y-1.5 px-4 pt-3" role="status">
              {notices.map((n) => (
                <div
                  key={n.id}
                  className="animate-rise flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {n.message}
                </div>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`animate-rise flex ${message.role === 'user' ? 'justify-end' : 'justify-start gap-2.5'}`}
              >
                {message.role === 'model' && (
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-700 text-white">
                    <Route className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'rounded-3xl rounded-br-md bg-teal-700 px-4 py-2.5 text-white'
                      : 'rounded-3xl rounded-tl-md bg-stone-100 px-4 py-3 text-stone-800'
                  }`}
                >
                  {message.role === 'model' && !message.content ? (
                    <span className="flex items-center gap-2 text-stone-500">
                      <span className="flex gap-1" aria-hidden="true">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600" />
                      </span>
                      {chatProgress || 'Menyusun rute terbaik…'}
                    </span>
                  ) : message.role === 'model' ? (
                    <>
                      <Markdown content={message.content} />
                      {index === messages.length - 1 && isLoading && chatProgress && (
                        <div className="mt-2.5 flex items-center gap-2 border-t border-stone-200 pt-2 text-xs text-stone-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700" />
                          <span>{chatProgress}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Starter prompts on a fresh conversation */}
            {!hasAskedAi && !isLoading && (
              <div className="animate-rise space-y-2 pl-9">
                <p className="text-xs font-semibold text-stone-500">Coba mulai dengan:</p>
                <div className="flex flex-col gap-2">
                  {STARTER_PROMPTS.map(({ label, hint, prompt, Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => runStarter(prompt)}
                      className="group flex min-h-[52px] items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-teal-600/40 hover:shadow-md hover:shadow-stone-900/5 active:translate-y-0"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 transition group-hover:bg-teal-50 group-hover:text-teal-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-stone-800">{label}</span>
                        <span className="block text-xs text-stone-500">{hint}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mobile-only shortcut to the workspace tabs */}
            {hasAskedAi && !isLoading && (
              <div className="lg:hidden rounded-2xl border border-stone-200 bg-stone-50 p-3">
                <p className="mb-2 text-xs font-semibold text-stone-600">
                  {inferredDestination} · {inferredDayCount} hari
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {WORKSPACE_TABS.map(([tab, label, Icon]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white text-xs font-semibold text-stone-700 transition active:scale-[0.97]"
                    >
                      <Icon className="h-4 w-4 text-teal-700" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <footer className="border-t border-stone-100 p-3">
            {lastFailedMessage && !isLoading && (
              <button
                type="button"
                onClick={() => void sendMessage(lastFailedMessage)}
                className="mb-2 flex min-h-[40px] items-center gap-1.5 rounded-full bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
              >
                <RotateCcw className="h-4 w-4" /> Coba kirim ulang
              </button>
            )}
            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-2 rounded-3xl border border-stone-200 bg-stone-50 p-1.5 transition focus-within:border-teal-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-600/10"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={isLoading}
                maxLength={4000}
                rows={1}
                aria-label="Pesan untuk Rute"
                placeholder="Mau liburan ke mana?"
                className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-base text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-60 sm:text-sm"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={cancelRequest}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-stone-800 text-white transition hover:bg-stone-900"
                  title="Hentikan"
                  aria-label="Hentikan"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal-700 text-white shadow-sm transition hover:bg-teal-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-300"
                  title="Kirim pesan"
                  aria-label="Kirim pesan"
                >
                  <ArrowUp className="h-5 w-5 stroke-[2.5]" />
                </button>
              )}
            </form>
            <p className="mt-1.5 hidden px-2 text-[11px] text-stone-400 sm:block">
              Enter untuk kirim · Shift+Enter baris baru · Verifikasi harga & jam buka sebelum berangkat
            </p>
          </footer>
        </aside>

        {/* ───────── Workspace panel ───────── */}
        <main
          className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm shadow-stone-900/[0.03] ${
            activeTab === 'chat' ? 'hidden' : 'flex'
          } lg:flex`}
        >
          <div className="flex flex-col gap-3 border-b border-stone-100 px-4 pb-3 pt-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-stone-200 text-stone-600 hover:bg-stone-50 lg:hidden"
                  aria-label="Kembali ke chat"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    {itinerary ? 'Itinerary tersimpan' : hasAskedAi ? 'Draf rencana' : 'Rencana baru'}
                  </p>
                  <h1 className="truncate font-display text-2xl font-bold text-stone-900 sm:text-3xl">
                    {itinerary?.destination || (hasAskedAi ? inferredDestination : 'Ke mana kita pergi?')}
                  </h1>
                </div>
              </div>
              {(itinerary || hasAskedAi) && (
                <div className="flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
                  <Calendar className="h-3.5 w-3.5" />
                  {itinerary
                    ? formatRangeDates(itinerary.start_date, itinerary.end_date)
                    : `Estimasi ${inferredDayCount} hari`}
                </div>
              )}
            </div>

            {/* Segmented tabs */}
            <nav
              className="flex w-full gap-1 self-start rounded-full bg-stone-100 p-1 sm:w-auto"
              aria-label="Tampilan rencana"
            >
              {WORKSPACE_TABS.map(([tab, label, Icon]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab)
                    if (tab === 'overview') setSelectedDay(null)
                  }}
                  aria-current={workspaceTab === tab ? 'page' : undefined}
                  className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition sm:flex-none ${
                    workspaceTab === tab
                      ? 'bg-white text-teal-800 shadow-sm'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {pageError && (
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
                <span>{pageError}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={retryBootstrap} className="font-semibold underline">
                    Coba lagi
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageError(null)}
                    className="grid h-8 w-8 place-items-center rounded-full hover:bg-rose-100"
                    aria-label="Tutup pesan"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Day filter chips shared by map and overview */}
            {itinerary && sortedDays.length > 1 && workspaceTab !== 'expenses' && (
              <div className="thin-scrollbar mb-4 flex items-center gap-2 overflow-x-auto pb-1">
                {[null, ...sortedDays].map((day) => (
                  <button
                    key={day ?? 'all'}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[36px] shrink-0 rounded-full border px-4 text-xs font-semibold transition ${
                      selectedDay === day
                        ? 'border-teal-700 bg-teal-700 text-white'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                    }`}
                  >
                    {day === null ? 'Semua hari' : `Hari ${day}`}
                  </button>
                ))}
              </div>
            )}

            {workspaceTab === 'map' ? (
              <TravelMap
                items={itinerary?.items || []}
                destination={inferredDestination}
                selectedDay={selectedDay}
                selectedPlace={selectedPlace}
                onSelectPlace={(item) => setSelectedPlace(item as ItineraryItem)}
                className="h-[calc(100%-3rem)] min-h-[420px] w-full"
              />
            ) : workspaceTab === 'expenses' ? (
              <ExpensesView destination={inferredDestination} items={itinerary?.items || []} dayCount={inferredDayCount} />
            ) : !itinerary ? (
              <div className="mx-auto grid max-w-2xl gap-6 py-6 sm:py-10">
                <div className="space-y-3">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                    <Compass className="h-7 w-7" />
                  </div>
                  <h2 className="font-display text-3xl font-bold text-stone-900 sm:text-4xl">
                    {hasAskedAi ? `Lanjutkan rencana ke ${inferredDestination}` : 'Ceritakan liburan impianmu.'}
                  </h2>
                  <p className="max-w-lg text-sm leading-relaxed text-stone-600 sm:text-base">
                    {hasAskedAi
                      ? `Detail perjalanan ${inferredDayCount} hari masih dibahas di chat. Begitu itinerary disimpan, jadwal harian dan peta akan muncul di sini.`
                      : 'Tulis tujuan, berapa hari, dan gaya liburanmu. Rute mencari tempat nyata di OpenStreetMap, mengecek cuaca, lalu menyusun jadwal per hari.'}
                  </p>
                </div>

                {hasAskedAi ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('chat')
                        window.setTimeout(() => inputRef.current?.focus(), 50)
                      }}
                      className="flex min-h-[44px] items-center gap-2 rounded-full bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 lg:hidden"
                    >
                      <MessageSquare className="h-4 w-4" /> Lanjut di chat
                    </button>
                    <button
                      type="button"
                      onClick={() => runStarter(`Simpan itinerary ${inferredDayCount} hari ke ${inferredDestination} sekarang`)}
                      disabled={isLoading}
                      className="flex min-h-[44px] items-center gap-2 rounded-full bg-stone-900 px-5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" /> Buatkan itinerary sekarang
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('expenses')}
                      className="flex min-h-[44px] items-center gap-2 rounded-full border border-stone-200 px-5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      <Wallet className="h-4 w-4" /> Lihat estimasi biaya
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
                    {STARTER_PROMPTS.map(({ label, hint, prompt, Icon }, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => runStarter(prompt)}
                        disabled={isLoading}
                        className={`group flex flex-col justify-between gap-3 rounded-3xl border p-5 text-left transition hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-900/5 disabled:opacity-50 ${
                          i === 0
                            ? 'border-teal-800 bg-teal-800 text-white sm:row-span-2'
                            : 'border-stone-200 bg-stone-50 text-stone-800 hover:border-stone-300'
                        }`}
                      >
                        <Icon className={`h-6 w-6 ${i === 0 ? 'text-amber-300' : 'text-amber-700'}`} />
                        <span>
                          <span className={`block font-display font-bold ${i === 0 ? 'text-2xl' : 'text-lg'}`}>{label}</span>
                          <span className={`mt-1 flex items-center gap-1 text-sm ${i === 0 ? 'text-teal-100' : 'text-stone-500'}`}>
                            {hint}
                            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-5 pb-6 2xl:flex-row">
                <div className="min-w-0 flex-1">
                  <p className="mb-3 text-xs font-semibold text-stone-500">
                    {sortedDays.length} hari · {itinerary.items.length} aktivitas · ketuk aktivitas untuk melihat di peta
                  </p>
                  <div className="thin-scrollbar flex flex-col gap-4 pb-3 sm:flex-row sm:overflow-x-auto">
                    {sortedDays
                      .filter((day) => selectedDay === null || day === selectedDay)
                      .map((day) => (
                        <DayCard
                          key={day}
                          dayNumber={day}
                          destination={itinerary.destination}
                          startDate={itinerary.start_date}
                          items={groupedItems[day] || []}
                          isActive={selectedDay === day}
                          onSelectDay={() => setSelectedDay(day)}
                          onRefineDay={refineDay}
                          onSelectPlace={(item) => setSelectedPlace(item)}
                        />
                      ))}
                  </div>
                </div>
                <div className="h-[360px] w-full shrink-0 2xl:h-auto 2xl:min-h-[520px] 2xl:w-[400px]">
                  <TravelMap
                    items={itinerary.items}
                    destination={itinerary.destination}
                    selectedDay={selectedDay}
                    selectedPlace={selectedPlace}
                    onSelectPlace={(item) => setSelectedPlace(item as ItineraryItem)}
                    className="h-full min-h-[300px] w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="z-40 flex shrink-0 items-stretch justify-around border-t border-stone-200 bg-white px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 lg:hidden"
        aria-label="Navigasi utama"
      >
        {([['chat', 'Chat', MessageSquare], ...WORKSPACE_TABS] as const).map(([tab, label, Icon]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-current={activeTab === tab ? 'page' : undefined}
            className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition ${
              activeTab === tab ? 'text-teal-800' : 'text-stone-400'
            }`}
          >
            <span
              className={`grid h-7 w-12 place-items-center rounded-full transition ${
                activeTab === tab ? 'bg-teal-100' : ''
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            {label}
            {tab === 'chat' && isLoading && activeTab !== 'chat' && (
              <span className="absolute right-[calc(50%-1.25rem)] top-1.5 h-2 w-2 animate-ping rounded-full bg-teal-600" />
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
