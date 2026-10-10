import { useState } from 'react'
import { Search, Briefcase, ChevronDown, Download, CalendarDays, Sparkles, Settings2 } from 'lucide-react'

type NavbarProps = {
  destination?: string
  hasItinerary: boolean
  onSearch?: (query: string) => void
  onExportPdf?: () => void
  onExportCalendar?: () => void
  onTogglePreferences?: () => void
  onNewTrip?: () => void
}

export function Navbar({
  destination,
  hasItinerary,
  onSearch,
  onExportPdf,
  onExportCalendar,
  onTogglePreferences,
  onNewTrip,
}: NavbarProps) {
  const [searchVal, setSearchVal] = useState('')
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (searchVal.trim() && onSearch) {
      onSearch(searchVal.trim())
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-800/80 bg-[#0d1117]/95 px-4 sm:px-6 backdrop-blur-md">
      {/* Brand Logo */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={onNewTrip}>
          {/* Coral Logo Icon matching the mockup */}
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-extrabold tracking-tight text-white">
            Rute
          </span>
        </div>
      </div>

      {/* Global Search Bar (Center) */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder={destination ? `Cari di ${destination} atau tanyakan Rute...` : 'Cari destinasi wisata, aktivitas, atau rute...'}
            className="w-full rounded-xl border border-slate-800 bg-[#161b23] py-2 pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-[#1a212b] focus:outline-none transition shadow-inner"
          />
        </form>
      </div>

      {/* Right Action Tools & Profile */}
      <div className="flex items-center gap-3">
        {/* PDF & Calendar Export Buttons */}
        {hasItinerary && (
          <div className="hidden sm:flex items-center gap-2">
            {onExportPdf && (
              <button
                type="button"
                onClick={onExportPdf}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-[#161b23] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition"
                title="Cetak atau Simpan PDF"
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
            )}
            {onExportCalendar && (
              <button
                type="button"
                onClick={onExportCalendar}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-[#161b23] px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-slate-800 transition"
                title="Ekspor ke Kalender .ics"
              >
                <CalendarDays className="h-3.5 w-3.5" /> .ics
              </button>
            )}
          </div>
        )}

        {/* My Trips Button */}
        <button
          type="button"
          onClick={onNewTrip}
          className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#161b23] px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition shadow-sm"
        >
          <Briefcase className="h-3.5 w-3.5 text-slate-400" />
          <span className="hidden sm:inline">My Trips</span>
        </button>

        {/* User Profile Pill */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-[#161b23] p-1 pr-3 hover:bg-slate-800 transition"
          >
            {/* Avatar Image */}
            <img
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80"
              alt="Avatar Sarah J."
              className="h-7 w-7 rounded-lg object-cover ring-1 ring-slate-700"
            />
            <span className="text-xs font-medium text-slate-200 hidden sm:inline">Sarah J.</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-800 bg-[#161b23] p-2 shadow-xl z-50">
              <div className="px-3 py-2 text-xs border-b border-slate-800">
                <p className="font-semibold text-white">Sarah Jenkins</p>
                <p className="text-[11px] text-slate-400">sarah.j@traveler.com</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false)
                  onTogglePreferences?.()
                }}
                className="w-full mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
              >
                <Settings2 className="h-3.5 w-3.5" /> Kelola Preferensi
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
