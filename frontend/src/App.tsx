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
  FileText,
  Download,
  Share2,
  CheckSquare,
  Sunset,
  Bike,
  Luggage,
  HelpCircle,
} from 'lucide-react'
import { Markdown } from './components/Markdown'
import { createIcs } from './lib/calendar'
import { openOrDownloadTravelReport } from './lib/travelReport'
import { readSse } from './lib/sse'
import { Navbar } from './components/Navbar'
import { AuthModal } from './components/AuthModal'
import { DayCard } from './components/DayCard'
import { TravelMap } from './components/TravelMap'
import { ExpensesView } from './components/ExpensesView'
import { PackingListModal } from './components/PackingListModal'
import { TutorialModal } from './components/TutorialModal'
import { SpotlightTour } from './components/SpotlightTour'
import type { ItineraryItem } from './components/DayCard'
import { useLanguage, dictionaries } from './lib/i18n'

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
const AUTH_TOKEN_KEY = 'travel_auth_token'
const INITIAL_GREETING =
  'Halo! Mau liburan ke mana kali ini? Sebutkan destinasi (misal: Bali, Bandung, Labuan Bajo), durasi hari, dan gaya traveling favoritmu. Rute akan menyusun itinerary lengkap beserta peta dan perkiraan anggarannya!'

const isInitialGreeting = (content: string) =>
  content === INITIAL_GREETING || content === dictionaries.id.greeting || content === dictionaries.en.greeting

type Message = { role: 'user' | 'model'; content: string }
type Credentials = { sessionId: string; token: string }
type User = { id: string; email: string; display_name: string }
type TripSummary = {
  session_id: string
  destination: string
  start_date: string
  end_date: string
  created_at: number
}
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

function storedAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || null
  } catch {
    return null
  }
}

function persistAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token)
    else localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    // Ignore storage errors
  }
}

async function apiRequest<T>(path: string, credentials?: Credentials, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (credentials && credentials.token) headers.set('X-Session-Token', credentials.token)
  // A signed-in account can access its own sessions with the auth token, so always
  // attach it when present. The backend accepts either token.
  const authToken = storedAuthToken()
  if (authToken) headers.set('X-Auth-Token', authToken)
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
    return `${dayCount} Hari · ${s.getUTCDate()} ${monthFormatter.format(s)} – ${e.getUTCDate()} ${monthFormatter.format(e)}`
  } catch {
    return `${start} - ${end}`
  }
}

function shareToWhatsApp(
  destination: string,
  startDate?: string,
  endDate?: string,
  items: ItineraryItem[] = [],
  dayCount: number = 3,
) {
  let text = `🌴 *Rencana Liburan ke ${destination} (${dayCount} Hari)*\n`
  if (startDate && endDate) {
    text += `📅 Periode: ${startDate} s/d ${endDate}\n`
  }
  text += `\n✨ *Ringkasan Rute Harian:*\n`

  const grouped = items.reduce<Record<number, ItineraryItem[]>>((acc, it) => {
    acc[it.day_number] = acc[it.day_number] || []
    acc[it.day_number].push(it)
    return acc
  }, {})

  const days = Object.keys(grouped).map(Number).sort((a, b) => a - b)
  if (days.length > 0) {
    for (const d of days) {
      const dayItems = grouped[d] || []
      const stops = dayItems.map((it) => it.title).slice(0, 3).join(' ➔ ')
      text += `• *Hari ke-${d}:* ${stops}${dayItems.length > 3 ? '...' : ''}\n`
    }
  } else {
    text += `• Eksplorasi destinasi terbaik di ${destination}\n`
  }

  text += `\n🗺️ Disusun otomatis oleh AI Travel Planner (Rute):\n`
  text += `https://ai-travel-chatbot-gamma.vercel.app`
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noreferrer')
}

