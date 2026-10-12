import { useState } from 'react'
import { Calendar, Pencil, ExternalLink, ChevronDown, ChevronUp, MapPin } from 'lucide-react'
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
  isActive?: boolean
  onSelectDay?: () => void
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
      weekday: 'long',
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
  isActive = false,
  onSelectDay,
  onRefineDay,
  onSelectPlace,
}: DayCardProps) {
  const [showAllItems, setShowAllItems] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const activityKeywords = items.flatMap((it) => [it.title, it.category || '', it.location_name || ''])
  const coverUrl = getDayCoverImage(destination, dayNumber, activityKeywords)
  const formattedDate = formatDayDate(startDate, dayNumber)

  const mainTitles = items.map((it) => it.title).filter(Boolean)
  const daySummary =
    mainTitles.length > 0
      ? `${mainTitles[0]}${mainTitles.length > 1 ? ` & ${mainTitles[1]}` : ''}`
      : `Eksplorasi ${destination}`

  const displayedItems = showAllItems ? items : items.slice(0, 4)

  return (
    <article
      onClick={onSelectDay}
      className={`group flex w-full shrink-0 cursor-pointer flex-col overflow-hidden rounded-3xl border bg-white transition-all sm:w-[320px] ${
        isActive
          ? 'border-teal-700 shadow-lg shadow-teal-900/10 ring-2 ring-teal-700/15'
          : 'border-stone-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-lg hover:shadow-stone-900/5'
      }`}
    >
      {/* Cover */}
      <div className="relative h-36 w-full overflow-hidden bg-stone-200">
        <img
          src={coverUrl}
          alt={`Hari ${dayNumber}: ${daySummary}`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-stone-900 shadow-sm">
          Hari {dayNumber}
        </div>
        {onRefineDay && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRefineDay(dayNumber)
            }}
            className="absolute right-3 top-3 flex min-h-[36px] items-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-teal-700 hover:text-white"
            title="Minta Rute mengubah hari ini"
            aria-label={`Ubah hari ke-${dayNumber}`}
          >
            <Pencil className="h-3.5 w-3.5" /> Ubah
          </button>
        )}
      </div>

      {/* Header */}
      <div className="px-4 pb-2 pt-3.5">
        <h3 className="line-clamp-1 font-display text-lg font-bold leading-tight text-stone-900">{daySummary}</h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs capitalize text-stone-500">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formattedDate}</span>
          <span aria-hidden="true">·</span>
          <span className="normal-case">{items.length} aktivitas</span>
        </div>
      </div>

      {/* Timeline */}
      <ol className="relative flex-1 px-4 pb-3">
        {displayedItems.map((item, idx) => (
          <li key={item.id || idx} className="relative">
            {idx < displayedItems.length - 1 && (
              <span className="absolute bottom-0 left-[3.35rem] top-6 w-px bg-stone-200" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSelectPlace?.(item)
              }}
              className="group/item -mx-2 flex min-h-[48px] w-[calc(100%+1rem)] items-start gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-teal-50/70"
            >
              <span className="w-10 shrink-0 pt-0.5 text-xs font-bold tabular-nums text-stone-500 group-hover/item:text-teal-800">
                {item.time_slot}
              </span>
              <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-amber-500 ring-1 ring-amber-500/40 group-hover/item:bg-teal-700 group-hover/item:ring-teal-700/40" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm font-semibold text-stone-800">{item.title}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="line-clamp-1">
                    {item.location_name || item.address || item.description || 'Lokasi terkonfirmasi'}
                  </span>
                </span>
              </span>
              {item.source_url && (
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-stone-400 transition hover:bg-white hover:text-teal-700 sm:opacity-0 sm:group-hover/item:opacity-100"
                  title="Buka di OpenStreetMap"
                  aria-label={`Buka ${item.title} di OpenStreetMap`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </button>
          </li>
        ))}
      </ol>

      {items.length > 4 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setShowAllItems(!showAllItems)
          }}
          className="flex min-h-[44px] items-center justify-center gap-1 border-t border-stone-100 text-xs font-semibold text-teal-800 transition hover:bg-stone-50"
        >
          {showAllItems ? (
            <>
              Tampilkan lebih sedikit <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              +{items.length - 4} aktivitas lainnya <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </article>
  )
}
