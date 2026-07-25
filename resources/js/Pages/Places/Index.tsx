import { useEffect, useMemo, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { PlacesMap } from './_components/PlacesMap';
import { FilterBar, parseLatLng, type ViewFilter } from './_components/FilterBar';
import { PhotoGrid } from './_components/PhotoGrid';
import { PlacesPanel } from './_components/PlacesPanel';
import { SubmitSheet } from './_components/SubmitSheet';
import { ViewToggle } from './_components/ViewToggle';
import { api, extractError } from './_lib/api';
import { discovery, type GridPhoto } from './_lib/discovery';
import type { GeoSuggestion, HotelFeatureCollection, LatLng, Paginated, PlaceCategory, PlaceFeatureCollection, PlaceListItem } from './_lib/types';

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
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<{ text: string; destructive: boolean } | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [focus, setFocus] = useState<{ lng: number; lat: number; zoom?: number; key: number } | null>(null);
  const [highlight, setHighlight] = useState<LatLng | null>(null);
  // which q the current listPlaces was fetched for; guards the dropdown against stale results
  const [fetchedQuery, setFetchedQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeoSuggestion[]>([]);
  const geoReqRef = useRef(0);
  // the url is the source of truth on load so grid links share
  const [guide, setGuide] = useState<{ id: number; name: string } | null>(() => {
    const raw = new URLSearchParams(window.location.search).get('guide');
    return raw && /^\d+$/.test(raw) ? { id: Number(raw), name: '' } : null;
  });
  const [view, setView] = useState<'map' | 'grid'>(() =>
    new URLSearchParams(window.location.search).get('view') === 'grid' ? 'grid' : 'map',
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
    setExpanded(true);
    flyTo(p.place.lng, p.place.lat);
  }

  // a ?guide= link arrives without a name: look it up so the chip reads properly
  useEffect(() => {
    if (!guide || guide.name !== '') return;
    discovery.guides('submissions')
      .then((res) => {
        const match = res.guides.find((g) => g.user_id === guide.id);
        setGuide({ id: guide.id, name: match?.name ?? 'مرشد' });
      })
      .catch(() => setGuide((g) => (g ? { ...g, name: 'مرشد' } : null)));
  }, [guide?.id]);

  useEffect(() => {
    api.mapData()
      .then(setFeatures)
      .catch((e) => setNotice({ text: extractError(e), destructive: true }));
    api.hotelMapData()
      .then(setHotelFeatures)
      .catch(() => {}); // hotels are optional; don't show error if API key not configured
  }, []);

  // ?place=ID deep link: open the detail and fly to the place once the map is ready
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('place');
    if (!raw || !/^\d+$/.test(raw)) return;
    const id = Number(raw);
    if (id <= 0) return;
    setSelectedId(id);
    setSelectedType('place');
    setExpanded(true);
    api.getPlace(id)
      .then((place) => flyTo(place.lng, place.lat))
      .catch((e) => {
        setNotice({ text: extractError(e), destructive: true });
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
      if (id === requestRef.current) setNotice({ text: extractError(e), destructive: true });
    } finally {
      if (id === requestRef.current) setListLoading(false);
    }
  }

  const coordCandidate = useMemo(() => parseLatLng(query), [query]);

  const filteredFeatures = useMemo<PlaceFeatureCollection>(() => {
    // when viewFilter is 'hotels', hide all place pins
    if (viewFilter === 'hotels') return { type: 'FeatureCollection', features: [] };
    // a coordinate query jumps the map; it must not filter the pins away
    const q = coordCandidate ? '' : query.trim();
    return {
      type: 'FeatureCollection',
      features: (features?.features ?? []).filter(
        (f) =>
          (category === null || f.properties.category === category) &&
          (guide === null || f.properties.user_id === guide.id) &&
          (q === '' || f.properties.name.includes(q)),
      ),
    };
  }, [features, category, query, coordCandidate, guide, viewFilter]);

  const filteredHotelFeatures = useMemo<HotelFeatureCollection>(() => {
    // when viewFilter is 'places', hide all hotel pins
    if (viewFilter === 'places') return EMPTY_HOTEL_GEOJSON;
    return hotelFeatures;
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
    // mirror the server's Syria bounding box so users learn before filling the form
    if (point.lat < 32.0 || point.lat > 37.5 || point.lng < 35.5 || point.lng > 42.5) {
      setNotice({ text: 'النقطة خارج حدود سوريا', destructive: true });
      return;
    }
    setSubmitPoint(point);
    setSubmitOpen(true);
    setAddMode(false);
  }

  function handlePinClick(id: number) {
    setSelectedId(id);
    setSelectedType('place');
    setExpanded(true);
    setAddMode(false);
  }

  function handleHotelPinClick(id: number) {
    setSelectedId(id);
    setSelectedType('hotel');
    setExpanded(true);
    setAddMode(false);
  }

  function handleSelectResult(place: PlaceListItem) {
    setSelectedId(place.id);
    setSelectedType('place');
    setExpanded(true);
    flyTo(place.lng, place.lat);
  }

  function handleGoToCoord(point: LatLng) {
    flyTo(point.lng, point.lat);
    setHighlight(point);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlight(null), 6000);
  }

  // panel taps must expand the mobile sheet too, or the detail opens 224px tall
  function handlePanelSelect(id: number, lat: number, lng: number) {
    setSelectedId(id);
    setSelectedType('place');
    setExpanded(true);
    flyTo(lng, lat);
  }

  function handlePanelSelectHotel(id: number, lat: number, lng: number) {
    setSelectedId(id);
    setSelectedType('hotel');
    setExpanded(true);
    flyTo(lng, lat);
  }

  function handleClose() {
    setSelectedId(null);
    setSelectedType(null);
  }

  function handleCloseHotel() {
    setSelectedId(null);
    setSelectedType(null);
  }

  function handleSubmitted() {
    setNotice({ text: 'تم إرسال المكان وسيظهر بعد الموافقة', destructive: false });
  }

  function handleSelectExisting(id: number) {
    setSubmitOpen(false);
    setSelectedId(id);
    setSelectedType('place');
    setExpanded(true);
  }

  return (
    <MainLayout>
      <Head>
        <title>مشوار</title>
        <meta name="description" content="خريطة تفاعلية لأماكن تستحق المشوار في سوريا" />
      </Head>
      <main dir="rtl" className="relative h-[calc(100dvh-4rem)] overflow-hidden">
        <PlacesMap
          features={filteredFeatures}
          hotelFeatures={filteredHotelFeatures}
          selectedId={selectedId}
          selectedType={selectedType}
          addMode={addMode}
          focus={focus}
          highlight={highlight}
          onPinClick={handlePinClick}
          onHotelPinClick={handleHotelPinClick}
          onMapClick={handleMapClick}
          // bottom-56 keeps the map's bottom-left controls above the collapsed mobile sheet
          className="absolute inset-x-0 top-0 bottom-56 md:inset-0"
        />

        {/* stays mounted across view switches so fetched pages survive; renders null on the map view */}
        <PhotoGrid
          active={view === 'grid'}
          guideId={guide?.id ?? null}
          bannerActive={guide !== null || notice !== null}
          onPhotoClick={handleGridPhotoClick}
        />

        {/* pr-96 keeps the floating bar clear of the side panel on desktop (map view only);
            z-20 keeps the search dropdown above the z-10 bottom sheet (later sibling).
            pointer-events-none: this box overlaps the panel's tabs, and being on top it
            swallowed their clicks; every child opts back in individually */}
        <div className={`pointer-events-none absolute top-3 inset-x-3 z-20 max-w-xl mx-auto space-y-2 md:max-w-3xl ${view === 'map' ? 'md:pr-96' : ''}`}>
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
          {notice && (
            <div className="flex justify-center">
              <span
                role="alert"
                className={`pointer-events-auto flex items-center gap-2 rounded-full border bg-card/95 px-3 py-1 text-xs shadow-sm ${
                  notice.destructive ? 'border-destructive/50 text-destructive' : 'border-border text-foreground'
                }`}
              >
                {notice.text}
                <button type="button" aria-label="إغلاق" onClick={() => setNotice(null)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* FAB and the sheet/panel are conditionally unmounted in grid view (not css-hidden) */}
        {view === 'map' && (
          <>
            {/* bottom-60 clears the collapsed mobile sheet; left-14 clears the map controls.
                hidden while the mobile sheet is expanded: the sheet would cover both FAB and map */}
            <Button
              type="button"
              className={`absolute left-14 bottom-60 z-10 shadow-lg md:bottom-6 ${expanded ? 'hidden md:inline-flex' : ''}`}
              onClick={() => setAddMode((v) => !v)}
            >
              {addMode ? <X /> : <Plus />}
              {addMode ? 'إلغاء الإضافة' : 'أضف مكاناً'}
            </Button>

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
                selectedType={selectedType}
                onSelect={handlePanelSelect}
                onClose={handleClose}
                onSelectHotel={handlePanelSelectHotel}
                onCloseHotel={handleCloseHotel}
                hasMore={listPlaces !== null && listPlaces.current_page < listPlaces.last_page}
                onLoadMore={() => listPlaces && fetchList(listPlaces.current_page + 1)}
                onSelectGuide={selectGuide}
                className="min-h-0 flex-1"
              />
            </div>
          </>
        )}

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
