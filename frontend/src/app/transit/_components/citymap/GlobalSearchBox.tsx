'use client'

import { useState, useEffect, useContext } from 'react'
import { MapContext } from './MapContext'
import { useMapStore } from '../../_store/useMapStore'

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
}

export default function GlobalSearchBox({ cityId }: GlobalSearchBoxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ routes: SearchResult[]; stops: SearchResult[] }>({ routes: [], stops: [] })
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const map = useContext(MapContext)
  const { setSelectedRouteId, setHoveredStopId } = useMapStore()

  useEffect(() => {
    if (!query.trim()) {
      setResults({ routes: [], stops: [] })
      setIsOpen(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'
        const params = new URLSearchParams({ q: query, city_id: cityId })
        const res = await fetch(`${apiUrl}/api/v1/search?${params}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setIsOpen(true)
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
    setQuery('') // Or keep the name
    
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

  return (
    <div className="absolute top-4 left-4 right-4 z-20 mx-auto max-w-md">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث عن خط سيرفيس أو موقف..."
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 pl-10 text-sm shadow-sm transition-colors focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
          dir="rtl"
        />
        <div className="absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]">
          {loading ? (
            <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          )}
        </div>

        {isOpen && (results.routes.length > 0 || results.stops.length > 0) && (
          <div className="absolute top-full mt-2 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg" dir="rtl">
            <div className="max-h-80 overflow-y-auto p-2">
              {results.routes.length > 0 && (
                <div className="mb-2">
                  <h3 className="px-3 py-1 text-xs font-semibold text-[var(--muted)]">الخطوط</h3>
                  {results.routes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => handleSelect(route)}
                      className="w-full rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <div className="font-medium text-[var(--text)]">{route.nameAr}</div>
                      {route.nameEn && <div className="text-xs text-[var(--muted)]">{route.nameEn}</div>}
                    </button>
                  ))}
                </div>
              )}
              {results.stops.length > 0 && (
                <div>
                  <h3 className="px-3 py-1 text-xs font-semibold text-[var(--muted)]">المواقف</h3>
                  {results.stops.map((stop) => (
                    <button
                      key={stop.id}
                      onClick={() => handleSelect(stop)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--gold)]">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      <div className="font-medium text-[var(--text)]">{stop.nameAr}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
