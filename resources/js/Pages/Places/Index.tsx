import { useEffect, useMemo, useRef, useState } from 'react';
import { Head } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PlacesMap } from './_components/PlacesMap';
import { FilterBar, parseLatLng } from './_components/FilterBar';
import { PhotoGrid } from './_components/PhotoGrid';
import { PlacesPanel } from './_components/PlacesPanel';
import { SubmitSheet } from './_components/SubmitSheet';
import { ViewToggle } from './_components/ViewToggle';
import { api, extractError } from './_lib/api';
import type { GridPhoto } from './_lib/discovery';
import type { GeoSuggestion, LatLng, Paginated, PlaceCategory, PlaceFeatureCollection, PlaceListItem } from './_lib/types';

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
  const [addMode, setAddMode] = useState(false);
  const [focus, setFocus] = useState<{ lng: number; lat: number; zoom?: number; key: number } | null>(null);
  const [highlight, setHighlight] = useState<LatLng | null>(null);
  // which q the current listPlaces was fetched for; guards the dropdown against stale results
  const [fetchedQuery, setFetchedQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeoSuggestion[]>([]);
  const geoReqRef = useRef(0);
  // the url is the source of truth on load so grid links share
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

  function handleGridPhotoClick(p: GridPhoto) {
    changeView('map');
    setSelectedId(p.place.id);
    setExpanded(true);
    flyTo(p.place.lng, p.place.lat);
  }

  useEffect(() => {
    api.mapData()
      .then(setFeatures)
      .catch((e) => setNotice({ text: extractError(e), destructive: true }));
  }, []);

  // ?place=ID deep link: open the detail and fly to the place once the map is ready
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('place');
    if (!raw || !/^\d+$/.test(raw)) return;
    const id = Number(raw);
    if (id <= 0) return;
    setSelectedId(id);
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
  }, [category, query]);

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
    // a coordinate query jumps the map; it must not filter the pins away
    const q = coordCandidate ? '' : query.trim();
    return {
      type: 'FeatureCollection',
      features: (features?.features ?? []).filter(
        (f) =>
          (category === null || f.properties.category === category) &&
          (q === '' || f.properties.name.includes(q)),
      ),
    };
  }, [features, category, query, coordCandidate]);

  // during the debounce window listPlaces still holds the previous query's results
  const searchPending = query.trim() !== '' && !coordCandidate && fetchedQuery !== query.trim();
  const searchResults = query.trim() === '' || searchPending ? [] : (listPlaces?.data ?? []).slice(0, 8);

  function handleMapClick(point: LatLng) {
    if (!addMode) {
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
    setAddMode(false);
  }

  function handlePinClick(id: number) {
    setSelectedId(id);
    setExpanded(true);
    setAddMode(false);
  }

  function handleSelectResult(place: PlaceListItem) {
    setSelectedId(place.id);
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
        <title>مشوار</title>
        <meta name="description" content="خريطة تفاعلية لأماكن تستحق المشوار في سوريا" />
      </Head>
      <main dir="rtl" className="relative h-[calc(100dvh-4rem)] overflow-hidden">
        <PlacesMap
          features={filteredFeatures}
          selectedId={selectedId}
          addMode={addMode}
          focus={focus}
          highlight={highlight}
          onPinClick={handlePinClick}
          onMapClick={handleMapClick}
          // bottom-56 keeps the map's bottom-left controls above the collapsed mobile sheet
          className="absolute inset-x-0 top-0 bottom-56 md:inset-0"
        />

        {/* stays mounted across view switches so fetched pages survive; renders null on the map view */}
        <PhotoGrid active={view === 'grid'} onPhotoClick={handleGridPhotoClick} />

        {/* pr-96 keeps the floating bar clear of the side panel on desktop (map view only);
            z-20 keeps the search dropdown above the z-10 bottom sheet (later sibling) */}
        <div className={`absolute top-3 inset-x-3 z-20 max-w-xl mx-auto space-y-2 md:max-w-3xl ${view === 'map' ? 'md:pr-96' : ''}`}>
          <FilterBar
            category={category}
            onCategoryChange={setCategory}
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
          <ViewToggle view={view} onChange={changeView} />
          {addMode && (
            <div className="flex justify-center">
              <span className="rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
                انقر على الخريطة لتحديد الموقع
              </span>
            </div>
          )}
          {notice && (
            <Alert variant={notice.destructive ? 'destructive' : 'default'} className="flex items-start justify-between gap-2">
              <AlertDescription>{notice.text}</AlertDescription>
              <button type="button" aria-label="إغلاق" onClick={() => setNotice(null)}>
                <X className="h-4 w-4" />
              </button>
            </Alert>
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
                onSelect={handlePanelSelect}
                hasMore={listPlaces !== null && listPlaces.current_page < listPlaces.last_page}
                onLoadMore={() => listPlaces && fetchList(listPlaces.current_page + 1)}
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
