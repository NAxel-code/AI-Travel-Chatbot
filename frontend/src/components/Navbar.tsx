import { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, Download, CalendarDays, Route, Settings2, Plus, Loader2, UserRound } from 'lucide-react'

type NavbarProps = {
  destination?: string
  hasItinerary: boolean
  onSearch?: (query: string) => void
  onExportPdf?: () => void
  onExportCalendar?: () => void
  onTogglePreferences?: () => void
  onNewTrip?: () => void
  onNewSession?: () => void
  isStartingSession?: boolean
}

export function Navbar({
  destination,
  hasItinerary,
  onSearch,
  onExportPdf,
  onExportCalendar,
  onTogglePreferences,
  onNewTrip,
  onNewSession,
  isStartingSession,
}: NavbarProps) {
  const [searchVal, setSearchVal] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the account menu when clicking outside of it
  useEffect(() => {
    if (!showMenu) return
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (searchVal.trim() && onSearch) {
      onSearch(searchVal.trim())
      setSearchVal('')
    }
  }

  return (
    <header className="sticky top-0 z-40 flex min-h-14 sm:min-h-16 w-full items-center justify-between gap-3 border-b border-stone-200/80 bg-white/85 px-3 sm:px-6 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      {/* Brand */}
      <button
        type="button"
        onClick={onNewTrip}
        className="flex shrink-0 items-center gap-2.5 rounded-xl select-none"
        aria-label="Rute — mulai rencana"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-white shadow-sm shadow-teal-900/20">
          <Route className="h-5 w-5" />
        </span>
        <span className="font-display text-2xl font-bold text-stone-900">Rute</span>
      </button>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative hidden md:block w-full max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          placeholder={destination ? `Cari tempat di ${destination}…` : 'Cari destinasi, pantai, kuliner…'}
          aria-label="Cari tempat"
          className="w-full rounded-full border border-stone-200 bg-stone-100/70 py-2.5 pl-11 pr-4 text-sm text-stone-800 placeholder:text-stone-400 transition focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-600/10"
        />
      </form>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {hasItinerary && onExportPdf && (
          <button
            type="button"
            onClick={onExportPdf}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.97]"
            title="Unduh / cetak laporan perjalanan (PDF)"
            aria-label="Laporan PDF"
          >
            <Download className="h-4 w-4" />
            <span className="hidden lg:inline">PDF</span>
          </button>
        )}
        {hasItinerary && onExportCalendar && (
          <button
            type="button"
            onClick={onExportCalendar}
            className="hidden sm:flex min-h-[44px] items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.97]"
            title="Ekspor ke kalender (.ics)"
          >
            <CalendarDays className="h-4 w-4" />
            <span className="hidden lg:inline">Kalender</span>
          </button>
        )}

        {onNewSession && (
          <button
            type="button"
            onClick={onNewSession}
            disabled={isStartingSession}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm shadow-teal-900/20 transition hover:bg-teal-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            title="Mulai sesi baru dan buat itinerary dari awal"
            aria-label="Sesi baru"
          >
            {isStartingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="hidden sm:inline">Sesi Baru</span>
          </button>
        )}

        {/* Guest menu */}
        <div ref={menuRef} className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            aria-expanded={showMenu}
            aria-haspopup="menu"
            className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-stone-200 bg-white pl-1.5 pr-2.5 transition hover:bg-stone-50"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-amber-800">
              <UserRound className="h-4 w-4" />
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-stone-500 transition ${showMenu ? 'rotate-180' : ''}`} />
          </button>

          {showMenu && (
            <div
              role="menu"
              className="animate-rise absolute right-0 mt-2 w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10"
            >
              <div className="px-3 py-2 border-b border-stone-100">
                <p className="text-sm font-semibold text-stone-900">Tamu</p>
                <p className="text-xs text-stone-500">Sesi anonim di perangkat ini</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowMenu(false)
                  onTogglePreferences?.()
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
              >
                <Settings2 className="h-4 w-4 text-stone-500" /> Kelola preferensi
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
