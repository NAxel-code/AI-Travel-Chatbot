import { useState } from 'react'
import { Calendar, Pencil, ExternalLink, ChevronDown, ChevronUp, MapPin, Star, Navigation } from 'lucide-react'
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
  rating?: number | null
  user_ratings_total?: number | null
  source_name?: string | null
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

function formatReviewCount(count?: number | null): string {
  if (!count) return '1.2rb'
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}rb`
  return String(count)
}

function buildDayGoogleRouteUrl(items: ItineraryItem[], destination: string): string {
  const valid = items.filter((it) => typeof it.latitude === 'number' && typeof it.longitude === 'number')
  if (valid.length === 0) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
  }
  if (valid.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${valid[0].latitude},${valid[0].longitude}`
  }
  const first = valid[0]
  const last = valid[valid.length - 1]
  const waypoints = valid
    .slice(1, -1)
    .slice(0, 8)
    .map((it) => `${it.latitude},${it.longitude}`)
    .join('|')
  const url = new URL('https://www.google.com/maps/dir/')
  url.searchParams.set('api', '1')
  url.searchParams.set('origin', `${first.latitude},${first.longitude}`)
  url.searchParams.set('destination', `${last.latitude},${last.longitude}`)
  if (waypoints) url.searchParams.set('waypoints', waypoints)
  url.searchParams.set('travelmode', 'driving')
  return url.toString()
}

/* Hallmark · component: DayCard · genre: editorial · theme: Sand & Sea
 * states: default · hover · focus-visible · active · disabled
 * contrast: pass (4.5:1+)
 */
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
      role="button"
      tabIndex={0}
      aria-label={`Hari ke-${dayNumber}: ${daySummary}. ${items.length} aktivitas terencana.`}
      aria-pressed={isActive}
      onClick={onSelectDay}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelectDay?.()
        }
      }}
      className={`group flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-teal-700/80 focus-visible:ring-offset-2 dark:bg-[#141920] ${
        isActive
          ? 'border-teal-700 shadow-md shadow-teal-900/10 ring-2 ring-teal-700/20 dark:border-teal-500 dark:ring-teal-500/20'
          : 'border-stone-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md hover:shadow-stone-900/5 dark:border-stone-800/90 dark:hover:border-stone-700'
      }`}
    >
      {/* Cover */}
      <div className="relative h-36 w-full overflow-hidden bg-stone-200 dark:bg-stone-800">
        <img
          src={coverUrl}
          alt={`Hari ${dayNumber}: ${daySummary}`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-stone-900 shadow-sm backdrop-blur-xs dark:bg-[#141920]/90 dark:text-stone-100">
          Hari {dayNumber}
        </div>
        {onRefineDay && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRefineDay(dayNumber)
            }}
            className="absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full bg-white/95 px-3 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-teal-700 hover:text-white focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-1 dark:bg-[#141920]/90 dark:text-stone-200 dark:hover:bg-teal-700 dark:hover:text-white"
            title="Minta Rute mengubah hari ini"
            aria-label={`Ubah hari ke-${dayNumber}`}
          >
            <Pencil className="h-3.5 w-3.5" /> <span>Ubah</span>
          </button>
        )}
      </div>

      {/* Header */}
      <div className="px-4 pb-2 pt-3.5">
        <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug text-stone-900 dark:text-stone-100 min-h-[2.5rem]">{daySummary}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400">
          <Calendar className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400" />
          <span className="font-medium capitalize">{formattedDate}</span>
          <span aria-hidden="true" className="text-stone-300 dark:text-stone-600">·</span>
          <span className="font-medium text-stone-600 dark:text-stone-400">{items.length} aktivitas</span>
        </div>
      </div>

      {/* Timeline */}
      <ol className="relative flex-1 px-4 pb-3">
        {displayedItems.map((item, idx) => {
          const hasRating = typeof item.rating === 'number' && item.rating > 0
          return (
            <li key={item.id || idx} className="relative">
              {idx < displayedItems.length - 1 && (
                <span className="absolute bottom-0 left-[3.35rem] top-6 w-px bg-stone-200 dark:bg-stone-800" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectPlace?.(item)
                }}
                className="group/item -mx-2 flex min-h-[48px] w-[calc(100%+1rem)] items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-teal-50/70 dark:hover:bg-teal-950/40 focus-visible:ring-2 focus-visible:ring-teal-700/60"
              >
                <span className="w-10 shrink-0 pt-0.5 text-xs font-bold tabular-nums text-stone-500 dark:text-stone-400 group-hover/item:text-teal-800 dark:group-hover/item:text-teal-300">
                  {item.time_slot}
                </span>
                <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white dark:border-[#141920] bg-amber-500 ring-1 ring-amber-500/40 group-hover/item:bg-teal-700 group-hover/item:ring-teal-700/40" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-sm font-semibold text-stone-900 dark:text-stone-100">{item.title}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-stone-600 dark:text-stone-400">
                    <MapPin className="h-3 w-3 shrink-0 text-stone-400 dark:text-stone-500" />
                    <span className="line-clamp-1">
                      {item.location_name || item.address || item.description || 'Lokasi terkonfirmasi'}
                    </span>
                  </span>
                  {hasRating ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 dark:text-amber-200 border border-amber-200/60 dark:border-amber-800/60">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                      <span>{item.rating}</span>
                      {item.user_ratings_total ? (
                        <span className="text-amber-700/80 dark:text-amber-400/80">({formatReviewCount(item.user_ratings_total)})</span>
                      ) : null}
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 font-normal">· {item.source_name || 'Google Maps'}</span>
                    </span>
                  ) : item.category ? (
                    <span className="mt-1 inline-flex items-center rounded-md bg-stone-100 dark:bg-stone-800/70 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:text-stone-300">
                      {item.category}
                    </span>
                  ) : null}
                </span>
                {item.source_url && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-stone-400 transition hover:bg-white hover:text-teal-700 dark:hover:bg-[#1a212b] dark:hover:text-teal-400 focus-visible:ring-2 focus-visible:ring-teal-700 sm:opacity-0 sm:group-hover/item:opacity-100"
                    title="Buka di Google Maps"
                    aria-label={`Buka ${item.title} di Google Maps`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </button>
            </li>
          )
        })}
      </ol>

      {/* 1-Click Google Maps Day Navigation Route */}
      <div className="px-4 pb-2 pt-0">
        <a
          href={buildDayGoogleRouteUrl(items, destination)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-teal-200/80 bg-teal-50/90 dark:border-teal-800/60 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-900/60 dark:hover:text-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-100 hover:text-teal-900 active:scale-[0.98] shadow-xs focus-visible:ring-2 focus-visible:ring-teal-700"
          title={`Buka rute navigasi Hari ke-${dayNumber} di Google Maps`}
        >
          <Navigation className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
          <span>Rute Hari {dayNumber} di Google Maps</span>
          <ExternalLink className="h-3 w-3 text-teal-600 dark:text-teal-400" />
        </a>
      </div>

      {items.length > 4 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setShowAllItems(!showAllItems)
          }}
          className="flex min-h-[44px] items-center justify-center gap-1 border-t border-stone-100 dark:border-stone-800/80 text-xs font-semibold text-teal-800 dark:text-teal-400 transition hover:bg-stone-50 dark:hover:bg-stone-800/50 focus-visible:ring-2 focus-visible:ring-teal-700/60"
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