export default function App() {
  const { lang, t } = useLanguage()
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  const starterPrompts = [
    {
      label: t('starter1Label'),
      hint: t('starter1Hint'),
      prompt: t('starter1Prompt'),
      Icon: Waves,
    },
    {
      label: t('starter2Label'),
      hint: t('starter2Hint'),
      prompt: t('starter2Prompt'),
      Icon: Mountain,
    },
    {
      label: t('starter3Label'),
      hint: t('starter3Hint'),
      prompt: t('starter3Prompt'),
      Icon: UtensilsCrossed,
    },
  ]

  const workspaceTabs = [
    ['overview', t('workspaceSchedule'), LayoutGrid],
    ['map', t('workspaceMap'), MapIcon],
    ['expenses', t('workspaceExpenses'), Wallet],
  ] as const
  const [messages, setMessages] = useState<Message[]>([{ role: 'model', content: INITIAL_GREETING }])
  const [input, setInput] = useState('')
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [chatProgress, setChatProgress] = useState<string | null>(null)
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [showPreferences, setShowPreferences] = useState(false)
  const [isPackingModalOpen, setIsPackingModalOpen] = useState(false)
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false)
  const [hasSeenTutorial, setHasSeenTutorial] = useState(() => {
    try {
      return Boolean(localStorage.getItem('rute_has_seen_tutorial'))
    } catch {
      return false
    }
  })
  const [notices, setNotices] = useState<Notice[]>([])
  const [pageError, setPageError] = useState<string | null>(null)
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null)
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0)
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<ItineraryItem | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [trips, setTrips] = useState<TripSummary[] | null>(null)
  const [showTrips, setShowTrips] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    try {
      const saved = localStorage.getItem('rute_theme_preference')
      if (saved === 'dark' || saved === 'light') return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0c0f12')
    } else {
      root.classList.remove('dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#faf8f4')
    }
    try {
      localStorage.setItem('rute_theme_preference', theme)
    } catch {
      // Ignore storage errors
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

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

        // Restore the signed-in account if a valid auth token is still stored.
        if (storedAuthToken()) {
          try {
            const me = await apiRequest<ApiEnvelope<{ user: User }>>('/auth/me', session)
            if (active) setUser(me.data.user)
          } catch (error) {
            if (error instanceof ApiError && error.status === 401) persistAuthToken(null)
          }
        }
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
    const priorHistory = messages.filter((m) => !isInitialGreeting(m.content) && m.content.trim())
    setInput('')
    setPageError(null)
    setLastFailedMessage(null)
    setChatProgress(lang === 'id' ? 'Menghubungkan ke perencana...' : 'Connecting to planner...')
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

      const chatHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (activeSession.token) chatHeaders['X-Session-Token'] = activeSession.token
      const authToken = storedAuthToken()
      if (authToken) chatHeaders['X-Auth-Token'] = authToken

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: chatHeaders,
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

  // Reload session-scoped data after an auth change so account preferences/itinerary show up.
  async function reloadSessionData(session: Credentials) {
    try {
      const [historyResult, itineraryResult, preferenceResult] = await Promise.all([
        apiRequest<ApiEnvelope<Message[]>>(`/history/${session.sessionId}`, session),
        apiRequest<ApiEnvelope<Itinerary | null>>(`/itinerary/${session.sessionId}`, session),
        apiRequest<ApiEnvelope<Preference[]>>(`/preferences/${session.sessionId}`, session),
      ])
      if (historyResult.data.length) setMessages(historyResult.data)
      if (itineraryResult.data) setItinerary(itineraryResult.data)
      setPreferences(preferenceResult.data)
    } catch {
      // Non-fatal: the UI keeps its current state if a refresh fails.
    }
  }

  async function submitAuth(mode: 'login' | 'register', email: string, password: string): Promise<string | null> {
    if (!credentials) return 'Sesi belum siap. Muat ulang halaman lalu coba lagi.'
    try {
      const result = await apiRequest<ApiEnvelope<{ user: User; auth_token: string }>>(
        `/auth/${mode}`,
        credentials,
        { method: 'POST', body: JSON.stringify({ session_id: credentials.sessionId, email, password }) },
      )
      persistAuthToken(result.data.auth_token)
      setUser(result.data.user)
      setShowAuth(false)
      setTrips(null)
      await reloadSessionData(credentials)
      addNotice(mode === 'register' ? 'Akun dibuat. Preferensimu kini tersimpan di akun.' : `Selamat datang kembali, ${result.data.user.display_name}.`)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.'
    }
  }

  async function logout() {
    try {
      await apiRequest('/auth/logout', credentials ?? undefined, { method: 'POST' })
    } catch {
      // Ignore: clear local auth regardless of the network result.
    }
    persistAuthToken(null)
    setUser(null)
    setTrips(null)
    setShowTrips(false)
    addNotice('Kamu telah keluar. Sesi ini kembali anonim.')
  }

  async function loadTrips() {
    setShowTrips(true)
    try {
      const result = await apiRequest<ApiEnvelope<TripSummary[]>>('/trips', credentials ?? undefined)
      setTrips(result.data)
    } catch (error) {
      setTrips([])
      setPageError(error instanceof Error ? error.message : 'Gagal memuat perjalanan.')
    }
  }

  // Switch to one of the account's saved trips. Access is authorized by the auth token,
  // so the per-session token can stay empty.
  async function openTrip(sessionId: string) {
    if (!user) return
    const session: Credentials = { sessionId, token: '' }
    setShowTrips(false)
    setSelectedDay(null)
    setSelectedPlace(null)
    setCredentials(session)
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    localStorage.setItem(LEGACY_SESSION_KEY, sessionId)
    try {
      const [historyResult, itineraryResult, preferenceResult] = await Promise.all([
        apiRequest<ApiEnvelope<Message[]>>(`/history/${sessionId}`, session),
        apiRequest<ApiEnvelope<Itinerary | null>>(`/itinerary/${sessionId}`, session),
        apiRequest<ApiEnvelope<Preference[]>>(`/preferences/${sessionId}`, session),
      ])
      setMessages(historyResult.data.length ? historyResult.data : [{ role: 'model', content: INITIAL_GREETING }])
      setItinerary(itineraryResult.data ?? null)
      setPreferences(preferenceResult.data)
      setActiveTab('chat')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Perjalanan tidak dapat dibuka.')
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
      .find((m) => m.role === 'model' && !isInitialGreeting(m.content) && m.content.trim())?.content
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
      <main className="grid min-h-[100dvh] place-items-center bg-[#faf8f4] dark:bg-[#0c0f12] px-6 transition-colors duration-200">
        <div className="flex items-center gap-3 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm text-stone-600 shadow-sm dark:border-stone-800 dark:bg-[#141920] dark:text-stone-300">
          <Loader2 className="h-5 w-5 animate-spin text-teal-700 dark:text-teal-400" />
          Menyiapkan perjalananmu…
        </div>
      </main>
    )
  }

  return (
    <div className="app-shell flex h-[100dvh] w-full flex-col overflow-hidden bg-[#faf8f4] text-stone-800 antialiased dark:bg-[#0c0f12] dark:text-stone-100 transition-colors duration-200">
      <Navbar
        destination={itinerary?.destination || (hasAskedAi ? inferredDestination : undefined)}
        hasItinerary={Boolean(itinerary) || hasAskedAi}
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSearch={(query) => {
          setActiveTab('chat')
          void sendMessage(`Cari rekomendasi tempat terkait: ${query}`)
        }}
        onExportPdf={handleExportReport}
        onExportCalendar={exportCalendar}
        onShareWhatsApp={() =>
          shareToWhatsApp(
            itinerary?.destination || inferredDestination,
            itinerary?.start_date,
            itinerary?.end_date,
            itinerary?.items || [],
            inferredDayCount,
          )
        }
        onOpenPackingList={() => setIsPackingModalOpen(true)}
        onTogglePreferences={() => {
          setActiveTab('chat')
          setShowPreferences((v) => !v)
        }}
        onNewTrip={startNewTrip}
        onNewSession={startNewSession}
        onOpenAuth={() => setShowAuth(true)}
        onLogout={() => void logout()}
        onOpenTrips={() => void loadTrips()}
        onOpenTutorial={() => setIsTutorialOpen(true)}
        onOpenSpotlight={() => setIsSpotlightOpen(true)}
        isStartingSession={isStartingSession}
      />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-2 sm:p-4 lg:p-5">
        {/* ───────── Chat panel ───────── */}
        <aside
          className={`min-h-0 flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm shadow-stone-900/[0.03] dark:border-stone-800/80 dark:bg-[#141920] dark:shadow-black/20 ${
            activeTab === 'chat' ? 'flex w-full' : 'hidden'
          } lg:flex lg:w-[400px] lg:shrink-0 xl:w-[440px] transition-colors duration-200`}
        >
          <header className="flex items-center justify-between border-b border-stone-100 px-3.5 sm:px-4 py-3 gap-2 dark:border-stone-800/80">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile Back to Menu / Jadwal button */}
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="lg:hidden flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-100 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-200 active:scale-95 transition shrink-0 dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-200 dark:hover:bg-[#222c3a]"
                aria-label={t('menuBtnAria')}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{t('menuBtn')}</span>
              </button>

              <div className="relative grid h-9 w-9 sm:h-10 sm:w-10 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-[#141920]" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold leading-none text-stone-900 dark:text-stone-100 truncate">{t('assistantTitle')}</h2>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 truncate">
                  {isLoading ? t('assistantSubtitleDrafting') : t('assistantSubtitleReady')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {hasAskedAi && (
                <button
                  type="button"
                  onClick={handleExportReport}
                  className="lg:hidden flex items-center gap-1 rounded-xl bg-teal-50 border border-teal-600/30 px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 active:scale-95 transition dark:bg-teal-950/40 dark:border-teal-700/50 dark:text-teal-300 dark:hover:bg-teal-900/40"
                  title={t('reportBtnTitle')}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>{t('reportBtn')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowPreferences((v) => !v)}
                aria-expanded={showPreferences}
                className={`flex min-h-[36px] sm:min-h-[40px] items-center gap-1.5 rounded-full px-2.5 sm:px-3 text-xs font-semibold transition ${
                  showPreferences
                    ? 'bg-teal-700 text-white dark:bg-teal-600'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-[#1a212b] dark:text-stone-300 dark:hover:bg-[#242e3b]'
                }`}
                title={t('memoryTitle')}
              >
                <Database className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('memoryBtn')}</span>{preferences.length > 0 ? ` · ${preferences.length}` : ''}
              </button>
            </div>
          </header>

          {showPreferences && (
            <section className="animate-rise border-b border-stone-100 bg-stone-50/80 px-4 py-3 dark:border-stone-800 dark:bg-[#18202a]" aria-label={t('savedPreferences')}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">{t('memoryHeader')}</p>
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  className="grid h-8 w-8 place-items-center rounded-full text-stone-400 hover:bg-stone-200 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                  aria-label="Tutup memori"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {preferences.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {t('memoryEmpty')}
                </p>
              ) : (
                <ul className="thin-scrollbar flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                  {preferences.map((p) => (
                    <li
                      key={p.preference_category}
                      className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white py-1 pl-3 pr-1 text-xs text-stone-700 dark:border-stone-700 dark:bg-[#141920] dark:text-stone-200"
                    >
                      <span className="font-semibold capitalize text-teal-800 dark:text-teal-400">
                        {p.preference_category.replaceAll('_', ' ')}:
                      </span>
                      <span className="max-w-[160px] truncate">{p.preference_value}</span>
                      <button
                        type="button"
                        onClick={() => void deletePreference(p.preference_category)}
                        className="grid h-6 w-6 place-items-center rounded-full text-stone-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
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
                  className="animate-rise flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border dark:border-emerald-800/40"
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
                  <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-700 text-white shadow-xs">
                    <Route className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'rounded-3xl rounded-br-md bg-teal-700 px-4 py-2.5 text-white dark:bg-teal-600'
                      : 'rounded-3xl rounded-tl-md bg-stone-100 px-4 py-3 text-stone-800 dark:bg-[#1a212b] dark:text-stone-100 dark:border dark:border-stone-800/80'
                  }`}
                >
                  {message.role === 'model' && !message.content ? (
                    <span className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
                      <span className="flex gap-1" aria-hidden="true">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-600 [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-600 [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-600" />
                      </span>
                      {chatProgress || (lang === 'id' ? 'Menyusun rute terbaik…' : 'Finding the best route…')}
                    </span>
                  ) : message.role === 'model' ? (
                    <>
                      <Markdown content={index === 0 && isInitialGreeting(message.content) ? t('greeting') : message.content} />
                      {index === messages.length - 1 && isLoading && chatProgress && (
                        <div className="mt-2.5 flex items-center gap-2 border-t border-stone-200 dark:border-stone-800 pt-2 text-xs text-stone-500 dark:text-stone-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700 dark:text-teal-400" />
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
                {!hasSeenTutorial && (
                  <div className="mb-2.5 flex items-center justify-between gap-2 rounded-2xl border border-teal-200/80 bg-teal-50/70 p-2.5 sm:p-3 text-xs text-teal-900 dark:border-teal-800/60 dark:bg-teal-950/40 dark:text-teal-200">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                      <span className="font-medium">{t('newToRute')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsTutorialOpen(true)}
                      className="shrink-0 font-bold underline decoration-teal-700 underline-offset-2 hover:text-teal-800 dark:decoration-teal-400 dark:hover:text-teal-300"
                    >
                      {t('openGuideBtn')}
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">{t('tryStartingWith')}</p>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSpotlightOpen(true)}
                      className="flex items-center gap-1 rounded-full bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 text-[11px] font-bold text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900/50 border border-teal-200/80 dark:border-teal-800/60 transition shadow-xs active:scale-95"
                      title={t('interactiveTourTitle')}
                    >
                      <Sparkles className="h-3 w-3 text-amber-500" />
                      <span>{t('interactiveTourBtn')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTutorialOpen(true)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-stone-600 dark:text-stone-300 hover:text-teal-800 dark:hover:text-teal-300 transition"
                      title={t('guideTitle')}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>{t('guide')}</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {starterPrompts.map(({ label, hint, prompt, Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => runStarter(prompt)}
                      className="group flex min-h-[52px] items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-left transition hover:-translate-y-0.5 hover:border-teal-600/40 hover:shadow-md hover:shadow-stone-900/5 active:translate-y-0 dark:border-stone-800 dark:bg-[#18202a] dark:hover:border-teal-500/50"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 transition group-hover:bg-teal-50 group-hover:text-teal-700 dark:bg-amber-950/40 dark:text-amber-300 dark:group-hover:bg-teal-950/50 dark:group-hover:text-teal-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-stone-800 dark:text-stone-100">{label}</span>
                        <span className="block text-xs text-stone-500 dark:text-stone-400">{hint}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-teal-700 dark:text-stone-600 dark:group-hover:text-teal-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Petunjuk Laporan & Dokumen Perjalanan setelah AI selesai menyusun itinerary */}
            {hasAskedAi && !isLoading && (
              <div className="animate-rise rounded-2xl border border-teal-600/30 bg-teal-50/70 p-3.5 shadow-sm space-y-3 dark:border-teal-800/60 dark:bg-teal-950/40">
                <div className="flex items-start gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-teal-700 text-white shadow-sm">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 uppercase tracking-wide dark:bg-teal-900/60 dark:text-teal-300">
                        <CheckCircle2 className="h-3 w-3" /> {t('tripReadyBadge')}
                      </span>
                      <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                        {t('tripReadyTitle', { dest: inferredDestination, days: inferredDayCount })}
                      </h3>
                    </div>
                    <p className="mt-1 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                      {t('tripReadyDesc')}
                    </p>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExportReport}
                    className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-800 active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" />
                    <span>{t('btnFullReport')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      shareToWhatsApp(
                        itinerary?.destination || inferredDestination,
                        itinerary?.start_date,
                        itinerary?.end_date,
                        itinerary?.items || [],
                        inferredDayCount,
                      )
                    }
                    className="flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
                    title={t('shareWaTitle')}
                  >
                    <Share2 className="h-4 w-4" />
                    <span>{t('btnShareWa')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPackingModalOpen(true)}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 active:scale-[0.98] dark:border-stone-800 dark:bg-[#141920] dark:text-stone-200 dark:hover:bg-[#1c232d]"
                    title={t('packingTitle')}
                  >
                    <CheckSquare className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                    <span>{t('btnPackingList')}</span>
                  </button>
                  {itinerary && (
                    <button
                      type="button"
                      onClick={exportCalendar}
                      className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 active:scale-[0.98] dark:border-stone-800 dark:bg-[#141920] dark:text-stone-200 dark:hover:bg-[#1c232d]"
                      title={t('calendarTitle')}
                    >
                      <Calendar className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                      <span>{t('btnCalendar')}</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick Reply Suggestions */}
            {hasAskedAi && !isLoading && (
              <div className="animate-rise space-y-1.5 pt-1">
                <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" /> {t('followupTitle')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { text: t('qCulinary'), Icon: UtensilsCrossed, isPacking: false },
                    { text: t('qTransport'), Icon: Bike, isPacking: false },
                    { text: t('qSunset'), Icon: Sunset, isPacking: false },
                    { text: t('qPacking'), Icon: Luggage, isPacking: true },
                  ].map(({ text, Icon, isPacking }) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => {
                        if (isPacking) {
                          setIsPackingModalOpen(true)
                        } else {
                          void sendMessage(text)
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-full border border-stone-200/90 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:border-teal-700/40 hover:bg-teal-50/70 hover:text-teal-900 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-teal-700 shadow-xs dark:border-stone-800 dark:bg-[#18202a] dark:text-stone-300 dark:hover:border-teal-600/50 dark:hover:bg-teal-950/40 dark:hover:text-teal-200"
                    >
                      <Icon className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
                      <span>{text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Composer */}
          <footer className="border-t border-stone-100 dark:border-stone-800/80 p-3">
            {lastFailedMessage && !isLoading && (
              <button
                type="button"
                onClick={() => void sendMessage(lastFailedMessage)}
                className="mb-2 flex min-h-[40px] items-center gap-1.5 rounded-full bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60"
              >
                <RotateCcw className="h-4 w-4" /> {lang === 'id' ? 'Coba kirim ulang' : 'Retry sending'}
              </button>
            )}
            <form
              data-tour="chat-composer"
              onSubmit={handleSubmit}
              className="flex items-end gap-2 rounded-2xl border border-stone-200 bg-stone-50/80 p-1.5 transition focus-within:border-teal-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-700/20 dark:border-stone-800 dark:bg-[#1a212b] dark:focus-within:bg-[#141920] dark:focus-within:border-teal-500"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={isLoading}
                maxLength={4000}
                rows={1}
                aria-label={lang === 'id' ? 'Pesan untuk Rute' : 'Message for Rute'}
                placeholder={t('chatPlaceholder')}
                className="max-h-28 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-base text-stone-800 placeholder:text-stone-400 focus:outline-none disabled:opacity-60 sm:text-sm dark:text-stone-100 dark:placeholder:text-stone-500"
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={cancelRequest}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-stone-800 text-white transition hover:bg-stone-900 dark:bg-stone-700 dark:hover:bg-stone-600"
                  title={lang === 'id' ? 'Hentikan' : 'Stop'}
                  aria-label={lang === 'id' ? 'Hentikan' : 'Stop'}
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-teal-700 text-white shadow-sm transition hover:bg-teal-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-300 dark:disabled:bg-stone-800 dark:disabled:text-stone-600"
                  title={lang === 'id' ? 'Kirim pesan' : 'Send message'}
                  aria-label={lang === 'id' ? 'Kirim pesan' : 'Send message'}
                >
                  <ArrowUp className="h-5 w-5 stroke-[2.5]" />
                </button>
              )}
            </form>
            <p className="mt-1.5 hidden px-2 text-[11px] text-stone-400 dark:text-stone-500 sm:block">
              {lang === 'id'
                ? 'Enter untuk kirim · Shift+Enter baris baru · Verifikasi harga & jam buka sebelum berangkat'
                : 'Enter to send · Shift+Enter for new line · Verify tickets & hours before departure'}
            </p>
          </footer>
        </aside>

        {/* ───────── Workspace panel ───────── */}
        <main
          className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm shadow-stone-900/[0.03] dark:border-stone-800/90 dark:bg-[#141920] ${
            activeTab === 'chat' ? 'hidden' : 'flex'
          } lg:flex`}
        >
          <div className="flex flex-col gap-3 border-b border-stone-100 dark:border-stone-800/80 px-4 pb-3 pt-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800/60 lg:hidden"
                  aria-label={lang === 'id' ? 'Kembali ke chat' : 'Back to chat'}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate font-display text-2xl font-bold text-stone-900 dark:text-stone-100 sm:text-3xl">
                      {itinerary?.destination || (hasAskedAi ? inferredDestination : t('workspaceTitleDefault'))}
                    </h1>
                    {itinerary && (
                      <span className="hidden sm:inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-700/40">
                        {t('savedBadge')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                    {itinerary
                      ? t('explorationDays', { days: sortedDays.length })
                      : hasAskedAi
                        ? (lang === 'id' ? 'Draf rencana dari asisten AI' : 'Draft plan from AI assistant')
                        : t('workspaceSubtitleDefault')}
                  </p>
                </div>
              </div>
              {(itinerary || hasAskedAi) && (
                <div className="flex items-center gap-2 rounded-full bg-stone-100 dark:bg-[#1a212b] px-3 py-1.5 text-xs font-semibold text-stone-600 dark:text-stone-300">
                  <Calendar className="h-3.5 w-3.5" />
                  {itinerary
                    ? formatRangeDates(itinerary.start_date, itinerary.end_date)
                    : (lang === 'id' ? `Estimasi ${inferredDayCount} hari` : `Estimated ${inferredDayCount} days`)}
                </div>
              )}
            </div>

            {/* Segmented tabs */}
            <nav
              data-tour="workspace-tabs"
              className="flex w-full gap-1 self-start rounded-full bg-stone-100 dark:bg-[#1a212b] p-1 sm:w-auto"
              aria-label={lang === 'id' ? 'Tampilan rencana' : 'Plan view'}
            >
              {workspaceTabs.map(([tab, label, Icon]) => (
                <button
                  key={tab}
                  type="button"
                  data-tour={tab === 'expenses' ? 'tab-expenses' : tab === 'map' ? 'tab-map' : undefined}
                  onClick={() => {
                    setActiveTab(tab)
                    if (tab === 'overview') setSelectedDay(null)
                  }}
                  aria-current={workspaceTab === tab ? 'page' : undefined}
                  className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition sm:flex-none ${
                    workspaceTab === tab
                      ? 'bg-white text-teal-800 shadow-sm dark:bg-[#141920] dark:text-teal-300 dark:shadow-none'
                      : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200'
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
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
                <span>{pageError}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={retryBootstrap} className="font-semibold underline">
                    Coba lagi
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageError(null)}
                    className="grid h-8 w-8 place-items-center rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/40"
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
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-300 dark:hover:border-stone-700'
                    }`}
                  >
                    {day === null ? t('allDays') : t('dayNumber', { num: day })}
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
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <Compass className="h-7 w-7" />
                  </div>
                  <h2 className="font-display text-3xl font-bold text-stone-900 dark:text-stone-100 sm:text-4xl">
                    {hasAskedAi
                      ? (lang === 'id' ? `Lanjutkan rencana ke ${inferredDestination}` : `Continue planning for ${inferredDestination}`)
                      : t('emptyTitle')}
                  </h2>
                  <p className="max-w-lg text-sm leading-relaxed text-stone-600 dark:text-stone-400 sm:text-base">
                    {hasAskedAi
                      ? (lang === 'id'
                          ? `Detail perjalanan ${inferredDayCount} hari masih dibahas di chat. Begitu itinerary disimpan, jadwal harian dan peta akan muncul di sini.`
                          : `Travel details for ${inferredDayCount} days are still being discussed in chat. Once saved, the daily schedule and map will appear here.`)
                      : t('emptyDesc')}
                  </p>
                  {!hasAskedAi && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setIsTutorialOpen(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 underline decoration-teal-700/60 dark:decoration-teal-400/60 underline-offset-4 transition"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>{t('emptyGuideLink')}</span>
                      </button>
                    </div>
                  )}
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
                      <MessageSquare className="h-4 w-4" /> {lang === 'id' ? 'Lanjut di chat' : 'Continue in chat'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runStarter(
                          lang === 'id'
                            ? `Simpan itinerary ${inferredDayCount} hari ke ${inferredDestination} sekarang`
                            : `Save ${inferredDayCount}-day itinerary to ${inferredDestination} now`
                        )
                      }
                      disabled={isLoading}
                      className="flex min-h-[44px] items-center gap-2 rounded-full bg-stone-900 dark:bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-stone-800 dark:hover:bg-teal-800 disabled:opacity-50"
                    >
                      <Sparkles className="h-4 w-4" /> {lang === 'id' ? 'Buatkan itinerary sekarang' : 'Generate itinerary now'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('expenses')}
                      className="flex min-h-[44px] items-center gap-2 rounded-full border border-stone-200 px-5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800/50"
                    >
                      <Wallet className="h-4 w-4" /> {lang === 'id' ? 'Lihat estimasi biaya' : 'View cost estimates'}
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
                    {starterPrompts.map(({ label, hint, prompt, Icon }, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => runStarter(prompt)}
                        disabled={isLoading}
                        className={`group flex flex-col justify-between gap-3 rounded-3xl border p-5 text-left transition hover:-translate-y-1 hover:shadow-lg hover:shadow-stone-900/5 disabled:opacity-50 ${
                          i === 0
                            ? 'border-teal-800 bg-teal-800 text-white dark:border-teal-700 dark:bg-teal-900/60'
                            : 'border-stone-200 bg-stone-50 text-stone-800 hover:border-stone-300 dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-100 dark:hover:border-stone-700'
                        }`}
                      >
                        <Icon className={`h-6 w-6 ${i === 0 ? 'text-amber-300' : 'text-amber-700 dark:text-amber-400'}`} />
                        <span>
                          <span className={`block font-display font-bold ${i === 0 ? 'text-2xl' : 'text-lg'}`}>{label}</span>
                          <span className={`mt-1 flex items-center gap-1 text-sm ${i === 0 ? 'text-teal-100' : 'text-stone-500 dark:text-stone-400'}`}>
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
              selectedDay === null ? (
                <div className="space-y-4 pb-8">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-stone-500 dark:text-stone-400">
                    <p>
                      {t('dayActivitiesCount', { days: sortedDays.length, activities: itinerary.items.length })}
                    </p>
                    <p className="hidden text-stone-400 dark:text-stone-500 sm:block">
                      {t('clickCardHint')}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {sortedDays.map((day) => (
                      <DayCard
                        key={day}
                        dayNumber={day}
                        destination={itinerary.destination}
                        startDate={itinerary.start_date}
                        items={groupedItems[day] || []}
                        isActive={false}
                        onSelectDay={() => setSelectedDay(day)}
                        onRefineDay={refineDay}
                        onSelectPlace={(item) => {
                          setSelectedDay(day)
                          setSelectedPlace(item)
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 items-start gap-6 pb-8 lg:grid-cols-[380px_1fr]">
                  <div className="min-w-0">
                    <div className="mb-3 flex items-center justify-between text-xs font-semibold text-stone-500 dark:text-stone-400">
                      <span>
                        {lang === 'id'
                          ? `Fokus: Hari ${selectedDay} (${groupedItems[selectedDay]?.length || 0} aktivitas)`
                          : `Focus: Day ${selectedDay} (${groupedItems[selectedDay]?.length || 0} activities)`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedDay(null)}
                        className="font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 underline"
                      >
                        {lang === 'id' ? 'Lihat semua hari' : 'View all days'}
                      </button>
                    </div>
                    <DayCard
                      key={selectedDay}
                      dayNumber={selectedDay}
                      destination={itinerary.destination}
                      startDate={itinerary.start_date}
                      items={groupedItems[selectedDay] || []}
                      isActive={true}
                      onSelectDay={() => setSelectedDay(null)}
                      onRefineDay={refineDay}
                      onSelectPlace={(item) => setSelectedPlace(item)}
                    />
                  </div>
                  <div className="sticky top-0 h-[480px] w-full overflow-hidden rounded-2xl border border-stone-200/80 dark:border-stone-800/90 shadow-sm lg:h-[620px]">
                    <TravelMap
                      items={groupedItems[selectedDay] || itinerary.items}
                      destination={itinerary.destination}
                      selectedDay={selectedDay}
                      selectedPlace={selectedPlace}
                      onSelectPlace={(item) => setSelectedPlace(item as ItineraryItem)}
                      className="h-full w-full"
                    />
                  </div>
                </div>
              )
            )}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="z-40 flex shrink-0 items-stretch justify-around border-t border-stone-200 bg-white dark:border-stone-800 dark:bg-[#141920] px-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 lg:hidden"
        aria-label={lang === 'id' ? 'Navigasi utama' : 'Main navigation'}
      >
        {([['chat', 'Chat', MessageSquare], ...workspaceTabs] as const).map(([tab, label, Icon]) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            aria-current={activeTab === tab ? 'page' : undefined}
            className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition ${
              activeTab === tab ? 'text-teal-800 dark:text-teal-300' : 'text-stone-400 dark:text-stone-500'
            }`}
          >
            <span
              className={`grid h-7 w-12 place-items-center rounded-full transition ${
                activeTab === tab ? 'bg-teal-100 dark:bg-teal-950/60' : ''
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

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} onSubmit={submitAuth} />}

      <PackingListModal
        isOpen={isPackingModalOpen}
        onClose={() => setIsPackingModalOpen(false)}
        destination={itinerary?.destination || inferredDestination}
        dayCount={inferredDayCount}
      />

      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => {
          setIsTutorialOpen(false)
          setHasSeenTutorial(true)
        }}
        onStartSpotlight={() => {
          setIsTutorialOpen(false)
          setHasSeenTutorial(true)
          setIsSpotlightOpen(true)
        }}
        onSelectPrompt={(prompt) => {
          setActiveTab('chat')
          setHasSeenTutorial(true)
          void sendMessage(prompt)
        }}
      />

      <SpotlightTour
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {showTrips && (
        <div
          className="fixed inset-0 z-[9999] flex items-end justify-center bg-stone-900/40 dark:bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Perjalanan saya"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowTrips(false)
          }}
        >
          <div className="animate-rise flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-3xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-[#141920] shadow-2xl shadow-stone-900/20 sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80 px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">Perjalanan saya</h2>
                <p className="text-xs text-stone-500 dark:text-stone-400">Itinerary tersimpan di akunmu, terbaru di atas.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTrips(false)}
                className="grid h-9 w-9 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
              {trips === null ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500 dark:text-stone-400">
                  <Loader2 className="h-5 w-5 animate-spin text-teal-700 dark:text-teal-400" /> Memuat perjalanan…
                </div>
              ) : trips.length === 0 ? (
                <div className="grid place-items-center gap-3 py-10 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    <Compass className="h-6 w-6" />
                  </span>
                  <p className="max-w-xs text-sm text-stone-600 dark:text-stone-400">
                    Belum ada perjalanan tersimpan. Buat itinerary lewat chat, dan akan muncul di sini.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {trips.map((trip) => (
                    <li key={trip.session_id}>
                      <button
                        type="button"
                        onClick={() => void openTrip(trip.session_id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-teal-600/40 hover:shadow-md hover:shadow-stone-900/5 ${
                          credentials?.sessionId === trip.session_id
                            ? 'border-teal-700 bg-teal-50/60 dark:border-teal-600/60 dark:bg-teal-950/40'
                            : 'border-stone-200 bg-white dark:border-stone-800 dark:bg-[#1a212b] dark:hover:border-teal-600/40'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-display text-base font-bold text-stone-900 dark:text-stone-100">
                            {trip.destination}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatRangeDates(trip.start_date, trip.end_date)}
                          </span>
                        </span>
                        {credentials?.sessionId === trip.session_id && (
                          <span className="shrink-0 rounded-full bg-teal-700 px-2.5 py-1 text-[11px] font-semibold text-white">
                            Aktif
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
