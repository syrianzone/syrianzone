import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { THEME_REGISTRY } from '@/Lib/theme';
import type { LatLng, PlaceFeatureCollection } from '../_lib/types';

const SOURCE_ID = 'places';
const LAYERS = ['clusters', 'cluster-count', 'place-pin'];

// shapes Arabic labels on the vector basemap; lazy = loads only when RTL text appears
if (maplibregl.getRTLTextPluginStatus() === 'unloaded') {
  maplibregl.setRTLTextPlugin('/styles/mapbox-gl-rtl-text.min.js', true);
}

// data-theme on <html> always holds a concrete theme id (set pre-hydration by app.blade.php)
function styleUrl(): string {
  const id = document.documentElement.getAttribute('data-theme');
  const dark = THEME_REGISTRY.find((t) => t.id === id)?.isDark ?? true;
  return dark ? '/styles/styles/dark-matter-vector.json' : '/styles/styles/light-vector.json';
}

export function PlacesMap(props: {
  features: PlaceFeatureCollection;
  selectedId: number | null;
  addMode: boolean;
  focus: { lng: number; lat: number; zoom?: number; key: number } | null;
  highlight: LatLng | null;
  onPinClick: (id: number) => void;
  onMapClick: (point: LatLng) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const highlightMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // refs so map handlers registered once always see the latest props
  const featuresRef = useRef(props.features);
  featuresRef.current = props.features;
  const addModeRef = useRef(props.addMode);
  addModeRef.current = props.addMode;
  const selectedIdRef = useRef(props.selectedId);
  selectedIdRef.current = props.selectedId;
  const styleUrlRef = useRef('');
  const onPinClickRef = useRef(props.onPinClick);
  onPinClickRef.current = props.onPinClick;
  const onMapClickRef = useRef(props.onMapClick);
  onMapClickRef.current = props.onMapClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    styleUrlRef.current = styleUrl();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrlRef.current,
      center: [38.0, 35.0],
      zoom: 6.2,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl(), 'bottom-left');
    map.addControl(
      new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
      'bottom-left',
    );

    // runs on the initial style AND after every setStyle (which wipes custom sources/layers);
    // reads refs so a theme swap keeps current data and the selection ring
    const addSourcesAndLayers = (m: maplibregl.Map) => {
      if (m.getSource(SOURCE_ID)) return;

      m.addSource(SOURCE_ID, {
        type: 'geojson',
        data: featuresRef.current as GeoJSON.FeatureCollection,
        cluster: true,
        clusterRadius: 25,
        clusterMaxZoom: 10,
      });

      m.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': 'hsl(105, 12%, 38%)',
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 10, 10, 13, 30, 16],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.8,
        },
      });

      m.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 11, 'text-font': ['IBM Plex Sans Arabic Bold'] },
        paint: { 'text-color': '#ffffff' },
      });

      m.addLayer({
        id: 'place-pin',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': selectedIdRef.current == null ? 6 : ['case', ['==', ['get', 'id'], selectedIdRef.current], 9, 6],
          'circle-color': '#7d8a5c',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.9,
        },
      });
    };

    map.on('style.load', () => addSourcesAndLayers(map));

    // one-time work: handlers are delegated by layer ID, so they survive setStyle as long as
    // addSourcesAndLayers recreates the same IDs; never re-register them there (double-fire)
    map.on('load', () => {
      map.on('click', 'clusters', async (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(feature.properties?.cluster_id);
        map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });

      map.on('click', 'place-pin', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === 'number') onPinClickRef.current(id);
      });

      map.on('click', (e) => {
        const hits = map.queryRenderedFeatures(e.point, { layers: LAYERS });
        if (hits.length > 0) return;
        onMapClickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
      });

      // consult the add-mode ref so hovering/leaving a pin never drops the crosshair
      for (const layer of ['clusters', 'place-pin']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = addModeRef.current ? 'crosshair' : 'pointer'; });
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = addModeRef.current ? 'crosshair' : ''; });
      }

      setMapReady(true);
    });

    // live theme switch: swap the basemap style, style.load re-adds our sources/layers
    const observer = new MutationObserver(() => {
      const url = styleUrl();
      if (url !== styleUrlRef.current) {
        styleUrlRef.current = url;
        map.setStyle(url);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    mapRef.current = map;

    return () => {
      observer.disconnect();
      try {
        for (const layer of LAYERS) if (map.getLayer(layer)) map.removeLayer(layer);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // map may already be tearing down mid-load
      }
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(props.features as GeoJSON.FeatureCollection);
  }, [props.features, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    // getLayer guard: between setStyle and its style.load the layer briefly does not exist;
    // addSourcesAndLayers reads selectedIdRef, so the ring is restored on re-add anyway
    if (!map || !mapReady || !map.getLayer('place-pin')) return;
    map.setPaintProperty(
      'place-pin',
      'circle-radius',
      props.selectedId == null ? 6 : ['case', ['==', ['get', 'id'], props.selectedId], 9, 6],
    );
  }, [props.selectedId, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = props.addMode ? 'crosshair' : '';
  }, [props.addMode]);

  // mapReady dep queues a focus requested before the map finished loading
  useEffect(() => {
    const map = mapRef.current;
    const focus = props.focus;
    if (!map || !mapReady || !focus) return;
    map.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 15 });
  }, [props.focus?.key, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    highlightMarkerRef.current?.remove();
    highlightMarkerRef.current = null;
    if (props.highlight) {
      highlightMarkerRef.current = new maplibregl.Marker({ color: '#7d8a5c' })
        .setLngLat([props.highlight.lng, props.highlight.lat])
        .addTo(map);
    }
    return () => {
      highlightMarkerRef.current?.remove();
      highlightMarkerRef.current = null;
    };
  }, [props.highlight]);

  // inner div gets inline size: maplibre's stylesheet forces position:relative on its
  // container, which would defeat tailwind absolute/inset classes applied directly to it
  return (
    <div className={props.className}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
