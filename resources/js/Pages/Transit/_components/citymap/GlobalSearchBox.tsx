'use client'

import { useState, useEffect, useContext, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { useMap } from '@/Components/map/MapContext'
import { useMapStore } from '../../_store/useMapStore'
import { Input } from '@/Components/ui/input'
import { Card } from '@/Components/ui/card'
import { Badge } from '@/Components/ui/badge'
import { Button } from '@/Components/ui/button'
import { Search, Loader2, X, Bus, MapPin, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  type: 'route' | 'stop'
  id: string
  nameAr: string
  nameEn?: string
  cityId: string
  coordinates?: [number, number]
}

interface PoiResult {
  type: 'place'
  id: string
  nameAr: string
  category: string
  district?: string | null
  city?: string | null
  address?: string | null
  cityId: string
  coordinates: [number, number]
}

// "دار عبادة · حي الميدان، دمشق" — district/city disambiguate same-named
// places (جامع السلام vs مسجد السلام); fall back to the raw address,
// then to the bare category so the line is never a dangling separator.
function poiSubtitle(p: PoiResult): string {
  const loc = [p.district, p.city].filter(Boolean).join('، ') || p.address || ''
  return loc ? `${p.category} · ${loc}` : p.category
}

// POI names come from third-party geocoders and render into a map popup —
// escape before injecting into HTML.
function escapeHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface GlobalSearchBoxProps {
  cityId: string
  className?: string
}

export default function GlobalSearchBox({ cityId, className }: GlobalSearchBoxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ routes: SearchResult[]; stops: SearchResult[] }>({ routes: [], stops: [] })
  const [places, setPlaces] = useState<PoiResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const map = useMap()
  const { setSelectedRouteId, setHoveredStopId, showStops, setShowStops } = useMapStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const poiMarkerRef = useRef<maplibregl.Marker | null>(null)

  const allItems: (SearchResult | PoiResult)[] = [...results.routes, ...results.stops, ...places]

  const clearPoiMarker = () => {
    poiMarkerRef.current?.remove()
    poiMarkerRef.current = null
  }

  // Drop the POI pin when the component unmounts (city switch / navigate away).
  useEffect(() => {
    return () => clearPoiMarker()
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults({ routes: [], stops: [] })
      setPlaces([])
      setIsOpen(false)
      return
    }

    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const apiUrl = '/api'
        const params = new URLSearchParams({ q, city_id: cityId })
        // Routes/stops from our DB plus POIs (mosques, cafes…) from the
        // geocoder proxy. POI needs 3+ chars (backend min) — shorter queries
        // skip it instead of 422ing on every keystroke.
        const [localRes, poiRes] = await Promise.all([
          fetch(`${apiUrl}/v1/search?${params}`, { signal: ctrl.signal }),
          q.length >= 3
            ? fetch(`${apiUrl}/v1/geo/poi?${params}`, { signal: ctrl.signal })
            : Promise.resolve(null),
        ])
        if (ctrl.signal.aborted) return
        if (localRes.ok) {
          const data = await localRes.json()
          setResults({ routes: data.routes ?? [], stops: data.stops ?? [] })
        }
        if (poiRes && poiRes.ok) {
          const data = await poiRes.json()
          setPlaces(
            ((data.places ?? []) as any[]).map((p, i) => ({
              type: 'place' as const,
              id: `poi-${i}-${p.lat}-${p.lng}`,
              nameAr: p.name,
              category: p.category ?? 'مكان',
              district: p.district ?? null,
              city: p.city ?? null,
              address: p.address ?? null,
              cityId,
              coordinates: [p.lng, p.lat] as [number, number],
            }))
          )
        } else if (!poiRes) {
          setPlaces([])
        }
        setIsOpen(true)
        setActiveIndex(0)
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') console.error('Search error:', err)
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [query, cityId])

  const handleSelect = (item: SearchResult | PoiResult) => {
    setIsOpen(false)
    setQuery('')

    if (item.type === 'route') {
      clearPoiMarker()
      setSelectedRouteId(item.id)
    } else if (item.type === 'stop') {
      clearPoiMarker()
      setHoveredStopId(item.id)
      if (item.coordinates && map) {
        map.flyTo({
          center: item.coordinates,
          zoom: 15,
          essential: true
        })
      }
    } else if (item.type === 'place') {
      // POI from the geocoder: pin it, pop its name, and fly closer than a
      // stop (a single building needs zoom 16+ to be recognizable).
      clearPoiMarker()
      if (map) {
        const marker = new maplibregl.Marker({ color: '#8b5cf6' })
          .setLngLat(item.coordinates)
          .setPopup(
            new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(
              `<div dir="rtl" style="font-family: inherit; text-align: right;">` +
                `<div style="font-weight: 700; font-size: 13px;">${escapeHtml(item.nameAr)}</div>` +
                `<div style="font-size: 11px; opacity: 0.7;">${escapeHtml(poiSubtitle(item))}</div>` +
                `</div>`
            )
          )
          .addTo(map)
        marker.togglePopup()
        poiMarkerRef.current = marker
        map.flyTo({ center: item.coordinates, zoom: 16, essential: true })
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!isOpen || allItems.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (allItems[activeIndex]) {
        handleSelect(allItems[activeIndex])
      }
    }
  }

  return (
    <div dir="rtl" className={cn("pointer-events-auto absolute top-3 inset-x-3 z-20 mx-auto max-w-md flex items-center gap-2", className)}>
      <div className="relative flex-1 min-w-0">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (query.trim()) setIsOpen(true) }}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="ابحث عن خط، موقف، أو مكان (مسجد، مقهى...)"
          className="h-9 rounded-full border-border bg-card/95 pr-9 pl-9 text-sm shadow-md transition-colors focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground flex items-center">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={() => { setQuery(''); setIsOpen(false) }}
              className="rounded-full p-0.5 hover:text-foreground transition-colors"
              aria-label="مسح البحث"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        {isOpen && (results.routes.length > 0 || results.stops.length > 0 || places.length > 0) && (
          <Card
            onMouseDown={(e) => e.preventDefault()}
            className="absolute right-0 top-full mt-1.5 z-20 max-h-80 w-full overflow-y-auto p-1.5 shadow-lg border-border bg-card/95 backdrop-blur-md rounded-xl"
          >
            {results.routes.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Bus className="h-3 w-3" />
                  <span>الخطوط</span>
                </div>
                {results.routes.map((route, index) => {
                  const itemIndex = index
                  const isSelected = activeIndex === itemIndex
                  return (
                    <button
                      key={route.id}
                      type="button"
                      onClick={() => handleSelect(route)}
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition-colors",
                        isSelected ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50 text-foreground"
                      )}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{route.nameAr}</span>
                        {route.nameEn && <span className="truncate text-xs text-muted-foreground">{route.nameEn}</span>}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">خط</Badge>
                    </button>
                  )
                })}
              </div>
            )}

            {results.stops.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>المواقف</span>
                </div>
                {results.stops.map((stop, index) => {
                  const itemIndex = results.routes.length + index
                  const isSelected = activeIndex === itemIndex
                  return (
                    <button
                      key={stop.id}
                      type="button"
                      onClick={() => handleSelect(stop)}
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition-colors",
                        isSelected ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate font-medium">{stop.nameAr}</span>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">موقف</Badge>
                    </button>
                  )
                })}
              </div>
            )}

            {places.length > 0 && (
              <div>
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Landmark className="h-3 w-3" />
                  <span>أماكن</span>
                </div>
                {places.map((place, index) => {
                  const itemIndex = results.routes.length + results.stops.length + index
                  const isSelected = activeIndex === itemIndex
                  return (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => handleSelect(place)}
                      onMouseEnter={() => setActiveIndex(itemIndex)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start text-sm transition-colors",
                        isSelected ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50 text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Landmark className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate font-medium">{place.nameAr}</span>
                          <span className="truncate text-xs text-muted-foreground">{poiSubtitle(place)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 border-violet-500/40 text-violet-600 dark:text-violet-400">مكان</Badge>
                    </button>
                  )
                })}
                <div className="px-2 pt-1 text-[10px] text-muted-foreground/70">بيانات الأماكن: © مساهمو OpenStreetMap</div>
              </div>
            )}
          </Card>
        )}

        {isOpen && !loading && query.trim() && results.routes.length === 0 && results.stops.length === 0 && places.length === 0 && (
          <Card className="absolute right-0 top-full mt-1.5 z-20 w-full p-3 shadow-lg border-border bg-card/95 backdrop-blur-md rounded-xl">
            <p className="text-sm text-muted-foreground text-center">لا توجد نتائج — جرّب اسماً مختلفاً</p>
          </Card>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setShowStops(!showStops)}
        className={cn(
          "h-9 w-9 shrink-0 rounded-full shadow-md transition-all border-border",
          showStops
            ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary"
            : "bg-card/95 text-muted-foreground hover:text-foreground backdrop-blur-md"
        )}
        title={showStops ? "إخفاء نقاط المواقف" : "إظهار نقاط المواقف"}
        aria-label={showStops ? "إخفاء نقاط المواقف" : "إظهار نقاط المواقف"}
      >
        <MapPin className={cn("h-4 w-4 transition-transform", !showStops && "opacity-50 scale-90")} />
      </Button>
    </div>
  )
}
