import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Maximize2, Minimize2, MapPin, Navigation, ExternalLink, Layers } from 'lucide-react'

export type MapLocation = {
  id: string
  day_number: number
  title: string
  location_name: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  source_url: string | null
}

type TravelMapProps = {
  items: MapLocation[]
  destination?: string
  selectedDay?: number | null
  selectedPlace?: MapLocation | null
  className?: string
  onSelectPlace?: (item: MapLocation) => void
}

type MapStyle = 'roadmap' | 'hybrid' | 'terrain'

type ResolvedStop = MapLocation & {
  stopNumber: number
  latitude: number
  longitude: number
}

const GEOCODE_CACHE_KEY = 'travel_google_map_geocode_v2'

const DESTINATION_FALLBACKS: Record<string, [number, number]> = {
  bali: [-8.4095, 115.1889],
  'labuan bajo': [-8.4964, 119.8877],
  bandung: [-6.9175, 107.6191],
  yogyakarta: [-7.7956, 110.3695],
  jogja: [-7.7956, 110.3695],
  jakarta: [-6.2088, 106.8456],
  lombok: [-8.65, 116.3249],
  surabaya: [-7.2575, 112.7521],
  malang: [-7.9666, 112.6326],
  raja_ampat: [-0.2333, 130.5167],
  'raja ampat': [-0.2333, 130.5167],
}

const TILE_CONFIGS: Record<MapStyle, { url: string; label: string; attribution: string }> = {
  roadmap: {
    url: 'https://{s}.google.com/vt/lyrs=m&hl=id&x={x}&y={y}&z={z}',
    label: 'Peta',
    attribution: 'Map data Â©2026 Google',
  },
  hybrid: {
    url: 'https://{s}.google.com/vt/lyrs=y&hl=id&x={x}&y={y}&z={z}',
    label: 'Satelit',
    attribution: 'Imagery Â©2026 Google',
  },
  terrain: {
    url: 'https://{s}.google.com/vt/lyrs=p&hl=id&x={x}&y={y}&z={z}',
    label: 'Medan',
    attribution: 'Terrain Â©2026 Google',
  },
}

