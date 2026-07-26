'use client'

import { MapPin, MapPinOff, Filter, ChevronLeft, Plus } from 'lucide-react'
import { Link } from '@inertiajs/react'
import { useMapStore } from '../_store/useMapStore'
import { useAuth } from '@/Contexts/AuthContext'
import { Button } from '@/Components/ui/button'
import { ScrollArea } from '@/Components/ui/scroll-area'
import { Separator } from '@/Components/ui/separator'
import { Label } from '@/Components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/Components/ui/select'
import type { City } from '../_types'

interface SidebarMapToolsProps {
  city: City | undefined
  routes: any[]
  selectedRouteId: string | null
  allStops: any[]
}

export function SidebarMapTools({ city, routes, selectedRouteId, allStops }: SidebarMapToolsProps) {
  const { setSelectedRouteId, setShowStops, showStops } = useMapStore()
  const { user } = useAuth()

  const handleRouteChange = (routeId: string) => {
    const value = routeId === '__all__' ? null : routeId
    setSelectedRouteId(value)
    if (value) {
      window.history.replaceState({}, '', `/transit/city/${city?.id}/map?route=${value}`)
    } else {
      window.history.replaceState({}, '', `/transit/city/${city?.id}/map`)
    }
  }

  const filteredStopsCount = selectedRouteId
    ? allStops.filter(f => Array.isArray(f.properties.routeIds) && f.properties.routeIds.includes(selectedRouteId)).length
    : allStops.length

  return (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/transit/city/${city?.id}`} aria-label="رجوع للمدينة">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-foreground">{city?.nameAr}</h2>
            <p className="text-xs text-muted-foreground">عرض الخريطة</p>
          </div>
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

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1 text-xs">
              <Filter className="h-3.5 w-3.5" />
              تصفية المسار
            </Label>
            <Select
              value={selectedRouteId || '__all__'}
              onValueChange={handleRouteChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={`جميع المسارات (${routes.length})`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">جميع المسارات ({routes.length})</SelectItem>
                {routes.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nameAr} ({r.stopsCount ?? 0} موقف)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant={showStops ? 'default' : 'outline'}
            className="w-full justify-between"
            onClick={() => setShowStops(!showStops)}
            aria-pressed={showStops}
          >
            <span className="flex items-center gap-2">
              {showStops ? <MapPin className="h-4 w-4" /> : <MapPinOff className="h-4 w-4" />}
              المواقف
            </span>
            <span className="text-xs opacity-60">
              {showStops ? `${filteredStopsCount} مظهر` : 'مخفي'}
            </span>
          </Button>

          {selectedRouteId && (
            <Button variant="secondary" asChild className="w-full">
              <Link href={`/transit/city/${city?.id}/route/${selectedRouteId}`}>
                عرض تفاصيل المسار
              </Link>
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
