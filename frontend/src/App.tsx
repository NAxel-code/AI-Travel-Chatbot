import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import {
  CalendarDays,
  Compass,
  Database,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  RotateCcw,
  Send,
  Settings2,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { Markdown } from './components/Markdown'
import { createIcs } from './lib/calendar'
import { cn } from './lib/utils'
import { readSse } from './lib/sse'

const API_BASE = String(import.meta.env.VITE_API_BASE || 'http://localhost:8787/api').replace(/\/$/, '')
const SESSION_STORAGE_KEY = 'travel_session_credentials'
const LEGACY_SESSION_KEY = 'travel_session_id'
const INITIAL_GREETING = 'Halo! Sebutkan tujuan, tanggal atau durasi, budget, dan hal yang kamu suka. Saya akan mencari tempat nyata sebelum menyusun rute.'

type Message = { role: 'user' | 'model'; content: string }
type Credentials = { sessionId: string; token: string }
type Preference = { preference_category: string; preference_value: string }
type ItineraryItem = {
  id: string
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
  const payload = await response.json().catch(() => null) as ({ error?: string } & T) | null
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

function displayDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function App() {
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isBootstrapping ? 'auto' : 'smooth' })
  }, [messages, isBootstrapping])

  useEffect(() => {
    let active = true

    async function loadSession() {
      try {
        let session = storedCredentials()
        if (!session) session = await createSession(localStorage.getItem(LEGACY_SESSION_KEY))

        const load = (current: Credentials) => Promise.all([
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
        setCredentials(session)
        setMessages(historyResult.data.length ? historyResult.data : [{ role: 'model', content: INITIAL_GREETING }])
        setItinerary(itineraryResult.data)
        setPreferences(preferenceResult.data)
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
    setItinerary(result.data)
  }

  async function refreshPreferences(session = credentials) {
    if (!session) return
    const result = await apiRequest<ApiEnvelope<Preference[]>>(`/preferences/${session.sessionId}`, session)
    setPreferences(result.data)
  }

  async function sendMessage(message: string) {
    if (!credentials || isLoading || !message.trim()) return
    const cleanMessage = message.trim()
    const controller = new AbortController()
    abortRef.current = controller
    setInput('')
    setPageError(null)
    setLastFailedMessage(null)
    setChatProgress('Menghubungkan ke perencana…')
    setIsLoading(true)
    setMessages((current) => [...current, { role: 'user', content: cleanMessage }, { role: 'model', content: '' }])

    let itineraryChanged = false
    let preferencesChanged = false
    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': credentials.token,
        },
        body: JSON.stringify({ session_id: credentials.sessionId, message: cleanMessage }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null
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
        } else if (event.type === 'system') {
          if (event.message.startsWith('Preferensi disimpan:')) preferencesChanged = true
          addNotice(event.message)
        } else if (event.type === 'error') {
          throw new Error(event.message)
        }
      })

      await Promise.all([
        itineraryChanged ? refreshItinerary(credentials) : Promise.resolve(),
        preferencesChanged ? refreshPreferences(credentials) : Promise.resolve(),
      ])
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      const message = aborted
        ? 'Permintaan dibatalkan.'
        : error instanceof Error ? error.message : 'Koneksi terputus. Coba lagi.'
      setMessages((current) => {
        const last = current.at(-1)
        if (!last || last.role !== 'model') return current
        const content = last.content ? `${last.content}\n\n_${message}_` : message
        return [...current.slice(0, -1), { ...last, content }]
      })
      if (!aborted) setLastFailedMessage(cleanMessage)
    } finally {
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
      await apiRequest(`/preferences/${credentials.sessionId}/${encodeURIComponent(category)}`, credentials, { method: 'DELETE' })
      setPreferences((current) => current.filter((item) => item.preference_category !== category))
      addNotice('Preferensi dihapus dari memori.')
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Preferensi tidak dapat dihapus.')
    }
  }

  function refineDay(day: number) {
    setInput(`Ubah itinerary hari ke-${day}: `)
    inputRef.current?.focus()
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

  const groupedItems = itinerary?.items.reduce<Record<number, ItineraryItem[]>>((groups, item) => {
    ;(groups[item.day_number] ||= []).push(item)
    return groups
  }, {}) || {}

  if (isBootstrapping) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-background px-6">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Memuat perjalananmu…
        </div>
      </main>
    )
  }

  return (
    <div className="flex h-[100dvh] min-h-[620px] w-full flex-col overflow-hidden bg-background lg:min-h-0 lg:flex-row">
      <aside className="flex h-[52dvh] min-h-[360px] flex-col border-b bg-card lg:h-full lg:w-[400px] lg:min-w-[360px] lg:border-b-0 lg:border-r print:hidden">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-bold leading-none">Rute</h1>
              <p className="mt-1 text-xs text-muted-foreground">Perencana perjalanan berbasis data</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowPreferences((value) => !value)}
            className={cn('rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground', showPreferences && 'bg-muted text-foreground')}
            aria-label="Kelola preferensi"
            aria-expanded={showPreferences}
          >
            {showPreferences ? <X className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
          </button>
        </header>

        {showPreferences && (
          <section className="border-b bg-secondary/45 px-4 py-3" aria-label="Preferensi tersimpan">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Database className="h-3.5 w-3.5" /> Memori perjalanan
            </div>
            {preferences.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada preferensi jangka panjang.</p>
            ) : (
              <ul className="space-y-2">
                {preferences.map((preference) => (
                  <li key={preference.preference_category} className="flex items-start justify-between gap-3 text-sm">
                    <span>
                      <strong className="font-medium capitalize">{preference.preference_category.replaceAll('_', ' ')}</strong>
                      <span className="text-muted-foreground"> · {preference.preference_value}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void deletePreference(preference.preference_category)}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Hapus ${preference.preference_category}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
          {notices.map((notice) => (
            <div key={notice.id} className="border-l-2 border-accent bg-secondary/55 px-3 py-2 text-xs text-secondary-foreground">
              {notice.message}
            </div>
          ))}
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={cn(
                'max-w-[88%] px-3.5 py-2.5 text-sm leading-relaxed',
                message.role === 'model'
                  ? 'rounded-r-xl rounded-bl-xl bg-muted text-foreground'
                  : 'ml-auto rounded-l-xl rounded-br-xl bg-primary text-primary-foreground',
              )}
            >
              {message.role === 'model' && !message.content ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {chatProgress || 'Menunggu respons…'}
                </span>
              ) : message.role === 'model' ? (
                <>
                  <Markdown content={message.content} />
                  {index === messages.length - 1 && isLoading && chatProgress && (
                    <span className="mt-2 flex items-center gap-2 border-t border-foreground/10 pt-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {chatProgress}
                    </span>
                  )}
                </>
              ) : (
                <span className="whitespace-pre-wrap">{message.content}</span>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <footer className="border-t bg-card p-3">
          {lastFailedMessage && !isLoading && (
            <button
              type="button"
              onClick={() => void sendMessage(lastFailedMessage)}
              className="mb-2 flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Coba kirim ulang
            </button>
          )}
          <form className="flex items-end gap-2" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={!credentials || isLoading}
              maxLength={4000}
              rows={2}
              placeholder="Contoh: Bandung, 12–14 Oktober, budget hemat…"
              className="max-h-28 min-h-[44px] flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm leading-5 placeholder:text-muted-foreground focus:border-primary disabled:opacity-60"
            />
            {isLoading ? (
              <button
                type="button"
                onClick={cancelRequest}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-destructive text-destructive-foreground hover:opacity-90"
                aria-label="Batalkan permintaan"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!credentials || !input.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Kirim pesan"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </form>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Enter untuk kirim · Shift+Enter untuk baris baru</p>
        </footer>
      </aside>

      <main className="thin-scrollbar min-h-0 flex-1 overflow-y-auto bg-[#f3f0e8] px-4 py-5 sm:px-7 lg:px-10 lg:py-8 print:overflow-visible print:bg-white print:p-0">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 flex flex-col gap-4 border-b border-foreground/15 pb-5 sm:flex-row sm:items-end sm:justify-between print:hidden">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Itinerary aktif</p>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {itinerary?.destination || 'Belum ada tujuan'}
              </h2>
              {itinerary && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {displayDate(itinerary.start_date)} — {displayDate(itinerary.end_date)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!itinerary}
                className="flex items-center gap-2 rounded-md border bg-transparent px-3 py-2 text-sm font-medium hover:bg-background disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> Print / Save PDF
              </button>
              <button
                type="button"
                onClick={exportCalendar}
                disabled={!itinerary}
                className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                <CalendarDays className="h-4 w-4" /> Tambah ke kalender
              </button>
            </div>
          </header>

          {pageError && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-l-2 border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
              <span>{pageError}</span>
              <span className="flex items-center gap-3">
                {!credentials && (
                  <button type="button" onClick={retryBootstrap} className="font-semibold underline underline-offset-2">
                    Coba muat ulang
                  </button>
                )}
                <button type="button" onClick={() => setPageError(null)} aria-label="Tutup pesan"><X className="h-4 w-4" /></button>
              </span>
            </div>
          )}

          {!itinerary ? (
            <section className="grid min-h-[45vh] place-items-center border-y border-dashed border-foreground/20 py-16 text-center">
              <div className="max-w-md">
                <MapPin className="mx-auto mb-4 h-10 w-10 text-accent" />
                <h3 className="font-display text-2xl font-bold">Mulai dari konteks perjalanan</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Ceritakan tujuan dan tanggal di panel chat. Rute akan muncul di sini setelah tempat dan urutannya diperiksa.
                </p>
              </div>
            </section>
          ) : (
            <div id="itinerary-content" className="space-y-10 pb-12">
              {Object.keys(groupedItems).sort((a, b) => Number(a) - Number(b)).map((day) => (
                <section key={day}>
                  <div className="mb-3 flex items-center justify-between border-b border-foreground/20 pb-2">
                    <h3 className="font-display text-2xl font-bold">Hari {day}</h3>
                    <button
                      type="button"
                      onClick={() => refineDay(Number(day))}
                      className="text-xs font-semibold uppercase tracking-[0.12em] text-accent hover:underline print:hidden"
                    >
                      Ubah hari ini
                    </button>
                  </div>
                  <ol>
                    {groupedItems[Number(day)].map((item) => (
                      <li key={item.id} className="grid grid-cols-[4.5rem_1fr] gap-3 border-b border-foreground/10 py-4 sm:grid-cols-[6rem_1fr] sm:gap-5">
                        <div className="pt-0.5 font-mono text-sm font-semibold text-primary">{item.time_slot}</div>
                        <div>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h4 className="text-base font-semibold">{item.title}</h4>
                            {item.category && <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{item.category}</span>}
                          </div>
                          {item.description && <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.description}</p>}
                          {(item.address || item.source_url) && (
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                              {item.address && (
                                <span className="flex items-start gap-1.5 text-muted-foreground">
                                  <Navigation className="mt-0.5 h-3 w-3 shrink-0" /> {item.address}
                                </span>
                              )}
                              {item.source_url && (
                                <a href={item.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium text-primary hover:underline">
                                  OpenStreetMap <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              {itinerary.items.some((item) => item.source_url) && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Database className="h-3.5 w-3.5" /> Data lokasi © OpenStreetMap contributors.
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
