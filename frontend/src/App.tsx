import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import {
  Sparkles,
  Paperclip,
  ArrowUp,
  ArrowLeft,
  Square,
  RotateCcw,
  Calendar,
  MoreVertical,
  X,
  Trash2,
  Database,
  Loader2,
  Compass,
  Map as MapIcon,
  Wallet,
  MessageSquare,
  LayoutGrid,
} from 'lucide-react'
import { Markdown } from './components/Markdown'
import { createIcs } from './lib/calendar'
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
    return `${dayCount} Hari — ${s.getUTCDate()} ${monthFormatter.format(s)} - ${e.getUTCDate()} ${monthFormatter.format(e)}`
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
  const [chatProgress, setChatProgress] = useState<string | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [showPreferences, setShowPreferences] = useState(false)
  const [notices, setNotices] = useState<Notice[]>([])
  const [pageError, setPageError] = useState<string | null>(null)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
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
        if (active) setPageError(error instanceof Error ? error.message : 'Aplikasi tidak dapat dimuat.')
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
    setChatProgress('Menghubungkan ke perencana…')
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
    inputRef.current?.focus()
    if (window.innerWidth < 1024) {
      setActiveTab('chat')
    }
  }

  function startNewTrip() {
    setSelectedDay(null)
    setSelectedPlace(null)
    setInput('Rencanakan perjalanan baru ke: ')
    if (window.innerWidth < 1024) {
      setActiveTab('chat')
    } else {
      setActiveTab('overview')
    }
    window.setTimeout(() => inputRef.current?.focus(), 50)
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

  if (isBootstrapping) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-[#0c1015] px-6 text-white">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          Memuat petualanganmu bersama Rute…
        </div>
      </main>
    )
  }

  return (
    <div className="app-shell flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0c1015] text-slate-100 antialiased">
      {/* Top Navigation Bar */}
      <Navbar
        destination={itinerary?.destination || (hasAskedAi ? inferredDestination : undefined)}
        hasItinerary={Boolean(itinerary)}
        onSearch={(query) => void sendMessage(`Cari rekomendasi tempat terkait: ${query}`)}
        onExportPdf={() => window.print()}
        onExportCalendar={exportCalendar}
        onTogglePreferences={() => setShowPreferences((v) => !v)}
        onNewTrip={startNewTrip}
      />

      {/* Main App Dashboard (2-Column Layout) */}
      <div className="flex min-h-0 flex-1 overflow-hidden p-2 sm:p-4 lg:p-5 gap-4">
        {/* Left Column: AI Assistant (Chat Sidebar) */}
        <aside
          className={`flex h-full flex-col rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-[#151b23] shadow-2xl transition-all ${
            activeTab === 'chat' ? 'w-full' : 'hidden lg:flex lg:w-[380px] xl:w-[420px]'
          } shrink-0`}
        >
          {/* Chat Header */}
          <header className="flex items-center justify-between border-b border-slate-800/80 px-3.5 sm:px-4 py-3">
            <div className="flex items-center gap-2.5">
              {/* Mobile Back to Menu button in header */}
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="lg:hidden flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-[#1a222d] px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-slate-800 active:scale-95 transition"
                aria-label="Kembali ke Menu"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Menu</span>
              </button>

              {/* Bot Avatar Icon matching mockup */}
              <div className="grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white leading-none">Rute</h2>
                <p className="mt-1 text-[11px] font-medium text-slate-400">AI Travel Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {hasAskedAi && (
                <button
                  type="button"
                  onClick={() => setActiveTab('expenses')}
                  className="lg:hidden rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition"
                >
                  Cek Biaya
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPreferences((v) => !v)}
                className={`grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition ${
                  showPreferences ? 'bg-slate-800 text-white' : ''
                }`}
                title="Kelola Preferensi & Memori"
                aria-label="Pengaturan"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Preferences Memory Drawer */}
          {showPreferences && (
            <section className="border-b border-slate-800 bg-[#12161f] px-4 py-3 text-xs" aria-label="Preferensi tersimpan">
              <div className="mb-2 flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-2 font-semibold uppercase tracking-wider text-[11px]">
                  <Database className="h-3.5 w-3.5 text-emerald-400" /> Memori Preferensi
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {preferences.length === 0 ? (
                <p className="text-slate-400 text-xs">Belum ada preferensi tersimpan dari percakapan.</p>
              ) : (
                <ul className="space-y-1.5 max-h-32 overflow-y-auto thin-scrollbar pr-1">
                  {preferences.map((p) => (
                    <li
                      key={p.preference_category}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-800/60 px-2.5 py-1.5 text-slate-300"
                    >
                      <span className="truncate">
                        <strong className="text-emerald-400 capitalize">{p.preference_category.replaceAll('_', ' ')}: </strong>
                        <span>{p.preference_value}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void deletePreference(p.preference_category)}
                        className="text-slate-400 hover:text-rose-400 transition"
                        title="Hapus preferensi"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Notice alerts */}
          {notices.length > 0 && (
            <div className="px-3 pt-2 space-y-1">
              {notices.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-[11px] text-emerald-300"
                >
                  {n.message}
                </div>
              ))}
            </div>
          )}

          {/* Chat Messages Stream */}
          <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-3.5 sm:p-4" aria-live="polite">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Bot Tag */}
                {message.role === 'model' && (
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                    <div className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <Sparkles className="h-2.5 w-2.5" />
                    </div>
                    <span>Rute</span>
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[92%] sm:max-w-[88%] text-xs sm:text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'rounded-2xl rounded-tr-sm bg-emerald-600 px-4 py-2.5 text-white shadow-md'
                      : 'rounded-2xl rounded-tl-sm bg-[#1e2530] border border-slate-700/60 px-4 py-3 text-slate-200 shadow-md'
                  }`}
                >
                  {message.role === 'model' && !message.content ? (
                    <span className="flex items-center gap-2 text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      {chatProgress || 'Menyusun rute terbaik…'}
                    </span>
                  ) : message.role === 'model' ? (
                    <>
                      <Markdown content={message.content} />
                      {index === messages.length - 1 && isLoading && chatProgress && (
                        <div className="mt-2.5 flex items-center gap-2 border-t border-slate-700/60 pt-2 text-[11px] text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
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

            {/* Post-AI Question Quick Navigation Bar on Mobile */}
            {hasAskedAi && !isLoading && (
              <div className="lg:hidden pt-1 pb-2">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-emerald-300">
                    Navigasi Cepat ({inferredDestination} · {inferredDayCount} Hari):
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-400 active:scale-95 transition"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Kembali ke Menu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('map')}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#161b23] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 active:scale-95 transition"
                    >
                      <MapIcon className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Lihat Peta</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('expenses')}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#161b23] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 active:scale-95 transition"
                    >
                      <Wallet className="h-3.5 w-3.5 text-amber-400" />
                      <span>Detail Biaya</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Footer Input */}
          <footer className="border-t border-slate-800/80 p-2.5 sm:p-3 bg-[#12161f]/90 rounded-b-2xl sm:rounded-b-3xl">
            {lastFailedMessage && !isLoading && (
              <button
                type="button"
                onClick={() => void sendMessage(lastFailedMessage)}
                className="mb-2 flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:underline"
              >
                <RotateCcw className="h-3 w-3" /> Coba kirim ulang
              </button>
            )}

            <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
              <div className="flex-1 relative flex items-center rounded-2xl border border-slate-800 bg-[#161b23] px-2.5 sm:px-3 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition">
                {/* Paperclip attachment icon toggles preference memory */}
                <button
                  type="button"
                  onClick={() => setShowPreferences((v) => !v)}
                  className="text-slate-400 hover:text-slate-200 p-1.5 transition"
                  title="Kelola & lampirkan preferensi"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  disabled={isLoading}
                  maxLength={4000}
                  rows={1}
                  placeholder="Ketik pesan atau tujuan liburanmu..."
                  className="max-h-24 min-h-[42px] flex-1 resize-none bg-transparent py-2.5 px-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
                />

                {/* Send Button matching green circular button in mockup */}
                {isLoading ? (
                  <button
                    type="button"
                    onClick={cancelRequest}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-rose-600 text-white hover:bg-rose-500 transition"
                    title="Batalkan"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-md shadow-emerald-500/20"
                    title="Kirim pesan"
                  >
                    <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            </form>
          </footer>
        </aside>

        {/* Right Column: Main Dashboard Workspace */}
        <main
          className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-800/80 bg-[#151b23] shadow-2xl ${
            activeTab === 'chat' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Workspace Top Header: Destination Title & Date Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <h1 className="font-display text-xl sm:text-3xl font-extrabold tracking-tight text-white truncate">
                {itinerary?.destination
                  ? `${itinerary.destination} Adventure`
                  : hasAskedAi
                  ? `${inferredDestination} Adventure`
                  : 'Petualangan Baru'}
              </h1>

              {/* Mobile Quick AI Chat Button in Header */}
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="lg:hidden flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-400 shrink-0 active:scale-95 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Chat AI</span>
              </button>
            </div>

            {/* Date Range Badge Pill matching mockup */}
            {itinerary ? (
              <div className="flex items-center gap-2 self-start sm:self-auto rounded-xl border border-slate-800 bg-[#12161f] px-3 py-1.5 text-xs font-semibold text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>{formatRangeDates(itinerary.start_date, itinerary.end_date)}</span>
              </div>
            ) : hasAskedAi ? (
              <div className="flex items-center gap-2 self-start sm:self-auto rounded-xl border border-slate-800 bg-[#12161f] px-3 py-1.5 text-xs font-semibold text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-emerald-400" />
                <span>Estimasi {inferredDayCount} Hari · {inferredDestination}</span>
              </div>
            ) : null}
          </div>

          {/* Navigation Tabs Bar (Overview, Map, Expenses, Chat) */}
          <nav className="flex items-center border-b border-slate-800/80 px-4 sm:px-6 gap-5 sm:gap-8 overflow-x-auto thin-scrollbar">
            <button
              type="button"
              onClick={() => {
                setActiveTab('overview')
                setSelectedDay(null)
              }}
              className={`relative py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition ${
                activeTab === 'overview'
                  ? 'text-emerald-400 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-emerald-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Overview
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className={`relative py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition ${
                activeTab === 'map'
                  ? 'text-emerald-400 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-emerald-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Map
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('expenses')}
              className={`relative py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition ${
                activeTab === 'expenses'
                  ? 'text-emerald-400 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-emerald-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Expenses
            </button>

            {/* Mobile / Direct Chat tab button */}
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`lg:hidden relative py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition ${
                activeTab === 'chat'
                  ? 'text-emerald-400 after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-emerald-500'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chat AI
            </button>
          </nav>

          {/* Tab Content Display */}
          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-6">
            {pageError && (
              <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <span>{pageError}</span>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={retryBootstrap} className="font-semibold underline hover:text-white">
                    Coba lagi
                  </button>
                  <button type="button" onClick={() => setPageError(null)} aria-label="Tutup pesan">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 1. MAP TAB: Works both before and after itinerary creation */}
            {activeTab === 'map' ? (
              <div className="flex flex-col h-full min-h-[420px] sm:min-h-[550px] space-y-3 sm:space-y-4">
                {itinerary && sortedDays.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 thin-scrollbar">
                    <button
                      type="button"
                      onClick={() => setSelectedDay(null)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                        selectedDay === null
                          ? 'bg-emerald-500 text-white shadow-md'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Semua Hari
                    </button>
                    {sortedDays.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setSelectedDay(day)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                          selectedDay === day
                            ? 'bg-emerald-500 text-white shadow-md'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Hari {day}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex-1 min-h-[380px] sm:min-h-[480px]">
                  <TravelMap
                    items={itinerary?.items || []}
                    destination={inferredDestination}
                    selectedDay={selectedDay}
                    selectedPlace={selectedPlace}
                    onSelectPlace={(item) => setSelectedPlace(item as ItineraryItem)}
                    className="h-full w-full min-h-[380px] sm:min-h-[480px]"
                  />
                </div>
              </div>
            ) : activeTab === 'expenses' ? (
              /* 2. EXPENSES TAB: Detailed Cost Breakdown (Always works with itinerary or inferred trip context) */
              <ExpensesView
                destination={inferredDestination}
                items={itinerary?.items || []}
                dayCount={inferredDayCount}
              />
            ) : !itinerary ? (
              /* Empty state before trip is created (Overview without saved itinerary) */
              <div className="grid min-h-[45vh] place-items-center text-center p-4 sm:p-6">
                <div className="max-w-md space-y-4">
                  <div className="mx-auto grid h-14 w-14 sm:h-16 sm:w-16 place-items-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Compass className="h-7 w-7 sm:h-8 sm:w-8 animate-pulse" />
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                    {hasAskedAi ? `Lanjutkan Rencana ke ${inferredDestination}` : 'Rencanakan Destinasi Impianmu'}
                  </h3>
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-400">
                    {hasAskedAi
                      ? `Kamu sedang mendiskusikan perjalanan ${inferredDayCount} hari ke ${inferredDestination}. Buka Chat AI untuk menyelesaikan detail atau cek tab Expenses & Map sekarang.`
                      : 'Ketik tujuan, durasi liburan, dan preferensimu di panel Chat AI. Rute akan mencari lokasi nyata, menyusun jadwal harian, peta Google Maps, dan detail biaya.'}
                  </p>

                  {hasAskedAi && (
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('chat')}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-400 transition"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Buka Percakapan AI</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('expenses')}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-[#161b23] px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-slate-800 transition"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        <span>Lihat Detail Biaya ({inferredDestination})</span>
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {[
                      {
                        label: 'Labuan Bajo 5 hari 4 malam + sewa motor',
                        prompt:
                          'Buatkan langsung itinerary 5 hari 4 malam di Labuan Bajo mulai minggu depan, lengkap tempat wisata, makan 3x sehari, dan sewa motor',
                      },
                      {
                        label: 'Liburan 3 hari ke Bali',
                        prompt: 'Buatkan itinerary liburan 3 hari ke Bali minggu depan, suka pantai dan kuliner, budget menengah',
                      },
                      {
                        label: 'Wisata kuliner 2 hari di Bandung',
                        prompt: 'Buatkan itinerary wisata kuliner dan alam 2 hari di Bandung akhir pekan depan, budget hemat',
                      },
                    ].map(({ label, prompt }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          if (window.innerWidth < 1024) setActiveTab('chat')
                          void sendMessage(prompt)
                        }}
                        className="rounded-xl border border-slate-800 bg-[#161b23] px-3 py-2 text-xs text-slate-300 hover:border-emerald-500 hover:text-emerald-400 transition"
                      >
                        {label} &rarr;
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* 3. OVERVIEW TAB: Responsive Day Cards + Map Preview */
              <div className="flex flex-col 2xl:flex-row gap-5 sm:gap-6 h-full min-h-[520px] pb-6">
                {/* Left/Center: Day Cards List (Vertical stack on mobile, horizontal scroll on tablet/desktop) */}
                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Jadwal Harian ({sortedDays.length} Hari)
                    </span>
                    {selectedDay && (
                      <button
                        type="button"
                        onClick={() => setSelectedDay(null)}
                        className="text-xs text-emerald-400 hover:underline"
                      >
                        Tampilkan semua hari di peta
                      </button>
                    )}
                  </div>

                  {/* Cards List */}
                  <div className="flex flex-col sm:flex-row gap-4 sm:overflow-x-auto pb-4 pt-1 thin-scrollbar">
                    {sortedDays.map((day) => (
                      <div
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`cursor-pointer transition-all ${
                          selectedDay === day ? 'ring-2 ring-emerald-500 rounded-2xl scale-[1.01]' : ''
                        }`}
                      >
                        <DayCard
                          dayNumber={day}
                          destination={itinerary.destination}
                          startDate={itinerary.start_date}
                          items={groupedItems[day] || []}
                          onRefineDay={refineDay}
                          onSelectPlace={(item) => setSelectedPlace(item)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Map Preview Widget */}
                <div className="w-full 2xl:w-[380px] xl:w-[420px] h-[340px] 2xl:h-full min-h-[300px] shrink-0">
                  <TravelMap
                    items={itinerary.items}
                    destination={itinerary.destination}
                    selectedDay={selectedDay}
                    selectedPlace={selectedPlace}
                    onSelectPlace={(item) => setSelectedPlace(item as ItineraryItem)}
                    className="h-full w-full min-h-[300px]"
                  />
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Persistent Mobile Bottom Navigation Bar (< 1024px) */}
      <nav
        className="lg:hidden flex items-center justify-around border-t border-slate-800/90 bg-[#0d1117]/95 px-2 py-1.5 backdrop-blur-md shrink-0 z-40"
        aria-label="Navigasi Utama Mobile"
      >
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition ${
            activeTab === 'overview' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          <span>Menu / Jadwal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('map')}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition ${
            activeTab === 'map' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapIcon className="h-4 w-4" />
          <span>Peta Rute</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition ${
            activeTab === 'expenses' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>Detail Biaya</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`relative flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition ${
            activeTab === 'chat' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Chat AI</span>
          {isLoading && (
            <span className="absolute top-1.5 right-6 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>
      </nav>
    </div>
  )
}
