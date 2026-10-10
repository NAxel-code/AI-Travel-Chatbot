import { useState } from 'react'
import { Calendar, Car, Edit3, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { getDayCoverImage } from '../lib/images'

export type ItineraryItem = {
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

type DayCardProps = {
  dayNumber: number
  destination: string
  startDate?: string
  items: ItineraryItem[]
  onRefineDay?: (dayNumber: number) => void
  onSelectPlace?: (item: ItineraryItem) => void
}

function formatDayDate(startDate?: string, dayNumber = 1): string {
  if (!startDate) return `Hari ${dayNumber}`
  try {
    const base = new Date(`${startDate}T00:00:00Z`)
    if (isNaN(base.getTime())) return `Hari ${dayNumber}`
    base.setUTCDate(base.getUTCDate() + (dayNumber - 1))
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(base)
  } catch {
    return `Hari ${dayNumber}`
  }
}

export function DayCard({
  dayNumber,
  destination,
  startDate,
  items,
  onRefineDay,
  onSelectPlace,
}: DayCardProps) {
  const [showAllItems, setShowAllItems] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const activityKeywords = items.flatMap((it) => [it.title, it.category || '', it.location_name || ''])
  const coverUrl = getDayCoverImage(destination, dayNumber, activityKeywords)
  const formattedDate = formatDayDate(startDate, dayNumber)

  // Determine an evocative title for the day based on primary items
  const mainTitles = items.map((it) => it.title).filter(Boolean)
  const daySummary = mainTitles.length > 0 
    ? `${mainTitles[0]}${mainTitles.length > 1 ? ` & ${mainTitles[1]}` : ''}`
    : `Eksplorasi ${destination}`

  const displayedItems = showAllItems ? items : items.slice(0, 4)

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#151b23] shadow-md transition-all hover:border-slate-700 hover:shadow-xl w-full min-w-[300px] max-w-[340px] shrink-0">
      {/* Cover Image Banner */}
      <div className="relative h-40 w-full overflow-hidden bg-slate-900">
        <img
          src={coverUrl}
          alt={`Hari ${dayNumber}: ${daySummary}`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Top Gradient for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#151b23] via-transparent to-black/40" />

        {/* Day Badge */}
        <div className="absolute left-3 top-3 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/10">
          Hari {dayNumber}
        </div>

        {/* Action button overlay */}
        {onRefineDay && (
          <button
            type="button"
            onClick={() => onRefineDay(dayNumber)}
            className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-slate-300 backdrop-blur-md border border-white/10 hover:bg-emerald-600 hover:text-white transition"
            title="Ubah hari ini"
            aria-label={`Ubah hari ke-${dayNumber}`}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Card Header Content */}
      <div className="p-4 pb-2">
        <h3 className="line-clamp-1 text-base font-bold text-white leading-tight">
          Day {dayNumber}: {daySummary}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{formattedDate}</span>
        </div>
      </div>

      {/* Activities Timeline */}
      <div className="flex-1 px-4 py-2 space-y-3.5">
        {displayedItems.map((item, idx) => (
          <div
            key={item.id || idx}
            onClick={() => onSelectPlace?.(item)}
            className="group/item flex items-start gap-3 text-xs cursor-pointer rounded-lg p-1.5 -mx-1.5 hover:bg-slate-800/60 transition"
          >
            {/* Time Slot */}
            <span className="w-11 shrink-0 pt-0.5 font-mono font-semibold text-slate-300 group-hover/item:text-emerald-400 transition-colors">
              {item.time_slot}
            </span>

            {/* Bullet separator */}
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600 group-hover/item:bg-emerald-400 transition-colors" />

            {/* Activity Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-slate-200 line-clamp-1 group-hover/item:text-white">
                  {item.title}
                </span>
                {item.source_url && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-emerald-400 transition"
                    title="Buka OpenStreetMap"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                {item.location_name || item.address || item.description || 'Lokasi terkonfirmasi'}
              </p>
            </div>
          </div>
        ))}

        {items.length > 4 && (
          <button
            type="button"
            onClick={() => setShowAllItems(!showAllItems)}
            className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition"
          >
            {showAllItems ? (
              <>Tampilkan lebih sedikit <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>+{items.length - 4} aktivitas lainnya <ChevronDown className="h-3 w-3" /></>
            )}
          </button>
        )}
      </div>

      {/* Card Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-800/80 px-4 py-3 text-xs bg-[#12161f]">
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-800/80 px-2.5 py-1 text-slate-300 border border-slate-700/50">
          <Car className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-medium text-[11px]">Transportasi</span>
        </div>

        <div className="flex items-center gap-1">
          {onRefineDay && (
            <button
              type="button"
              onClick={() => onRefineDay(dayNumber)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-emerald-400 transition"
              title="Sesuaikan hari ini"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
