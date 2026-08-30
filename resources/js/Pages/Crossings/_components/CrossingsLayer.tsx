import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { useMap, useStyleVersion } from '@/Components/map/MapContext';

const SOURCE_ID = 'crossings';
const PIN_LAYER = 'crossing-pin';
const SELECTED_LAYER = 'crossing-selected';
const LAYERS = [SELECTED_LAYER, PIN_LAYER];

/**
 * Twenty points, so no clustering: every crossing stays visible at country
 * zoom. Colour comes from the feature's own `color` property, which the page
 * recomputes whenever the clock advances a status.
 */
export function CrossingsLayer(props: {
    data: GeoJSON.FeatureCollection;
    selectedId: number | null;
    onSelect: (n: number) => void;
    onHover: (n: number | null) => void;
}) {
    const map = useMap();
    const styleVersion = useStyleVersion();

    const dataRef = useRef(props.data);
    dataRef.current = props.data;
    const selectedIdRef = useRef(props.selectedId);
    selectedIdRef.current = props.selectedId;
    const onSelectRef = useRef(props.onSelect);
    onSelectRef.current = props.onSelect;
    const onHoverRef = useRef(props.onHover);
    onHoverRef.current = props.onHover;

    // Re-added on every style change: setStyle() drops all runtime sources and
    // layers, and styleVersion is how MapCanvas announces that.
    useEffect(() => {
        if (!map.getSource(SOURCE_ID)) {
            map.addSource(SOURCE_ID, { type: 'geojson', data: dataRef.current });
        }

        if (!map.getLayer(SELECTED_LAYER)) {
            map.addLayer({
                id: SELECTED_LAYER,
                type: 'circle',
                source: SOURCE_ID,
                filter: ['==', ['get', 'n'], selectedIdRef.current ?? -1],
                paint: {
                    'circle-radius': 15,
                    'circle-color': ['get', 'color'],
                    'circle-opacity': 0.22,
                    'circle-stroke-width': 1,
                    'circle-stroke-color': ['get', 'color'],
                },
            });
        }

        if (!map.getLayer(PIN_LAYER)) {
            map.addLayer({
                id: PIN_LAYER,
                type: 'circle',
                source: SOURCE_ID,
                paint: {
                    'circle-radius': 7,
                    'circle-color': ['get', 'color'],
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-opacity': 0.9,
                },
            });
        }

        // A tap makes the browser synthesise mouseenter/mousemove and no matching
        // mouseleave, so on a phone the hover preview would latch on and never
        // let go — leaving a card that looks previewed and cannot be closed.
        // Devices that genuinely hover are the only ones that get a preview;
        // everywhere else a tap goes straight to selecting.
        const hoverCapable = window.matchMedia('(hover: hover)');

        const onEnter = (e: maplibregl.MapLayerMouseEvent) => {
            const n = Number(e.features?.[0]?.properties?.n);
            if (Number.isNaN(n)) return;
            map.getCanvas().style.cursor = 'pointer';
            if (!hoverCapable.matches) return;
            onHoverRef.current(n);
        };

        const onLeave = () => {
            map.getCanvas().style.cursor = '';
            onHoverRef.current(null);
        };

        const onClick = (e: maplibregl.MapLayerMouseEvent) => {
            const n = Number(e.features?.[0]?.properties?.n);
            if (Number.isNaN(n)) return;
            // clears any preview a hybrid touch+mouse device left standing, so the
            // card that opens is always the interactive one
            onHoverRef.current(null);
            onSelectRef.current(n);
        };

        map.on('mouseenter', PIN_LAYER, onEnter);
        map.on('mousemove', PIN_LAYER, onEnter);
        map.on('mouseleave', PIN_LAYER, onLeave);
        map.on('click', PIN_LAYER, onClick);

        return () => {
            map.off('mouseenter', PIN_LAYER, onEnter);
            map.off('mousemove', PIN_LAYER, onEnter);
            map.off('mouseleave', PIN_LAYER, onLeave);
            map.off('click', PIN_LAYER, onClick);
            onHoverRef.current(null);
            try {
                for (const layer of LAYERS) if (map.getLayer(layer)) map.removeLayer(layer);
                if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
            } catch {
                /* map tearing down */
            }
        };
    }, [map, styleVersion]);

    useEffect(() => {
        const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
        source?.setData(props.data);
    }, [props.data, map, styleVersion]);

    useEffect(() => {
        if (!map.getLayer(SELECTED_LAYER)) return;
        map.setFilter(SELECTED_LAYER, ['==', ['get', 'n'], props.selectedId ?? -1]);
    }, [props.selectedId, map, styleVersion]);

    return null;
}
