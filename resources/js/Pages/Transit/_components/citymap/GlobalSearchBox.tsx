'use client'

import { useState, useEffect, useContext, useRef } from 'react'
import { useMap } from '@/Components/map/MapContext'
import { useMapStore } from '../../_store/useMapStore'
import { Input } from '@/Components/ui/input'
import { Card } from '@/Components/ui/card'
import { Badge } from '@/Components/ui/badge'
import { Button } from '@/Components/ui/button'
import { Search, Loader2, X, Bus, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  type: 'route' | 'stop'
  id: string
  nameAr: string
  nameEn?: string
  cityId: string
  coordinates?: [number, number]
}

interface GlobalSearchBoxProps {
  cityId: string
  className?: string
}

export default function GlobalSearchBox({ cityId, className }: GlobalSearchBoxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ routes: SearchResult[]; stops: SearchResult[] }>({ routes: [], stops: [] })
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const map = useMap()
  const { setSelectedRouteId, setHoveredStopId, showStops, setShowStops } = useMapStore()
  const inputRef = useRef<HTMLInputElement>(null)

  const allItems = [...results.routes, ...results.stops]

  useEffect(() => {
    if (!query.trim()) {
      setResults({ routes: [], stops: [] })
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const apiUrl = '/api'
        const params = new URLSearchParams({ q: query, city_id: cityId })
        const res = await fetch(`${apiUrl}/v1/search?${params}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setIsOpen(true)
          setActiveIndex(0)
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, cityId])

  const handleSelect = (item: SearchResult) => {
    setIsOpen(false)
    setQuery('')
    
    if (item.type === 'route') {
      setSelectedRouteId(item.id)
    } else if (item.type === 'stop') {
      setHoveredStopId(item.id)
      if (item.coordinates && map) {
        map.flyTo({
          center: item.coordinates,
          zoom: 15,
          essential: true
        })
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
          placeholder="ابحث عن خط سيرفيس أو موقف..."
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

        {isOpen && (results.routes.length > 0 || results.stops.length > 0) && (
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
