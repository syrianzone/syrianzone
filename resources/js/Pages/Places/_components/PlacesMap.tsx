import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LatLng, PlaceFeatureCollection } from '../_lib/types';

const SOURCE_ID = 'places';
const LAYERS = ['clusters', 'cluster-count', 'place-pin'];

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
  const onPinClickRef = useRef(props.onPinClick);
  onPinClickRef.current = props.onPinClick;
  const onMapClickRef = useRef(props.onMapClick);
  onMapClickRef.current = props.onMapClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: '/styles/styles/dark-matter.json',
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

    map.on('load', () => {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: featuresRef.current as GeoJSON.FeatureCollection,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], 'hsl(105, 15%, 36%)', 10, 'hsl(105, 18%, 30%)', 30, 'hsl(105, 20%, 25%)'],
          'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 13 },
        paint: { 'text-color': '#ffffff' },
      });

      map.addLayer({
        id: 'place-pin',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 7,
          'circle-color': '#7d8a5c',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

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

    mapRef.current = map;

    return () => {
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
    if (!map || !mapReady) return;
    map.setPaintProperty(
      'place-pin',
      'circle-radius',
      props.selectedId == null ? 7 : ['case', ['==', ['get', 'id'], props.selectedId], 10, 7],
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
