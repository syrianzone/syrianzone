import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '@/Components/map/MapContext';

const SOURCE_ID = 'hotels';
const LAYERS = ['hotel-clusters', 'hotel-cluster-count', 'hotel-pin'];

export function HotelsLayer(props: {
  data: GeoJSON.FeatureCollection;
  selectedId: number | null;
  onPinClick: (id: number) => void;
  onClusterClick: (zoom: number, center: [number, number]) => void;
}) {
  const map = useMap();
  const onPinClickRef = useRef(props.onPinClick);
  onPinClickRef.current = props.onPinClick;
  const onClusterClickRef = useRef(props.onClusterClick);
  onClusterClickRef.current = props.onClusterClick;
  const selectedIdRef = useRef(props.selectedId);
  selectedIdRef.current = props.selectedId;
  const dataRef = useRef(props.data);
  dataRef.current = props.data;

  const addSourceAndLayers = () => {
    if (map.getSource(SOURCE_ID)) return;
    if (!map.isStyleLoaded?.()) {
      console.warn('[HotelsLayer] addSourceAndLayers skipped: style not loaded');
      return;
    }

    try {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: dataRef.current,
        cluster: true,
        clusterRadius: 25,
        clusterMaxZoom: 10,
      });

      map.addLayer({
        id: 'hotel-clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#c05621',
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 10, 10, 13, 30, 16],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.8,
        },
      });

      map.addLayer({
        id: 'hotel-cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 11, 'text-font': ['IBM Plex Sans Arabic Bold'] },
        paint: { 'text-color': '#ffffff' },
      });

      map.addLayer({
        id: 'hotel-pin',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': selectedIdRef.current == null ? 6 : ['case', ['==', ['get', 'id'], selectedIdRef.current], 9, 6],
          'circle-color': '#c05621',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.9,
        },
      });
      console.log('[HotelsLayer] layers added successfully');
    } catch (e) {
      console.warn('[HotelsLayer] addSource/addLayer failed:', e);
    }
  };

  useEffect(() => {
    const onStyleLoad = () => {
      console.log('[HotelsLayer] style.load fired');
      addSourceAndLayers();
    };
    let idleFired = false;
    const onIdle = () => {
      if (idleFired) return;
      idleFired = true;
      console.log('[HotelsLayer] idle fired, isStyleLoaded:', map.isStyleLoaded?.(), 'sourceExists:', !!map.getSource(SOURCE_ID));
      addSourceAndLayers();
      map.off('idle', onIdle);
    };

    addSourceAndLayers();
    map.on('style.load', onStyleLoad);
    map.on('idle', onIdle);

    map.on('click', 'hotel-clusters', async (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
      const zoom = await source.getClusterExpansionZoom(feature.properties?.cluster_id);
      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      map.easeTo({ center: coords, zoom });
      onClusterClickRef.current(zoom, coords);
    });

    map.on('click', 'hotel-pin', (e) => {
      const raw = e.features?.[0]?.properties?.id;
      const id = raw != null ? Number(raw) : NaN;
      if (!isNaN(id)) onPinClickRef.current(id);
    });

    return () => {
      map.off('style.load', onStyleLoad);
      map.off('idle', onIdle);
      try {
        for (const layer of LAYERS) if (map.getLayer(layer)) map.removeLayer(layer);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch { /* map tearing down */ }
    };
  }, [map]);

  useEffect(() => {
    try {
      let src = map.getSource(SOURCE_ID);
      if (!src && map.isStyleLoaded?.()) {
        console.log('[HotelsLayer] setData effect: adding source because it was missing');
        addSourceAndLayers();
        src = map.getSource(SOURCE_ID);
      }
      console.log('[HotelsLayer] setData effect, source exists:', !!src, 'dataFeatures:', props.data?.features?.length ?? 0);
      if (src) (src as maplibregl.GeoJSONSource).setData(props.data);
    } catch (e) { console.warn('[HotelsLayer] setData failed:', e); }
  }, [props.data, map]);

  useEffect(() => {
    try {
      if (!map.getLayer('hotel-pin')) return;
      map.setPaintProperty(
        'hotel-pin',
        'circle-radius',
        props.selectedId == null ? 6 : ['case', ['==', ['get', 'id'], props.selectedId], 9, 6],
      );
    } catch { /* layer not ready */ }
  }, [props.selectedId, map]);

  return null;
}

export const HOTELS_LAYERS = LAYERS;