function readGeocodeCache(): Record<string, { lat: number; lng: number; address?: string }> {
  try {
    return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function writeGeocodeCache(cache: Record<string, { lat: number; lng: number; address?: string }>) {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore storage errors
  }
}

function cleanPlaceQuery(title: string, locationName: string | null): string {
  const base = (locationName || title || '')
    .replace(/^(kunjungan ke|mengunjungi|wisata ke|explore|menjelajahi|makan siang di|makan malam di|sarapan di|check-in di|check in di|transfer ke|perjalanan ke|snorkeling di|trekking di|sunset di|sunrise di)\s+/i, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .split(/\s+(?:&|dan|serta|-|â€“|\/)\s+/i)[0]
    .trim()
  return base || title
}

function defaultDestinationCenter(destination: string): [number, number] {
  const key = destination.trim().toLowerCase()
  for (const [name, coords] of Object.entries(DESTINATION_FALLBACKS)) {
    if (key.includes(name)) return coords
  }
  return [-8.4095, 115.1889]
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function TravelMap({
  items,
  destination = 'Bali',
  selectedDay,
  selectedPlace,
  className = '',
  onSelectPlace,
}: TravelMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mapStyle, setMapStyle] = useState<MapStyle>('roadmap')
  const [geocodedMap, setGeocodedMap] = useState<Record<string, { lat: number; lng: number; address?: string }>>(() =>
    readGeocodeCache(),
  )
  const [activeStopId, setActiveStopId] = useState<string | null>(null)

  const filteredItems = useMemo(
    () => (selectedDay ? items.filter((it) => it.day_number === selectedDay) : items),
    [items, selectedDay],
  )

  // Geocode destination & any items that have missing or duplicated coordinates
  useEffect(() => {
    let cancelled = false

    async function resolveMissingOrDuplicateCoords() {
      const cache = readGeocodeCache()
      let updated = false

      const destKey = `dest:${destination.toLowerCase()}`
      if (!cache[destKey]) {
        try {
          const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
          url.searchParams.set('name', destination)
          url.searchParams.set('count', '5')
          url.searchParams.set('language', 'id')
          url.searchParams.set('format', 'json')
          const res = await fetch(url.toString())
          if (res.ok) {
            const data = (await res.json()) as {
              results?: Array<{ latitude: number; longitude: number; country?: string }>
            }
            const loc = data.results?.find((r) => r.country === 'Indonesia') || data.results?.[0]
            if (loc) {
              cache[destKey] = { lat: loc.latitude, lng: loc.longitude }
              updated = true
            }
          }
        } catch {
          // Ignore network errors
        }
      }

      const seenCoords = new Set<string>()
      for (const item of items) {
        if (cancelled) return
        const hasValidCoords =
          typeof item.latitude === 'number' &&
          typeof item.longitude === 'number' &&
          !Number.isNaN(item.latitude) &&
          !Number.isNaN(item.longitude)
        const coordSignature = hasValidCoords ? `${item.latitude!.toFixed(4)},${item.longitude!.toFixed(4)}` : ''
        const isDuplicateCoord = hasValidCoords && seenCoords.has(coordSignature)
        if (hasValidCoords) seenCoords.add(coordSignature)

        const itemCacheKey = `item:${destination.toLowerCase()}:${cleanPlaceQuery(item.title, item.location_name).toLowerCase()}`
        if ((!hasValidCoords || isDuplicateCoord) && !cache[itemCacheKey]) {
          const query = `${cleanPlaceQuery(item.title, item.location_name)}, ${destination}`
          try {
            const nomUrl = new URL('https://nominatim.openstreetmap.org/search')
            nomUrl.searchParams.set('q', query)
            nomUrl.searchParams.set('format', 'jsonv2')
            nomUrl.searchParams.set('limit', '1')
            const res = await fetch(nomUrl.toString(), {
              headers: { 'Accept-Language': 'id,en' },
            })
            if (res.ok) {
              const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>
              if (rows[0]) {
                cache[itemCacheKey] = {
                  lat: Number(rows[0].lat),
                  lng: Number(rows[0].lon),
                  address: rows[0].display_name,
                }
                updated = true
              }
            }
          } catch {
            // Ignore geocoding errors
          }
        }
      }

      if (updated && !cancelled) {
        writeGeocodeCache(cache)
        setGeocodedMap({ ...cache })
      }
    }

    void resolveMissingOrDuplicateCoords()
    return () => {
      cancelled = true
    }
  }, [items, destination])

  // Build resolved stops with guaranteed non-overlapping coordinates
  const resolvedStops: ResolvedStop[] = useMemo(() => {
    const destKey = `dest:${destination.toLowerCase()}`
    const fallbackCenter = geocodedMap[destKey]
      ? ([geocodedMap[destKey].lat, geocodedMap[destKey].lng] as [number, number])
      : defaultDestinationCenter(destination)

    const seenExactCoords = new Map<string, number>()

    return filteredItems.map((item, idx) => {
      const itemCacheKey = `item:${destination.toLowerCase()}:${cleanPlaceQuery(item.title, item.location_name).toLowerCase()}`
      const cached = geocodedMap[itemCacheKey]

      const rawLat =
        typeof item.latitude === 'number' && !Number.isNaN(item.latitude) ? item.latitude : (cached?.lat ?? fallbackCenter[0])
      const rawLng =
        typeof item.longitude === 'number' && !Number.isNaN(item.longitude) ? item.longitude : (cached?.lng ?? fallbackCenter[1])

      const rawKey = `${rawLat.toFixed(4)},${rawLng.toFixed(4)}`
      const priorCount = seenExactCoords.get(rawKey) || 0
      seenExactCoords.set(rawKey, priorCount + 1)

      // If an earlier item already used this exact coordinate and we have a geocoded coordinate for this title, use it
      let finalLat = priorCount > 0 && cached ? cached.lat : rawLat
      let finalLng = priorCount > 0 && cached ? cached.lng : rawLng

      const finalKey = `${finalLat.toFixed(4)},${finalLng.toFixed(4)}`
      const overlapIndex = (seenExactCoords.get(finalKey) || 1) - 1
      if (priorCount > 0 && finalKey === rawKey) {
        // Spread overlapping pins in a neat circle (~250m radius) so every pin number is clearly visible
        const angle = (priorCount * 2 * Math.PI) / Math.max(6, filteredItems.length)
        const radius = 0.0024 * (1 + Math.floor(overlapIndex / 6) * 0.6)
        finalLat += Math.sin(angle) * radius
        finalLng += Math.cos(angle) * radius
      }

      return {
        ...item,
        id: item.id || `${item.day_number}-${idx}`,
        stopNumber: idx + 1,
        latitude: finalLat,
        longitude: finalLng,
        address: item.address || cached?.address || `${destination}, Indonesia`,
      }
    })
  }, [filteredItems, destination, geocodedMap])

  const googleDirectionsUrl = useMemo(() => {
    if (resolvedStops.length === 0) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`
    }
    if (resolvedStops.length === 1) {
      const s = resolvedStops[0]
      return `https://www.google.com/maps/search/?api=1&query=${s.latitude},${s.longitude}`
    }
    const first = resolvedStops[0]
    const last = resolvedStops[resolvedStops.length - 1]
    const waypoints = resolvedStops
      .slice(1, -1)
      .slice(0, 8)
      .map((s) => `${s.latitude},${s.longitude}`)
      .join('|')
    const url = new URL('https://www.google.com/maps/dir/')
    url.searchParams.set('api', '1')
    url.searchParams.set('origin', `${first.latitude},${first.longitude}`)
    url.searchParams.set('destination', `${last.latitude},${last.longitude}`)
    if (waypoints) url.searchParams.set('waypoints', waypoints)
    url.searchParams.set('travelmode', 'driving')
    return url.toString()
  }, [resolvedStops, destination])

  // Initialize Leaflet Map and Markers
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }
    markersByIdRef.current.clear()

    const destKey = `dest:${destination.toLowerCase()}`
    const fallbackCenter = geocodedMap[destKey]
      ? ([geocodedMap[destKey].lat, geocodedMap[destKey].lng] as [number, number])
      : defaultDestinationCenter(destination)

    const defaultLat = resolvedStops[0]?.latitude ?? fallbackCenter[0]
    const defaultLng = resolvedStops[0]?.longitude ?? fallbackCenter[1]

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const tileCfg = TILE_CONFIGS[mapStyle]
    const layer = L.tileLayer(tileCfg.url, {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map)
    tileLayerRef.current = layer

    const markers: L.Marker[] = []
    const latLngs: L.LatLngExpression[] = []

    resolvedStops.forEach((stop) => {
      const latLng: [number, number] = [stop.latitude, stop.longitude]
      latLngs.push(latLng)

      const pinFill = '#ea4335'

      // Google Maps style teardrop SVG pin with stop number
      const pinIcon = L.divIcon({
        className: 'gmaps-marker-wrapper',
        html: `
          <div class="gmaps-pin">
            <svg viewBox="0 0 28 38" width="30" height="40" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 1C6.82 1 1 6.82 1 14c0 9.64 11.45 21.55 12.18 22.3a1.14 1.14 0 0 0 1.64 0C15.55 35.55 27 23.64 27 14 27 6.82 21.18 1 14 1z" fill="${pinFill}" stroke="#ffffff" stroke-width="2"/>
              <circle cx="14" cy="14" r="8.5" fill="#ffffff"/>
              <text x="14" y="17.5" text-anchor="middle" fill="${pinFill}" font-size="10.5" font-weight="800" font-family="Arial, sans-serif">${stop.stopNumber}</text>
            </svg>
          </div>
        `,
        iconSize: [30, 40],
        iconAnchor: [15, 39],
        popupAnchor: [0, -36],
      })

      const gmapsPlaceUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${cleanPlaceQuery(stop.title, stop.location_name)}, ${destination}`,
      )}`
      const gmapsCoordUrl = `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}`

      const popupHtml = `
        <div class="gmaps-popup-card">
          <div class="gmaps-popup-badge">Hari ${stop.day_number} Â· Titik #${stop.stopNumber}</div>
          <div class="gmaps-popup-title">${escapeHtml(stop.title)}</div>
          ${stop.location_name && stop.location_name !== stop.title ? `<div class="gmaps-popup-subtitle">${escapeHtml(stop.location_name)}</div>` : ''}
          ${stop.address ? `<div class="gmaps-popup-address">${escapeHtml(stop.address)}</div>` : ''}
          <div class="gmaps-popup-actions">
            <a href="${gmapsPlaceUrl}" target="_blank" rel="noreferrer" class="gmaps-popup-link primary">Lihat di Google Maps</a>
            <a href="${gmapsCoordUrl}" target="_blank" rel="noreferrer" class="gmaps-popup-link secondary">Rute</a>
          </div>
        </div>
      `

      const marker = L.marker(latLng, { icon: pinIcon }).bindPopup(popupHtml, {
        maxWidth: 260,
        className: 'gmaps-leaflet-popup',
      }).addTo(map)

      marker.on('click', () => {
        setActiveStopId(stop.id)
        onSelectPlace?.(stop)
      })

      markersByIdRef.current.set(stop.id, marker)
      markers.push(marker)
    })

    // Draw Google Maps Navigation Blue route line (outer casing + inner stroke)
    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: '#185abc',
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
      L.polyline(latLngs, {
        color: '#4285f4',
        weight: 3.5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
    }

    if (markers.length > 0) {
      const group = L.featureGroup(markers)
      map.fitBounds(group.getBounds(), { padding: [48, 48], maxZoom: 15 })
    }

    mapInstanceRef.current = map
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize()
    }, 150)

    return () => {
      window.clearTimeout(resizeTimer)
      map.remove()
      mapInstanceRef.current = null
    }
  }, [resolvedStops, destination, geocodedMap, mapStyle, onSelectPlace])

  // Fly to selectedPlace when clicked from DayCard or stop pill
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !selectedPlace) return
    const matched = resolvedStops.find(
      (s) =>
        (selectedPlace.id && s.id === selectedPlace.id) ||
        (s.title === selectedPlace.title && s.day_number === selectedPlace.day_number),
    )
    if (matched) {
      map.flyTo([matched.latitude, matched.longitude], 15, { duration: 0.6 })
      const marker = markersByIdRef.current.get(matched.id)
      marker?.openPopup()
    }
  }, [selectedPlace, resolvedStops])

  function focusStop(stop: ResolvedStop) {
    setActiveStopId(stop.id)
    onSelectPlace?.(stop)
    const map = mapInstanceRef.current
    if (!map) return
    map.flyTo([stop.latitude, stop.longitude], 15, { duration: 0.6 })
    const marker = markersByIdRef.current.get(stop.id)
    marker?.openPopup()
  }

  function toggleFullscreen() {
    setIsFullscreen(!isFullscreen)
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize()
    }, 200)
  }

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-[#e5e3df] shadow-sm transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl' : className
      }`}
    >
      {/* Top-Left Google Maps Floating Card + Layer Switcher */}
      <div className="absolute left-3 top-3 z-[400] flex flex-wrap items-center gap-2 max-w-[calc(100%-90px)]">
        <div className="flex items-center gap-2 rounded-xl bg-white/95 px-3 py-1.5 shadow-md border border-slate-200/80 text-slate-800 backdrop-blur-sm">
          <MapPin className="h-4 w-4 text-[#ea4335] shrink-0" />
          <span className="text-xs font-bold tracking-tight truncate max-w-[160px] sm:max-w-[240px]">
            {destination} {selectedDay ? `Â· Hari ${selectedDay}` : ''}
          </span>
          {resolvedStops.length > 0 && (
            <span className="rounded-full bg-[#e8f0fe] px-2 py-0.5 text-[10px] font-bold text-[#1967d2] shrink-0">
              {resolvedStops.length} titik
            </span>
          )}
        </div>

        {/* Layer Switcher (Peta / Satelit / Medan) */}
        <div className="flex items-center rounded-xl bg-white/95 p-0.5 shadow-md border border-slate-200/80 backdrop-blur-sm">
          <Layers className="h-3.5 w-3.5 text-slate-500 ml-2 mr-1 hidden sm:block" />
          {(['roadmap', 'hybrid', 'terrain'] as MapStyle[]).map((styleKey) => (
            <button
              key={styleKey}
              type="button"
              onClick={() => setMapStyle(styleKey)}
              className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                mapStyle === styleKey
                  ? 'bg-[#1a73e8] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {TILE_CONFIGS[styleKey].label}
            </button>
          ))}
        </div>
      </div>

      {/* Top-Right Controls: Open in Google Maps & Fullscreen */}
      <div className="absolute right-3 top-3 z-[400] flex items-center gap-1.5">
        <a
          href={googleDirectionsUrl}
          target="_blank"
          rel="noreferrer"
          title="Buka rute lengkap di Google Maps"
          className="flex items-center gap-1.5 rounded-xl bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-[#1a73e8] shadow-md border border-slate-200/80 hover:bg-white transition"
        >
          <Navigation className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Google Maps</span>
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="grid h-8 w-8 place-items-center rounded-xl bg-white/95 text-slate-700 shadow-md border border-slate-200/80 hover:bg-white hover:text-slate-950 transition"
          aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="flex-1 w-full min-h-[280px]" />

      {/* Bottom Interactive Stop Bar (Google Maps style stop chips) */}
      {resolvedStops.length > 0 && (
        <div className="z-[400] border-t border-slate-200/80 bg-white/95 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 thin-scrollbar">
            {resolvedStops.map((stop) => {
              const isSelected = activeStopId === stop.id || selectedPlace?.id === stop.id
              return (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => focusStop(stop)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap transition shrink-0 border ${
                    isSelected
                      ? 'bg-[#1a73e8] text-white border-[#1a73e8] shadow-sm'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ${
                      isSelected ? 'bg-white text-[#1a73e8]' : 'bg-[#ea4335] text-white'
                    }`}
                  >
                    {stop.stopNumber}
                  </span>
                  <span className="max-w-[140px] truncate">{cleanPlaceQuery(stop.title, stop.location_name)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Google Attribution Badge */}
      <div className="absolute bottom-12 left-2.5 z-[400] pointer-events-none rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 shadow-sm">
        {TILE_CONFIGS[mapStyle].attribution}
      </div>
    </div>
  )
}
