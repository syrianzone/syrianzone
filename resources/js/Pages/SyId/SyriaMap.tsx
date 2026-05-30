"use client";

import React, { useEffect } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getGovernorateNameAr } from '@/lib/geo-utils';

// Fix for Leaflet icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface SyriaMapProps {
    geoJsonData: any;
    selectedGovId?: string;
}

function MapUpdater({ geoJsonData, selectedGovId }: { geoJsonData: any; selectedGovId?: string }) {
    const map = useMap();

    useEffect(() => {
        if (geoJsonData) {
            let layer;
            if (selectedGovId && selectedGovId !== "full") {
                const feature = geoJsonData.features.find((f: any) => f.properties.province_name === selectedGovId);
                if (feature) {
                    layer = L.geoJSON(feature);
                }
            }

            if (!layer) {
                layer = L.geoJSON(geoJsonData);
            }

            map.fitBounds(layer.getBounds(), { padding: [20, 20] });
        }
    }, [geoJsonData, map, selectedGovId]);

    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);

    return null;
}

export default function SyriaMap({ geoJsonData, selectedGovId }: SyriaMapProps) {
    const filteredData = React.useMemo(() => {
        if (!geoJsonData || !selectedGovId || selectedGovId === "full") return geoJsonData;
        return {
            ...geoJsonData,
            features: geoJsonData.features.filter((f: any) => f.properties.province_name === selectedGovId)
        };
    }, [geoJsonData, selectedGovId]);

    const style = () => {
        return {
            fillColor: '#428177',
            weight: 1.5,
            opacity: 1,
            color: '#0D1117',
            fillOpacity: 0.6
        };
    };

    const onEachFeature = (feature: any, layer: L.Layer) => {
        const rawName = feature.properties.province_name || feature.properties.name;
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
                    color: '#E6EDF3',
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

    if (!geoJsonData) return <div className="h-full w-full flex items-center justify-center bg-[#24292F] text-white">جاري تحميل الخريطة...</div>;

    return (
        <div className="w-full h-full relative rounded-xl overflow-hidden border-2 border-border shadow-lg">
            <style jsx global>{`
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
                style={{ height: '100%', width: '100%', background: '#24292F' }}
                zoomControl={true}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                attributionControl={false}
            >
                <MapUpdater geoJsonData={geoJsonData} selectedGovId={selectedGovId} />
                <GeoJSON
                    key={selectedGovId || 'full'}
                    data={filteredData}
                    style={style}
                    onEachFeature={onEachFeature}
                />
            </MapContainer>
        </div>
    );
}
