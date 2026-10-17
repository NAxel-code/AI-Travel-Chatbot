import { useEffect, useRef, useState } from 'react'
import {
  Search,
  ChevronDown,
  Download,
  CalendarDays,
  Route,
  Settings2,
  Plus,
  Loader2,
  UserRound,
  LogOut,
  LogIn,
  Luggage,
  Share2,
  CheckSquare,
  Sun,
  Moon,
  HelpCircle,
  Sparkles,
} from 'lucide-react'

type NavbarUser = { email: string; display_name: string }

type NavbarProps = {
  destination?: string
  hasItinerary: boolean
  user?: NavbarUser | null
  theme?: 'light' | 'dark'
  onToggleTheme?: () => void
  onSearch?: (query: string) => void
  onExportPdf?: () => void
  onExportCalendar?: () => void
  onShareWhatsApp?: () => void
  onOpenPackingList?: () => void
  onTogglePreferences?: () => void
  onNewTrip?: () => void
  onNewSession?: () => void
  onOpenAuth?: () => void
  onLogout?: () => void
  onOpenTrips?: () => void
  onOpenTutorial?: () => void
  onOpenSpotlight?: () => void
  isStartingSession?: boolean
}

/* Hallmark · component: Navbar · genre: editorial · theme: Sand & Sea
 * states: default · hover · focus-visible · active · disabled
 * contrast: pass (4.5:1+)
 */
