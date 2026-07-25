import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '@/Components/map/MapContext';

const SOURCE_ID = 'places';
const LAYERS = ['clusters', 'cluster-count', 'place-pin'];

export function PlacesLayer(props: {
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

  // add source + layers on mount (re-adds after setStyle via style.load)
  useEffect(() => {
    const addSourceAndLayers = () => {
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: props.data,
        cluster: true,
        clusterRadius: 25,
        clusterMaxZoom: 10,
      });

      map.addLayer({
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

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 11, 'text-font': ['IBM Plex Sans Arabic Bold'] },
        paint: { 'text-color': '#ffffff' },
      });

      map.addLayer({
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

    map.on('style.load', addSourceAndLayers);

    map.on('load', () => {
      addSourceAndLayers();

      map.on('click', 'clusters', async (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(feature.properties?.cluster_id);
        onClusterClickRef.current(zoom, (feature.geometry as GeoJSON.Point).coordinates as [number, number]);
      });

      map.on('click', 'place-pin', (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === 'number') onPinClickRef.current(id);
      });
    });

    return () => {
      try {
        for (const layer of LAYERS) if (map.getLayer(layer)) map.removeLayer(layer);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch { /* map tearing down */ }
    };
  }, [map]);

  // update data
  useEffect(() => {
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)?.setData(props.data);
  }, [props.data, map]);

  // update selection ring
  useEffect(() => {
    if (!map.getLayer('place-pin')) return;
    map.setPaintProperty(
      'place-pin',
      'circle-radius',
      props.selectedId == null ? 6 : ['case', ['==', ['get', 'id'], props.selectedId], 9, 6],
    );
  }, [props.selectedId, map]);

  return null;
}

export const PLACES_LAYERS = LAYERS;
