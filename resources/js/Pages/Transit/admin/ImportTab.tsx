'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/Components/ui/button'
import { Badge } from '@/Components/ui/badge'
import { Card, CardContent } from '@/Components/ui/card'
import { Input } from '@/Components/ui/input'
import { Textarea } from '@/Components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/Components/ui/select'
import { ROUTE_PALETTE } from '../_lib/mapColors'
import {
  Link2, Upload, Loader2, CheckCircle2, Trash2, PencilLine, FileUp, X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportCandidate {
  name_ar: string
  name_en: string | null
  price: number | null
  notes: string | null
  geojson: any
  vertex_count: number
  stop_count: number
  bounds: [number, number, number, number] | null
  warnings: string[]
  source: { doc_name: string; doc_description: string | null }
  suggested_city_id: string | null
}

interface EditableStop {
  coordinates: [number, number]
  nameAr: string
}

interface ImportTabProps {
  cities: { id: string; nameAr: string; nameEn?: string }[]
  showToast: (msg: string, ok?: boolean) => void
  onPreview: (geojson: any | null, colorIndex: number, cityId?: string) => void
  onDraftCreated: () => void
}

function getCsrfToken(): string {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function stopsFromGeojson(geojson: any): EditableStop[] {
  const out: EditableStop[] = []
  for (const f of geojson?.features ?? []) {
    if (f?.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
      out.push({
        coordinates: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
        nameAr: f.properties?.nameAr ?? f.properties?.name ?? '',
      })
    }
  }
  return out
}

function lineFromGeojson(geojson: any): any | null {
  for (const f of geojson?.features ?? []) {
    const t = f?.geometry?.type
    if (t === 'LineString' || t === 'MultiLineString') return f
  }
  return null
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportTab({ cities, showToast, onPreview, onDraftCreated }: ImportTabProps) {
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [cityOverride, setCityOverride] = useState('auto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mid, setMid] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<ImportCandidate[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)

  // Editable copy of the selected candidate
  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [colorIndex, setColorIndex] = useState(0)
  const [cityId, setCityId] = useState('')
  const [stops, setStops] = useState<EditableStop[]>([])
  const [publishing, setPublishing] = useState<'draft' | 'direct' | null>(null)
  const [createdDraftId, setCreatedDraftId] = useState<number | null>(null)

  const selected = candidates[selectedIdx] ?? null

  // Init / reset the edit form whenever the selection changes
  useEffect(() => {
    if (!selected) return
    setNameAr(selected.name_ar ?? '')
    setNameEn(selected.name_en ?? '')
    setPrice(selected.price != null ? String(selected.price) : '')
    setNotes(selected.notes ?? '')
    setColorIndex(0)
    setCityId(
      cityOverride !== 'auto' ? cityOverride : (selected.suggested_city_id ?? cities[0]?.id ?? ''),
    )
    setStops(stopsFromGeojson(selected.geojson))
    setCreatedDraftId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, candidates])

  // City override applies to the current edit form too
  useEffect(() => {
    if (cityOverride !== 'auto') setCityId(cityOverride)
    else if (selected) setCityId(selected.suggested_city_id ?? cities[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityOverride])

  // Live map preview (line + edited stops, current color)
  const previewGeojson = useMemo(() => {
    if (!selected) return null
    const line = lineFromGeojson(selected.geojson)
    if (!line) return null
    return {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: {}, geometry: line.geometry },
        ...stops.map((s) => ({
          type: 'Feature',
          properties: { nameAr: s.nameAr },
          geometry: { type: 'Point', coordinates: s.coordinates },
        })),
      ],
    }
  }, [selected, stops])

  useEffect(() => {
    onPreview(previewGeojson, colorIndex, cityId || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewGeojson, colorIndex, cityId])

  const handleFetch = async () => {
    if (!url.trim() && !file) {
      setError('الصق رابط خريطة Google My Maps أولاً أو اختر ملفاً')
      return
    }
    setLoading(true)
    setError(null)
    setCandidates([])
    setCreatedDraftId(null)
    onPreview(null, colorIndex)
    try {
      let res: Response
      if (file) {
        const form = new FormData()
        form.append('file', file)
        if (url.trim()) form.append('url', url.trim())
        if (cityOverride !== 'auto') form.append('city_id', cityOverride)
        res = await fetch('/api/v1/admin/routes/import-preview', {
          method: 'POST',
          headers: { 'X-XSRF-TOKEN': getCsrfToken() },
          credentials: 'include',
          body: form,
        })
      } else {
        res = await fetch('/api/v1/admin/routes/import-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
          credentials: 'include',
          body: JSON.stringify({
            url: url.trim(),
            ...(cityOverride !== 'auto' ? { city_id: cityOverride } : {}),
          }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.message ?? `خطأ HTTP ${res.status}`)
        return
      }
      const routes = data.routes ?? []
      if (routes.length === 0) {
        setError('لم يتم العثور على خطوط في هذه الخريطة')
        return
      }
      setMid(data.mid ?? null)
      setCandidates(routes)
      setSelectedIdx(0)
      showToast(`تم جلب ${routes.length} ${routes.length === 1 ? 'خط' : 'خطوط'} للمعاينة`)
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async (mode: 'draft' | 'direct') => {
    if (!selected || !previewGeojson) return
    if (!nameAr.trim()) {
      showToast('اسم الخط بالعربية مطلوب', false)
      return
    }
    if (!cityId) {
      showToast('اختر المدينة أولاً', false)
      return
    }
    setPublishing(mode)
    try {
      const res = await fetch('/api/v1/admin/routes/import-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          city_id: cityId,
          name_ar: nameAr.trim(),
          name_en: nameEn.trim() || null,
          price: price.trim() === '' ? null : parseInt(price, 10),
          color_index: colorIndex,
          notes: notes.trim() || null,
          geojson: previewGeojson,
          mode,
          source_mid: mid,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast('خطأ: ' + (data.message ?? `HTTP ${res.status}`), false)
        return
      }
      if (mode === 'draft') {
        setCreatedDraftId(data.draft_id)
        showToast(`تم إنشاء المسودة #${data.draft_id} — راجعها في تبويب المسودات`)
      } else {
        showToast('تم نشر الخط المستورد')
        setCandidates([])
        setSelectedIdx(0)
        onPreview(null, colorIndex)
        onDraftCreated()
      }
    } catch {
      showToast('تعذّر الاتصال بالخادم', false)
    } finally {
      setPublishing(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
      {/* ── Fetch card ─────────────────────────────────────────── */}
      <div className="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-2.5">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5 text-primary" />
          1. الصق رابط Google My Maps
        </span>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.google.com/maps/d/...?mid=..."
          dir="ltr"
          className="h-9 text-xs text-left"
        />
        <div className="flex items-center gap-2">
          <label className="flex-1 flex items-center justify-center gap-1.5 h-9 px-3 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-primary/60 hover:text-foreground cursor-pointer transition-colors">
            <FileUp className="h-3.5 w-3.5" />
            {file ? file.name : 'أو ارفع KML / KMZ / GeoJSON (للخرائط الخاصة)'}
            <input
              type="file"
              accept=".kml,.kmz,.geojson,.json,.xml"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {file && (
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setFile(null)} title="إزالة الملف">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Select value={cityOverride} onValueChange={setCityOverride}>
            <SelectTrigger className="h-9 text-xs flex-1">
              <SelectValue placeholder="المدينة (تلقائي)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">تخمين تلقائي للمدينة</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nameAr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-9 text-xs gap-1.5 shrink-0" disabled={loading} onClick={handleFetch}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            جلب المعاينة
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          الخريطة يجب أن تكون عامة (Share ← Anyone with link). للخرائط الخاصة: من My Maps اختر Export ← KML ثم ارفع الملف هنا.
        </p>
        {error && (
          <div className="p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg text-[11px] text-destructive leading-relaxed">
            {error}
          </div>
        )}
      </div>

      {/* ── Multi-route selector ───────────────────────────────── */}
      {candidates.length > 1 && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {candidates.length} خطوط في هذه الخريطة — راجع وانشر كل واحد على حدة:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((c, i) => (
              <Badge
                key={i}
                variant={selectedIdx === i ? 'default' : 'outline'}
                className="cursor-pointer text-[11px] px-2.5 py-1"
                onClick={() => setSelectedIdx(i)}
              >
                {i + 1}. {c.name_ar.slice(0, 30)} ({c.stop_count} محطة)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit + publish ─────────────────────────────────────── */}
      {selected && (
        <div className="space-y-3">
          <div className="p-3 bg-card rounded-xl border border-border space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <PencilLine className="h-3.5 w-3.5 text-primary" />
                2. راجع وعدّل قبل النشر
              </span>
              <div className="flex gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{selected.vertex_count} نقطة</Badge>
                <Badge variant="secondary" className="text-[10px]">{stops.length} محطة</Badge>
              </div>
            </div>

            {selected.warnings.length > 0 && (
              <div className="space-y-1">
                {selected.warnings.map((w, i) => (
                  <div key={i} className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    ⚠ {w}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold">اسم الخط بالعربية <span className="text-destructive">*</span></label>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">الاسم بالإنجليزية</label>
                <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">التعرفة (ل.س)</label>
                <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} dir="ltr" className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">المدينة <span className="text-destructive">*</span></label>
                <Select value={cityId} onValueChange={setCityId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="اختر المدينة…" /></SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.nameAr}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground block">لون الخط</label>
                <div className="flex items-center gap-1 flex-wrap h-8">
                  {ROUTE_PALETTE.map((hex, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setColorIndex(idx)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${colorIndex === idx ? 'scale-110 border-foreground shadow-md ring-2 ring-primary/40' : 'border-transparent opacity-75 hover:opacity-100'}`}
                      style={{ backgroundColor: hex }}
                      title={`لون ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">ملاحظات</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-xs resize-none" />
            </div>

            {/* Stops */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold">المحطات ({stops.length})</span>
              {stops.length === 0 ? (
                <p className="text-[11px] text-muted-foreground py-2 border border-dashed rounded-lg text-center">
                  لا توجد محطات — سيُنشر الخط بدون مواقف.
                </p>
              ) : (
                <div className="max-h-44 overflow-y-auto space-y-1.5 pe-1">
                  {stops.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg border border-border bg-background">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                        {i + 1}
                      </span>
                      <Input
                        value={s.nameAr}
                        onChange={(e) => setStops((prev) => prev.map((p, j) => j === i ? { ...p, nameAr: e.target.value } : p))}
                        placeholder={`محطة ${i + 1}…`}
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        title="حذف المحطة"
                        onClick={() => setStops((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Publish ─────────────────────────────────────── */}
          <div className="p-3 bg-card rounded-xl border border-border space-y-2">
            <span className="text-xs font-semibold text-muted-foreground">3. النشر</span>
            {createdDraftId ? (
              <div className="p-2.5 bg-green-500/10 border border-green-500/30 rounded-lg text-xs text-green-700 dark:text-green-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                تم إنشاء المسودة #{createdDraftId} — راجعها في تبويب المسودات ثم وافق للنشر، أو عدّل هندستها في الاستوديو.
              </div>
            ) : (
              <>
                <Button
                  className="w-full h-9 text-xs font-bold gap-2"
                  disabled={publishing !== null}
                  onClick={() => handlePublish('draft')}
                >
                  {publishing === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  حفظ كمسودة للمراجعة (موصى به)
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-9 text-xs font-semibold gap-2"
                  disabled={publishing !== null}
                  onClick={() => handlePublish('direct')}
                >
                  {publishing === 'direct' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  نشر مباشر بدون مراجعة
                </Button>
                <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
                  المسودة تمر عبر الموافقة المعتادة (سجل تدقيق + نشر آمن). النشر المباشر للعمل الموثوق فقط.
                </p>
              </>
            )}
            {createdDraftId && (
              <Button variant="outline" className="w-full h-9 text-xs gap-2" onClick={onDraftCreated}>
                <CheckCircle2 className="h-4 w-4" />
                انتقال لتبويب المسودات للموافقة
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Source attribution ─────────────────────────────────── */}
      {selected && (
        <Card className="py-2">
          <CardContent className="p-0 px-3">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              المصدر: {selected.source.doc_name || 'My Maps'}
              {mid ? ` · mid: ${mid}` : ''}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