export function Navbar({
  destination,
  hasItinerary,
  user,
  theme = 'light',
  onToggleTheme,
  onSearch,
  onExportPdf,
  onExportCalendar,
  onShareWhatsApp,
  onOpenPackingList,
  onTogglePreferences,
  onNewTrip,
  onNewSession,
  onOpenAuth,
  onLogout,
  onOpenTrips,
  onOpenTutorial,
  onOpenSpotlight,
  isStartingSession,
}: NavbarProps) {
  const [searchVal, setSearchVal] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close the account menu when clicking outside of it or pressing Escape
  useEffect(() => {
    if (!showMenu) return
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showMenu])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (searchVal.trim() && onSearch) {
      onSearch(searchVal.trim())
      setSearchVal('')
    }
  }

  return (
    <header className="sticky top-0 z-40 flex min-h-14 sm:min-h-16 w-full items-center justify-between gap-3 border-b border-stone-200/80 bg-white/90 px-3 sm:px-6 pt-[env(safe-area-inset-top)] backdrop-blur-md dark:border-stone-800/80 dark:bg-[#141920]/90 transition-colors duration-200">
      {/* Brand */}
      <button
        type="button"
        onClick={onNewTrip}
        className="flex shrink-0 items-center gap-2.5 rounded-xl select-none outline-none focus-visible:ring-2 focus-visible:ring-teal-700/80 focus-visible:ring-offset-2 transition active:scale-[0.98]"
        aria-label="Rute — mulai rencana baru"
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-700 text-white shadow-xs shadow-teal-900/20 dark:bg-teal-600">
          <Route className="h-5 w-5" />
        </span>
        <span className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">Rute</span>
      </button>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative hidden md:block w-full max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
        <input
          type="text"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          placeholder={destination ? `Cari tempat di ${destination}…` : 'Cari destinasi, pantai, kuliner…'}
          aria-label="Cari tempat atau aktivitas"
          className="w-full rounded-full border border-stone-200 bg-stone-100/70 py-2.5 pl-11 pr-10 text-sm text-stone-800 placeholder:text-stone-400 transition focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-teal-500 dark:focus:bg-[#141920]"
        />
        {searchVal && (
          <button
            type="button"
            onClick={() => setSearchVal('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            aria-label="Hapus teks pencarian"
          >
            <span className="text-xs font-bold leading-none">✕</span>
          </button>
        )}
      </form>

      {/* Actions */}
      <div data-tour="navbar-actions" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {hasItinerary && onShareWhatsApp && (
          <button
            type="button"
            onClick={onShareWhatsApp}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 hover:border-emerald-300 active:scale-[0.97] dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
            title="Bagikan rute perjalanan ke WhatsApp"
            aria-label="Bagikan WhatsApp"
          >
            <Share2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            <span className="hidden md:inline">WhatsApp</span>
          </button>
        )}
        {onOpenPackingList && (
          <button
            type="button"
            onClick={onOpenPackingList}
            className="hidden sm:flex min-h-[44px] items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.97] dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-200 dark:hover:border-stone-700 dark:hover:bg-[#222c3a]"
            title="Buka checklist barang bawaan traveler"
            aria-label="Checklist bawaan"
          >
            <CheckSquare className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <span className="hidden lg:inline">Packing</span>
          </button>
        )}
        {onOpenTutorial && (
          <button
            type="button"
            onClick={onOpenTutorial}
            className="hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-teal-700/40 hover:bg-teal-50/50 hover:text-teal-800 active:scale-[0.97] dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-200 dark:hover:border-teal-500/40 dark:hover:bg-teal-950/30"
            title="Buka panduan & tips penggunaan"
            aria-label="Panduan penggunaan"
          >
            <HelpCircle className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            <span className="hidden xl:inline">Panduan</span>
          </button>
        )}
        {hasItinerary && onExportPdf && (
          <button
            type="button"
            onClick={onExportPdf}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.97] dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-200 dark:hover:border-stone-700 dark:hover:bg-[#222c3a]"
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
            className="hidden sm:flex min-h-[44px] items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.97] dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-200 dark:hover:border-stone-700 dark:hover:bg-[#222c3a]"
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
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm shadow-teal-900/20 transition hover:bg-teal-800 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-600 dark:hover:bg-teal-700"
            title="Mulai sesi baru dan buat itinerary dari awal"
            aria-label="Sesi baru"
          >
            {isStartingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="hidden sm:inline">Sesi Baru</span>
          </button>
        )}

        {/* Dark / Light Mode Toggle Button */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 active:scale-[0.96] dark:border-stone-800 dark:bg-[#1a212b] dark:text-amber-300 dark:hover:border-stone-700 dark:hover:bg-[#222c3a]"
            title={theme === 'dark' ? 'Ganti ke Mode Terang (Light Mode)' : 'Ganti ke Mode Gelap (Dark Mode)'}
            aria-label={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-300 transition-transform duration-300 hover:rotate-45" />
            ) : (
              <Moon className="h-4 w-4 text-stone-600 transition-transform duration-300 hover:-rotate-12" />
            )}
          </button>
        )}

        {/* Mobile Panduan button */}
        {onOpenTutorial && (
          <button
            type="button"
            onClick={onOpenTutorial}
            className="grid h-11 w-11 place-items-center rounded-full border border-stone-200 bg-white text-stone-700 sm:hidden dark:border-stone-800 dark:bg-[#1a212b] dark:text-stone-200"
            title="Panduan penggunaan"
            aria-label="Panduan penggunaan"
          >
            <HelpCircle className="h-4 w-4 text-teal-700 dark:text-teal-400" />
          </button>
        )}

        {/* Compact account button for mobile (full menu is sm+) */}
        <button
          type="button"
          onClick={() => (user ? onOpenTrips?.() : onOpenAuth?.())}
          className="grid h-11 w-11 place-items-center rounded-full border border-stone-200 bg-white sm:hidden dark:border-stone-800 dark:bg-[#1a212b]"
          aria-label={user ? 'Perjalanan saya' : 'Masuk atau daftar'}
        >
          <span
            className={`grid h-8 w-8 place-items-center rounded-full ${
              user ? 'bg-teal-700 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
            }`}
          >
            {user ? (
              <span className="text-sm font-bold uppercase">{user.display_name.charAt(0) || user.email.charAt(0)}</span>
            ) : (
              <UserRound className="h-4 w-4" />
            )}
          </span>
        </button>

        {/* Account menu */}
        <div ref={menuRef} className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            aria-expanded={showMenu}
            aria-haspopup="menu"
            className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-stone-200 bg-white pl-1.5 pr-2.5 transition hover:bg-stone-50 dark:border-stone-800 dark:bg-[#1a212b] dark:hover:bg-[#222c3a]"
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-full ${
                user ? 'bg-teal-700 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {user ? (
                <span className="text-sm font-bold uppercase">{user.display_name.charAt(0) || user.email.charAt(0)}</span>
              ) : (
                <UserRound className="h-4 w-4" />
              )}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 text-stone-500 transition ${showMenu ? 'rotate-180' : ''}`} />
          </button>

          {showMenu && (
            <div
              role="menu"
              className="animate-rise absolute right-0 mt-2 w-64 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10 dark:border-stone-800 dark:bg-[#18202a] dark:shadow-black/40"
            >
              <div className="px-3 py-2 border-b border-stone-100 dark:border-stone-800">
                {user ? (
                  <>
                    <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{user.display_name}</p>
                    <p className="truncate text-xs text-stone-500 dark:text-stone-400">{user.email}</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">Tamu</p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">Sesi anonim di perangkat ini</p>
                  </>
                )}
              </div>

              {/* Theme toggle row in dropdown */}
              {onToggleTheme && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onToggleTheme()
                  }}
                  className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-[#222c3a]"
                >
                  <span className="flex items-center gap-2">
                    {theme === 'dark' ? (
                      <Sun className="h-4 w-4 text-amber-300" />
                    ) : (
                      <Moon className="h-4 w-4 text-stone-500" />
                    )}
                    <span>Mode Tampilan</span>
                  </span>
                  <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600 dark:bg-[#252f3e] dark:text-stone-300">
                    {theme === 'dark' ? 'Gelap' : 'Terang'}
                  </span>
                </button>
              )}

              {user && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false)
                    onOpenTrips?.()
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-[#222c3a]"
                >
                  <Luggage className="h-4 w-4 text-stone-500 dark:text-stone-400" /> Perjalanan saya
                </button>
              )}

              {onOpenPackingList && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false)
                    onOpenPackingList()
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-[#222c3a]"
                >
                  <CheckSquare className="h-4 w-4 text-teal-700 dark:text-teal-400" /> Checklist bawaan
                </button>
              )}

              {hasItinerary && onShareWhatsApp && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false)
                    onShareWhatsApp()
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                >
                  <Share2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Bagikan ke WhatsApp
                </button>
              )}

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowMenu(false)
                  onTogglePreferences?.()
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-[#222c3a]"
              >
                <Settings2 className="h-4 w-4 text-stone-500 dark:text-stone-400" /> Kelola preferensi
              </button>

              {onOpenSpotlight && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false)
                    onOpenSpotlight()
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-[#222c3a]"
                >
                  <Sparkles className="h-4 w-4 text-amber-500" /> Tur Interaktif (Spotlight)
                </button>
              )}

              {onOpenTutorial && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false)
                    onOpenTutorial()
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-[#222c3a]"
                >
                  <HelpCircle className="h-4 w-4 text-teal-700 dark:text-teal-400" /> Panduan & tips penggunaan
                </button>
              )}

              {user ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false)
                    onLogout?.()
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <LogOut className="h-4 w-4" /> Keluar
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false)
                    onOpenAuth?.()
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl bg-teal-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700"
                >
                  <LogIn className="h-4 w-4" /> Masuk / Daftar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
