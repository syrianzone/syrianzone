import { useEffect, useMemo, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlacesMap } from './_components/PlacesMap';
import { FilterBar } from './_components/FilterBar';
import { PlacesPanel } from './_components/PlacesPanel';
import { SubmitSheet } from './_components/SubmitSheet';
import { api, extractError } from './_lib/api';
import type { LatLng, Paginated, PlaceCategory, PlaceFeatureCollection, PlaceListItem } from './_lib/types';

export default function Index() {
  const [features, setFeatures] = useState<PlaceFeatureCollection | null>(null);
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitPoint, setSubmitPoint] = useState<LatLng | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [listPlaces, setListPlaces] = useState<Paginated<PlaceListItem> | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<{ text: string; destructive: boolean } | null>(null);

  // stale-response guard for the debounced list fetch
  const requestRef = useRef(0);

  useEffect(() => {
    api.mapData()
      .then(setFeatures)
      .catch((e) => setNotice({ text: extractError(e), destructive: true }));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchList(1), 300);
    return () => clearTimeout(timer);
  }, [category, query]);

  async function fetchList(page: number) {
    const id = ++requestRef.current;
    setListLoading(true);
    try {
      const res = await api.listPlaces({
        category: category ?? undefined,
        q: query.trim() || undefined,
        page,
      });
      if (id !== requestRef.current) return;
      setListPlaces((prev) =>
        page > 1 && prev ? { ...res, data: [...prev.data, ...res.data] } : res,
      );
    } catch (e) {
      if (id === requestRef.current) setNotice({ text: extractError(e), destructive: true });
    } finally {
      if (id === requestRef.current) setListLoading(false);
    }
  }

  const filteredFeatures = useMemo<PlaceFeatureCollection>(() => {
    const q = query.trim();
    return {
      type: 'FeatureCollection',
      features: (features?.features ?? []).filter(
        (f) =>
          (category === null || f.properties.category === category) &&
          (q === '' || f.properties.name.includes(q)),
      ),
    };
  }, [features, category, query]);

  function handleMapClick(point: LatLng) {
    if (selectedId !== null) {
      setSelectedId(null);
      return;
    }
    // mirror the server's Syria bounding box so users learn before filling the form
    if (point.lat < 32.0 || point.lat > 37.5 || point.lng < 35.5 || point.lng > 42.5) {
      setNotice({ text: 'النقطة خارج حدود سوريا', destructive: true });
      return;
    }
    setSubmitPoint(point);
    setSubmitOpen(true);
  }

  function handlePinClick(id: number) {
    setSelectedId(id);
    setExpanded(true);
  }

  // panel taps must expand the mobile sheet too, or the detail opens 224px tall
  function handlePanelSelect(id: number | null) {
    setSelectedId(id);
    if (id !== null) setExpanded(true);
  }

  function handleSubmitted() {
    setNotice({ text: 'تم إرسال المكان وسيظهر بعد الموافقة', destructive: false });
  }

  function handleSelectExisting(id: number) {
    setSubmitOpen(false);
    setSelectedId(id);
    setExpanded(true);
  }

  return (
    <MainLayout>
      <Head>
        <title>أماكن خفية</title>
        <meta name="description" content="خريطة تفاعلية لأماكن سوريا الخفية" />
      </Head>
      <main dir="rtl" className="relative h-[calc(100dvh-4rem)] overflow-hidden">
        <PlacesMap
          features={filteredFeatures}
          selectedId={selectedId}
          onPinClick={handlePinClick}
          onMapClick={handleMapClick}
          // bottom-56 keeps the map's bottom-left controls above the collapsed mobile sheet
          className="absolute inset-x-0 top-0 bottom-56 md:inset-0"
        />

        {/* pr-96 keeps the floating bar clear of the side panel on desktop */}
        <div className="absolute top-3 inset-x-3 z-10 max-w-xl mx-auto space-y-2 md:pr-96 md:max-w-3xl">
          <FilterBar
            category={category}
            onCategoryChange={setCategory}
            query={query}
            onQueryChange={setQuery}
          />
          <div className="flex justify-center">
            <span className="rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
              انقر على الخريطة لإضافة مكان
            </span>
          </div>
          {notice && (
            <Alert variant={notice.destructive ? 'destructive' : 'default'} className="flex items-start justify-between gap-2">
              <AlertDescription>{notice.text}</AlertDescription>
              <button type="button" aria-label="إغلاق" onClick={() => setNotice(null)}>
                <X className="h-4 w-4" />
              </button>
            </Alert>
          )}
        </div>

        <div
          className={`absolute inset-x-0 bottom-0 z-10 flex flex-col bg-card border-t border-border md:inset-x-auto md:top-0 md:right-0 md:h-full md:w-96 md:border-t-0 md:border-l ${expanded ? 'h-[65dvh]' : 'h-56'}`}
        >
          <button
            type="button"
            className="flex w-full items-center justify-center py-1 text-muted-foreground md:hidden"
            aria-label={expanded ? 'تصغير القائمة' : 'توسيع القائمة'}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>
          <PlacesPanel
            places={listPlaces?.data ?? []}
            loading={listLoading}
            selectedId={selectedId}
            onSelect={handlePanelSelect}
            hasMore={listPlaces !== null && listPlaces.current_page < listPlaces.last_page}
            onLoadMore={() => listPlaces && fetchList(listPlaces.current_page + 1)}
            className="min-h-0 flex-1"
          />
        </div>

        <SubmitSheet
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          point={submitPoint}
          onSubmitted={handleSubmitted}
          onSelectExisting={handleSelectExisting}
        />
      </main>
    </MainLayout>
  );
}
