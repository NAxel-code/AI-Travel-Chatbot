import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Maximize2, Minimize2, MapPin } from 'lucide-react'

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
  className?: string
  onSelectPlace?: (item: MapLocation) => void
}

export function TravelMap({ items, destination = 'Bali', selectedDay, className = '', onSelectPlace }: TravelMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Filter items if specific day is selected
  const validItems = (selectedDay ? items.filter((it) => it.day_number === selectedDay) : items)
    .filter((it): it is MapLocation & { latitude: number; longitude: number } => 
      typeof it.latitude === 'number' && typeof it.longitude === 'number' && !isNaN(it.latitude) && !isNaN(it.longitude)
    )

  useEffect(() => {
    if (!mapContainerRef.current) return

    // Clean up previous map if exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const currentItems = (selectedDay ? items.filter((it) => it.day_number === selectedDay) : items)
      .filter((it): it is MapLocation & { latitude: number; longitude: number } => 
        typeof it.latitude === 'number' && typeof it.longitude === 'number' && !isNaN(it.latitude) && !isNaN(it.longitude)
      )

    // Default center (Bali coordinates or first item)
    const defaultLat = currentItems[0]?.latitude ?? -8.4095
    const defaultLng = currentItems[0]?.longitude ?? 115.1889

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 10,
      zoomControl: false,
      attributionControl: false,
    })

    // Custom Zoom control at bottom-right like mockup
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // CartoDB Dark Matter tile layer for the exact dark theme in mockup
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    const markers: L.Marker[] = []
    const latLngs: L.LatLngExpression[] = []

    currentItems.forEach((item, index) => {
      const latLng: [number, number] = [item.latitude, item.longitude]
      latLngs.push(latLng)

      // Orange numbered circle pin from mockup
      const pinIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<span>${index + 1}</span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })

      const popupHtml = `
        <div class="p-1 space-y-1">
          <div class="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Hari ${item.day_number} · Stop #${index + 1}</div>
          <div class="font-semibold text-sm text-slate-100">${item.title}</div>
          ${item.location_name ? `<div class="text-xs text-slate-300 font-medium">${item.location_name}</div>` : ''}
          ${item.address ? `<div class="text-[11px] text-slate-400 leading-snug">${item.address}</div>` : ''}
          ${item.source_url ? `<a href="${item.source_url}" target="_blank" rel="noreferrer" class="inline-block mt-1 text-[11px] text-emerald-400 hover:underline">Buka OpenStreetMap &rarr;</a>` : ''}
        </div>
      `

      const marker = L.marker(latLng, { icon: pinIcon })
        .bindPopup(popupHtml)
        .addTo(map)

      marker.on('click', () => {
        onSelectPlace?.(item)
      })

      markers.push(marker)
    })

    // Draw route line (emerald green from mockup)
    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: '#10b981',
        weight: 3,
        opacity: 0.85,
        dashArray: '6, 6',
      }).addTo(map)
    }

    // Fit bounds to show all pins
    if (markers.length > 0) {
      const group = L.featureGroup(markers)
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 14 })
    }

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [items, selectedDay, onSelectPlace])

  function toggleFullscreen() {
    setIsFullscreen(!isFullscreen)
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize()
    }, 200)
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-[#12161f] shadow-lg transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 rounded-2xl shadow-2xl' : className
      }`}
    >
      {/* Map Header Overlay */}
      <div className="absolute left-3 top-3 z-[400] flex items-center gap-2 rounded-lg bg-slate-900/80 px-2.5 py-1.5 backdrop-blur-md border border-slate-700/50">
        <MapPin className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
          {destination} {selectedDay ? `— Hari ${selectedDay}` : 'Route'}
        </span>
        {validItems.length > 0 && (
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
            {validItems.length} Lokasi
          </span>
        )}
      </div>

      {/* Expand / Minimize Control */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute right-3 top-3 z-[400] grid h-8 w-8 place-items-center rounded-lg bg-slate-900/80 text-slate-300 backdrop-blur-md border border-slate-700/50 hover:bg-slate-800 hover:text-white transition"
        aria-label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>

      {/* Leaflet Container */}
      <div ref={mapContainerRef} className="h-full w-full min-h-[300px]" />

      {/* Map Footer Attribution */}
      <div className="absolute bottom-2 left-3 z-[400] pointer-events-none flex items-center gap-2 text-[10px] text-slate-400">
        <span className="font-semibold text-slate-300">Map</span>
        <span>© OpenStreetMap · CARTO</span>
      </div>
    </div>
  )
}
