import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';

import { X } from 'lucide-react';import MainLayout from '@/Layouts/MainLayout';
import { FilterBar, parseLatLng, type ViewFilter } from './_components/FilterBar';
import { PhotoGrid } from './_components/PhotoGrid';
import { PlacesPanel } from './_components/PlacesPanel';
import { SubmitSheet } from './_components/SubmitSheet';
import { ViewToggle } from './_components/ViewToggle';
import { BottomSheet } from '@/Components/BottomSheet';
import { api } from '@/Domain/places/api';
import { apiErrorMessage } from '@/Lib/api';
import { notify } from '@/Lib/notify';
import type { GeoSuggestion, GridPhoto, HotelFeatureCollection, LatLng, Paginated, PlaceCategory, PlaceFeatureCollection, PlaceListItem } from '@/Domain/places/types';
import { inSyriaBox } from '@/Domain/geography/syria';

const PlacesMap = lazy(() => import('./_components/PlacesMap').then(m => ({ default: m.PlacesMap })));

const EMPTY_HOTEL_GEOJSON: HotelFeatureCollection = { type: 'FeatureCollection', features: [] };

export default function Index() {
  const [features, setFeatures] = useState<PlaceFeatureCollection | null>(null);
  const [hotelFeatures, setHotelFeatures] = useState<HotelFeatureCollection>(EMPTY_HOTEL_GEOJSON);
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<'place' | 'hotel' | null>(null);
  const [submitPoint, setSubmitPoint] = useState<LatLng | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [listPlaces, setListPlaces] = useState<Paginated<PlaceListItem> | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [focus, setFocus] = useState<{ lng: number; lat: number; zoom?: number; key: number } | null>(null);
  const [highlight, setHighlight] = useState<LatLng | null>(null);
  // which q the current listPlaces was fetched for; guards the dropdown against stale results
  const [fetchedQuery, setFetchedQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeoSuggestion[]>([]);
  const geoReqRef = useRef(0);
  // the url is the source of truth on load so grid links share
  const [guide, setGuide] = useState<{ id: number; name: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('guide');
    return raw && /^\d+$/.test(raw) ? { id: Number(raw), name: '' } : null;
  });
  const [view, setView] = useState<'map' | 'grid'>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'grid' ? 'grid' : 'map',
  );

  // stale-response guard for the debounced list fetch
  const requestRef = useRef(0);
  const focusKeyRef = useRef(0);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flyTo(lng: number, lat: number) {
    setFocus({ lng, lat, zoom: 15, key: ++focusKeyRef.current });
  }

  function changeView(v: 'map' | 'grid') {
    setView(v);
    const url = new URL(window.location.href);
    if (v === 'grid') url.searchParams.set('view', 'grid');
    else url.searchParams.delete('view');
    window.history.replaceState(null, '', url);
  }

  function selectGuide(g: { id: number; name: string } | null) {
    setGuide(g);
    setSelectedId(null);
    setSelectedType(null);
    const url = new URL(window.location.href);
    if (g) url.searchParams.set('guide', String(g.id));
    else url.searchParams.delete('guide');
    window.history.replaceState(null, '', url);
  }

  function handleGridPhotoClick(p: GridPhoto) {
    changeView('map');
    setSelectedId(p.place.id);
    setSelectedType('place');
    flyTo(p.place.lng, p.place.lat);
  }

  // a ?guide= link arrives without a name: look it up so the chip reads properly
  useEffect(() => {
    if (!guide || guide.name !== '') return;
    api.guides('submissions')
      .then((res) => {
        const match = res.guides.find((g) => g.user_id === guide.id);
        setGuide({ id: guide.id, name: match?.name ?? 'مرشد' });
      })
      .catch(() => setGuide((g) => (g ? { ...g, name: 'مرشد' } : null)));
  }, [guide?.id]);

  useEffect(() => {
    api.mapData()
      .then(setFeatures)
      .catch((e) => notify.error(apiErrorMessage(e)));
    api.hotelMapData()
      .then(setHotelFeatures)
      .catch((e) => notify.error(apiErrorMessage(e, 'تعذر تحميل طبقة الفنادق')));
  }, []);

  // ?place=ID deep link: open the detail and fly to the place once the map is ready
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('place');
    if (!raw || !/^\d+$/.test(raw)) return;
    const id = Number(raw);
    if (id <= 0) return;
    setSelectedId(id);
    setSelectedType('place');
    api.getPlace(id)
      .then((place) => flyTo(place.lng, place.lat))
      .catch((e) => {
        notify.error(apiErrorMessage(e));
        // only clear if the deep-linked place is still selected; the user may have picked another
        setSelectedId((cur) => (cur === id ? null : cur));
      });
  }, []);

  useEffect(() => {
    if (!addMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addMode]);

  useEffect(() => () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchList(1), 300);
    return () => clearTimeout(timer);
  }, [category, query, guide]);

  // google places suggestions ride the same debounce; coord queries skip them
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || parseLatLng(q)) {
      setGeoResults([]);
      return;
    }
    const id = ++geoReqRef.current;
    const timer = setTimeout(() => {
      api.geocode(q)
        .then((res) => { if (id === geoReqRef.current) setGeoResults(res.suggestions); })
        .catch(() => { if (id === geoReqRef.current) setGeoResults([]); });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function fetchList(page: number) {
    const id = ++requestRef.current;
    // a coordinate query is a map jump, not a text filter: fetch the unfiltered list
    const q = parseLatLng(query) ? '' : query.trim();
    setListLoading(true);
    try {
      const res = await api.listPlaces({
        category: category ?? undefined,
        q: q || undefined,
        user_id: guide?.id,
        page,
      });
      if (id !== requestRef.current) return;
      setFetchedQuery(q);
      setListPlaces((prev) =>
        page > 1 && prev ? { ...res, data: [...prev.data, ...res.data] } : res,
      );
    } catch (e) {
      if (id === requestRef.current) notify.error(apiErrorMessage(e));
    } finally {
      if (id === requestRef.current) setListLoading(false);
    }
  }

  const coordCandidate = useMemo(() => parseLatLng(query), [query]);

  const filteredFeatures = useMemo<PlaceFeatureCollection>(() => {
    // when viewFilter is 'hotels', hide all place pins
    if (viewFilter === 'hotels') return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: (features?.features ?? []).filter(
        (f) =>
          (category === null || f.properties.category === category) &&
          (guide === null || f.properties.user_id === guide.id),
      ),
    };
  }, [features, category, guide, viewFilter]);

  const filteredHotelFeatures = useMemo<HotelFeatureCollection>(() => {
    const result = viewFilter === 'places' ? EMPTY_HOTEL_GEOJSON : hotelFeatures;
    return result;
  }, [hotelFeatures, viewFilter]);

  // during the debounce window listPlaces still holds the previous query's results
  const searchPending = query.trim() !== '' && !coordCandidate && fetchedQuery !== query.trim();
  const searchResults = query.trim() === '' || searchPending ? [] : (listPlaces?.data ?? []).slice(0, 8);

  function handleMapClick(point: LatLng) {
    if (!addMode) {
      setSelectedId(null);
      setSelectedType(null);
      return;
    }
    // the same Syria bounding box the server enforces, so users learn before filling the form
    if (!inSyriaBox(point)) {
      notify.error('النقطة خارج حدود سوريا');
      return;
    }
    setSubmitPoint(point);
    setSubmitOpen(true);
    setAddMode(false);
  }

  function handlePinClick(id: number, type: 'place' | 'hotel') {
    setSelectedId(id);
    setSelectedType(type);
    setAddMode(false);
  }

  function handleSelectResult(place: PlaceListItem) {
    setSelectedId(place.id);
    setSelectedType('place');
    flyTo(place.lng, place.lat);
  }

  function handleGoToCoord(point: LatLng) {
    flyTo(point.lng, point.lat);
    setHighlight(point);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlight(null), 6000);
  }

  // panel taps must expand the mobile sheet too, or the detail opens 224px tall
  function handlePanelSelect(id: number, lat: number, lng: number, type: 'place' | 'hotel') {
    setSelectedId(id);
    setSelectedType(type);
    flyTo(lng, lat);
  }

  function handleClose() {
    setSelectedId(null);
    setSelectedType(null);
  }

  function handleSubmitted() {
    notify.success('تم إرسال المكان وسيظهر بعد الموافقة');
  }

  function handleSelectExisting(id: number) {
    setSubmitOpen(false);
    setSelectedId(id);
    setSelectedType('place');
  }

  return (
    <MainLayout>
      
      <h1 className="sr-only">مشوار — أماكن وفنادق</h1>
      <div dir="rtl" className="relative h-[calc(100dvh-var(--sz-navbar-h))] overflow-hidden">
        <Suspense fallback={<div className="absolute inset-0 bg-background flex items-center justify-center text-muted-foreground">جاري تحميل الخريطة...</div>}>
          <PlacesMap
            features={filteredFeatures}
            hotelFeatures={filteredHotelFeatures}
            selectedId={selectedId}
            selectedType={selectedType}
            addMode={addMode}
            focus={focus}
            highlight={highlight}
            onPinClick={(id) => handlePinClick(id, 'place')}
            onHotelPinClick={(id) => handlePinClick(id, 'hotel')}
            onMapClick={handleMapClick}
            // bottom-56 keeps the map's bottom-left controls above the collapsed mobile sheet
            className="absolute inset-0"
          />
        </Suspense>

        {/* stays mounted across view switches so fetched pages survive; renders null on the map view */}
        <PhotoGrid
          active={view === 'grid'}
          guideId={guide?.id ?? null}
          bannerActive={guide !== null}
          onPhotoClick={handleGridPhotoClick}
        />

        {/* ps-96 keeps the floating bar clear of the side panel on desktop (map view only);
            z-20 keeps the search dropdown above the z-10 bottom sheet (later sibling).
            pointer-events-none: this box overlaps the panel's tabs, and being on top it
            swallowed their clicks; every child opts back in individually */}
        <div className={`pointer-events-none absolute top-3 inset-x-3 z-20 max-w-xl mx-auto space-y-2 md:max-w-3xl ${view === 'map' ? 'md:ps-96' : ''}`}>
          <div className="flex items-center gap-2">
            <FilterBar
              className="pointer-events-auto min-w-0 flex-1"
              category={category}
              onCategoryChange={setCategory}
              viewFilter={viewFilter}
              onViewFilterChange={setViewFilter}
              query={query}
              onQueryChange={setQuery}
              results={searchResults}
              geoResults={coordCandidate ? [] : geoResults}
              resultsLoading={listLoading || searchPending}
              coordCandidate={coordCandidate}
              onSelectResult={handleSelectResult}
              onSelectGeo={(s) => handleGoToCoord({ lat: s.lat, lng: s.lng })}
              onGoToCoord={handleGoToCoord}
            />
            <ViewToggle view={view} onChange={changeView} className="pointer-events-auto shrink-0" />
          </div>
          {/* pointer-events-auto sits on the pill spans, not the full-width centering rows:
              a row-wide opt-in swallowed grid-photo taps across its whole strip */}
          {guide && (
            <div className="flex justify-center">
              <span className="pointer-events-auto flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-3 py-1 text-xs text-foreground shadow-sm">
                مساهمات {guide.name}
                <button type="button" aria-label="إلغاء التصفية" onClick={() => selectGuide(null)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          )}
          {addMode && view === 'map' && (
            <div className="flex justify-center">
              <span className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                انقر على الخريطة لتحديد الموقع
              </span>
            </div>
          )}
        </div>

        {/* FAB and the sheet/panel are conditionally unmounted in grid view (not css-hidden) */}
        {view === 'map' && (
          <>
            {/* Desktop sidebar */}
            <div className="hidden md:flex absolute top-0 right-0 h-full w-96 flex-col bg-card border-l border-border z-10">
              <PlacesPanel
                places={listPlaces?.data ?? []}
                loading={listLoading}
                selectedId={selectedId}
                selectedType={selectedType}
                onSelect={(id, lat, lng) => handlePanelSelect(id, lat, lng, 'place')}
                onClose={handleClose}
                onSelectHotel={(id, lat, lng) => handlePanelSelect(id, lat, lng, 'hotel')}
                hasMore={listPlaces !== null && listPlaces.current_page < listPlaces.last_page}
                onLoadMore={() => listPlaces && fetchList(listPlaces.current_page + 1)}
                onSelectGuide={selectGuide}
                addMode={addMode}
                onAddToggle={() => setAddMode((v) => !v)}
                className="min-h-0 flex-1"
              />
            </div>

            {/* Mobile bottom sheet */}
            <BottomSheet storageKey="mishwar-sheet-height">
              <PlacesPanel
                places={listPlaces?.data ?? []}
                loading={listLoading}
                selectedId={selectedId}
                selectedType={selectedType}
                onSelect={(id, lat, lng) => handlePanelSelect(id, lat, lng, 'place')}
                onClose={handleClose}
                onSelectHotel={(id, lat, lng) => handlePanelSelect(id, lat, lng, 'hotel')}
                hasMore={listPlaces !== null && listPlaces.current_page < listPlaces.last_page}
                onLoadMore={() => listPlaces && fetchList(listPlaces.current_page + 1)}
                onSelectGuide={selectGuide}
                addMode={addMode}
                onAddToggle={() => setAddMode((v) => !v)}
                className="min-h-0 flex-1"
              />
            </BottomSheet>
          </>
        )}

        <SubmitSheet
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          point={submitPoint}
          onSubmitted={handleSubmitted}
          onSelectExisting={handleSelectExisting}
        />
      </div>
    </MainLayout>
  );
}
