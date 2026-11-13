import React, { useMemo } from 'react';
import { MapContainer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, FeatureCollection } from 'geojson';
import { getGovernorateNameAr } from '@/Domain/geography/governorates';
import { ensureLeafletDefaultIcon } from '@/Components/map/leaflet/defaultIcon';
import { FitBounds } from '@/Components/map/leaflet/FitBounds';
import { useInvalidateSizeOnLayout } from '@/Components/map/leaflet/useInvalidateSizeOnLayout';
import { featureCollectionBounds, normalizeFeatureCollection } from '@/Components/map/geo';

ensureLeafletDefaultIcon();

/**
 * The SyId map's palette. These are the page's brand colours (the same greens
 * its identity guide documents), not theme tokens: the panel around the map is
 * a fixed art direction, so the drawing must keep them in every theme.
 */
const SYRIA_MAP_COLORS = {
    fill: '#428177',
    border: '#0D1117',
    hoverBorder: '#E6EDF3',
    background: '#24292F',
};

interface SyriaMapProps {
    geoJsonData: unknown;
    /** Province name to focus, or null for the whole country. */
    selectedGovId?: string | null;
}

function MapSizeSync() {
    useInvalidateSizeOnLayout();
    return null;
}

export default function SyriaMap({ geoJsonData, selectedGovId }: SyriaMapProps) {
    const geoJson: FeatureCollection = useMemo(() => normalizeFeatureCollection(geoJsonData), [geoJsonData]);

    const filteredData = useMemo(() => {
        if (!selectedGovId) return geoJson;
        return {
            ...geoJson,
            features: geoJson.features.filter((feature) => feature.properties?.province_name === selectedGovId),
        };
    }, [geoJson, selectedGovId]);

    // Flag the requested province (falling back to the whole country when it is
    // not in the data); the shared FitBounds does the map move itself.
    const bounds = useMemo(() => {
        const selected = selectedGovId ? featureCollectionBounds(filteredData) : null;
        return selected ?? featureCollectionBounds(geoJson);
    }, [filteredData, geoJson, selectedGovId]);

    const style = () => {
        return {
            fillColor: SYRIA_MAP_COLORS.fill,
            weight: 1.5,
            opacity: 1,
            color: SYRIA_MAP_COLORS.border,
            fillOpacity: 0.6
        };
    };

    const onEachFeature = (feature: Feature, layer: L.Layer) => {
        const rawName = feature.properties?.province_name || feature.properties?.name;
        const name = getGovernorateNameAr(rawName);
        if (name) {
            layer.bindTooltip(() => {
                return `
                    <div class="text-right" style="font-family: 'IBM Plex Sans Arabic', sans-serif;">
                        <div class="font-bold text-base">${name}</div>
                    </div>
                `;
            }, {
                direction: 'top',
                sticky: true,
                className: 'custom-tooltip'
            });
        }

        layer.on({
            mouseover: (e) => {
                const l = e.target;
                l.setStyle({
                    weight: 3,
                    color: SYRIA_MAP_COLORS.hoverBorder,
                    fillOpacity: 0.8
                });
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                    l.bringToFront();
                }
            },
            mouseout: (e) => {
                const l = e.target;
                l.setStyle(style());
            }
        });
    };

    if (!geoJsonData) return <div className="h-full w-full flex items-center justify-center text-white" style={{ background: SYRIA_MAP_COLORS.background }}>جاري تحميل الخريطة...</div>;

    return (
        <div className="w-full h-full relative rounded-xl overflow-hidden border-2 border-border shadow-lg">
            <style>{`
                .leaflet-container {
                    -webkit-tap-highlight-color: transparent;
                    outline: none;
                }
                .leaflet-interactive {
                    outline: none !important;
                    -webkit-tap-highlight-color: transparent !important;
                }
                path.leaflet-interactive:focus {
                    outline: none;
                }
                .custom-tooltip {
                    background: rgba(0, 0, 0, 0.8) !important;
                    border: 1px solid #444 !important;
                    color: white !important;
                    padding: 8px 12px !important;
                    border-radius: 6px !important;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
                    z-index: 1000 !important;
                }
            `}</style>

            <MapContainer
                center={[35.0, 38.5]}
                zoom={6}
                style={{ height: '100%', width: '100%', background: SYRIA_MAP_COLORS.background }}
                zoomControl={true}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                attributionControl={true}
            >
                <MapSizeSync />
                <FitBounds bounds={bounds} />
                <GeoJSON
                    key={selectedGovId ?? 'full'}
                    data={filteredData}
                    style={style}
                    onEachFeature={onEachFeature}
                />
            </MapContainer>
        </div>
    );
}
