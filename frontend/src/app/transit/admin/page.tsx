'use client'

import React, { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Draft {
  id: number
  user_id: number
  city_id: string
  name_ar: string
  name_en: string | null
  price: number | null
  notes: string | null
  geojson: any
  status: string
  created_at: string
}

export default function TransitAdminPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDrafts()
  }, [])

  const fetchDrafts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/admin/route-drafts')
      const data = await res.json()
      setDrafts(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current) return

    const instance = new maplibregl.Map({
      container: mapContainer.current,
      style: '/styles/styles/dark-matter.json',
      center: [36.2913, 33.5138],
      zoom: 12
    })

    instance.on('load', () => {
      // Add source and layers for preview
      instance.addSource('draft-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      })

      // Line layer
      instance.addLayer({
        id: 'draft-line',
        type: 'line',
        source: 'draft-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#f59e0b', // amber-500
          'line-width': 4
        },
        filter: ['==', ['geometry-type'], 'LineString']
      })

      // Points layer
      instance.addLayer({
        id: 'draft-points',
        type: 'circle',
        source: 'draft-source',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ef4444', // red-500
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        },
        filter: ['==', ['geometry-type'], 'Point']
      })

      setMap(instance)
    })

    return () => instance.remove()
  }, [])

  // Update Map when draft is selected
  useEffect(() => {
    if (!map || !selectedDraft) return

    const source = map.getSource('draft-source') as maplibregl.GeoJSONSource
    if (source) {
      source.setData(selectedDraft.geojson)
    }

    // Try to fit bounds if there's a LineString
    const lineFeature = selectedDraft.geojson.features.find((f: any) => f.geometry.type === 'LineString')
    if (lineFeature) {
      const coordinates = lineFeature.geometry.coordinates
      const bounds = coordinates.reduce((bounds: maplibregl.LngLatBounds, coord: number[]) => {
        return bounds.extend(coord as maplibregl.LngLatLike)
      }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]))

      map.fitBounds(bounds, { padding: 50 })
    }
  }, [map, selectedDraft])

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/v1/admin/route-drafts/${id}/${action}`, {
        method: 'POST'
      })
      if (res.ok) {
        alert(`تم ${action === 'approve' ? 'الموافقة على' : 'رفض'} المسودة بنجاح`)
        setSelectedDraft(null)
        fetchDrafts()
      } else {
        const err = await res.json()
        alert('حدث خطأ: ' + (err.message || 'Unknown error'))
      }
    } catch (err) {
      console.error(err)
      alert('Network error')
    }
  }

  return (
    <div className="flex h-screen w-full bg-[var(--bg)] text-[var(--fg)]" dir="rtl">
      {/* Sidebar List */}
      <div className="w-96 flex flex-col border-l border-[var(--border)] bg-[var(--bg-card)]">
        <div className="p-6 border-b border-[var(--border)]">
          <h1 className="text-2xl font-bold text-[var(--primary)]">لوحة الإدارة</h1>
          <p className="text-sm text-[var(--muted)]">مراجعة مسارات المجتمع</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-center text-[var(--muted)]">جاري التحميل...</p>
          ) : drafts.length === 0 ? (
            <p className="text-center text-[var(--muted)]">لا توجد مسودات حالياً</p>
          ) : (
            drafts.map(draft => (
              <div 
                key={draft.id} 
                onClick={() => setSelectedDraft(draft)}
                className={`p-4 border rounded cursor-pointer transition ${
                  selectedDraft?.id === draft.id 
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10' 
                    : 'border-[var(--border)] hover:border-[var(--muted)]'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold">{draft.name_ar}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    draft.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                    draft.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                    'bg-red-500/20 text-red-500'
                  }`}>
                    {draft.status === 'pending' ? 'قيد الانتظار' : draft.status === 'approved' ? 'مقبول' : 'مرفوض'}
                  </span>
                </div>
                <div className="text-sm text-[var(--muted)] space-y-1">
                  <p>المدينة: {draft.city_id}</p>
                  <p>التاريخ: {new Date(draft.created_at).toLocaleDateString('ar-SY')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        <div ref={mapContainer} className="flex-1" />
        
        {/* Action Panel over Map */}
        {selectedDraft && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl p-6 w-[400px]">
            <h2 className="text-xl font-bold mb-4">{selectedDraft.name_ar}</h2>
            
            <div className="space-y-2 mb-6 text-sm">
              <p><span className="text-[var(--muted)]">السعر:</span> {selectedDraft.price ? `${selectedDraft.price} ل.س` : 'غير محدد'}</p>
              <p><span className="text-[var(--muted)]">ملاحظات:</span> {selectedDraft.notes || 'لا يوجد'}</p>
              <p><span className="text-[var(--muted)]">النقاط المدخلة:</span> {selectedDraft.geojson?.features?.filter((f: any) => f.geometry.type === 'Point').length || 0} محطة</p>
            </div>

            {selectedDraft.status === 'pending' && (
              <div className="flex gap-3">
                <button 
                  onClick={() => handleAction(selectedDraft.id, 'approve')}
                  className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
                >
                  موافقة ونشر
                </button>
                <button 
                  onClick={() => handleAction(selectedDraft.id, 'reject')}
                  className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 transition"
                >
                  رفض
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
