'use client'

import { Navigation, ChevronRight, Plus } from 'lucide-react'
import { Link } from '@inertiajs/react'
import { useMapStore } from '../_store/useMapStore'
import { useAuth } from '@/Contexts/AuthContext'
import { Button } from '@/Components/ui/button'
import { Card, CardContent } from '@/Components/ui/card'
import { ScrollArea } from '@/Components/ui/scroll-area'
import { Separator } from '@/Components/ui/separator'
import type { City } from '../_types'

interface SidebarRouteDetailProps {
  route: any
  city: City | undefined
  stops: any[]
}

export function SidebarRouteDetail({ route, city, stops }: SidebarRouteDetailProps) {
  const { setSelectedRouteId } = useMapStore()
  const { user } = useAuth()

  if (!city || !route) return <div className="p-4 text-muted-foreground">المسار غير موجود</div>

  const handleBack = () => {
    setSelectedRouteId(null)
    window.history.replaceState({}, '', `/transit/city/${city.id}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack} aria-label="رجوع للقائمة">
            <ChevronRight className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white text-xs"
                style={{ backgroundColor: `hsl(var(--route-${route.colorIndex}))` }}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="16" height="16" x="4" y="3" rx="2" />
                  <path d="M4 11h16" />
                  <path d="M8 15h.01" />
                  <path d="M16 15h.01" />
                  <path d="M6 19v2" />
                  <path d="M18 19v2" />
                </svg>
              </span>
              <h3 className="font-bold text-foreground truncate">{route.nameAr}</h3>
            </div>
            {route.nameEn && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{route.nameEn}</p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <Card className="p-2">
            <CardContent className="p-0">
              <p className="text-muted-foreground">سعر الركوب</p>
              <p className="font-bold text-primary">{route.priceNew?.toLocaleString('ar-SY') ?? '—'} ل.س</p>
            </CardContent>
          </Card>
          <Card className="p-2">
            <CardContent className="p-0">
              <p className="text-muted-foreground">المواقف</p>
              <p className="font-bold text-foreground">{stops.length} موقف</p>
            </CardContent>
          </Card>
        </div>

        {user && (
          <Button asChild className="mt-3 w-full" size="sm">
            <Link href="/transit/studio">
              <Plus className="h-4 w-4" />
              إضافة مسار
            </Link>
          </Button>
        )}
      </div>

      <Separator />

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-muted-foreground">المواقف</h4>
            <span className="text-xs text-muted-foreground">{stops.length}</span>
          </div>

          {stops.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد مواقف مسجلة لهذا الخط</p>
          ) : (
            <div className="space-y-2">
              {stops.map((stop, index) => (
                <a
                  key={stop.properties.id}
                  href={`https://www.google.com/maps/dir/?api=1&destination=${stop.geometry.coordinates[1]},${stop.geometry.coordinates[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:shadow-sm w-full"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 text-right">
                      <p className="text-sm font-medium text-foreground leading-snug break-words">{stop.properties.nameAr}</p>
                      {stop.properties.nameEn && (
                        <p className="text-xs text-muted-foreground leading-snug break-words">{stop.properties.nameEn}</p>
                      )}
                    </div>
                  </div>
                  <Navigation className="h-4 w-4 text-primary shrink-0" />
                </a>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
