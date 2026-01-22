"use client";

import React from 'react';
import { MapContainer, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DATA_TYPES, CityData, RainfallData } from '../../types';
import { getFeatureStyle } from './map-styles';
import { setupFeatureInteractions } from './map-interactions';
import MapUpdater from './MapUpdater';

type DataType = typeof DATA_TYPES[keyof typeof DATA_TYPES];

// Fix for Leaflet icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapClientProps {
    geoJsonData: any;
    populationData: CityData | null;
    rainfallData?: RainfallData;
    environmentalData?: any;
    currentDataType: DataType;
    currentSourceId: number | null;
    customThresholds: number[];
    onFeatureClick?: (feature: any) => void;
}

export default function MapClient({ 
    geoJsonData, 
    populationData, 
    rainfallData, 
    environmentalData, 
    currentDataType, 
    currentSourceId, 
    customThresholds, 
    onFeatureClick 
}: MapClientProps) {

    const style = (feature: any) => {
        return getFeatureStyle(feature, currentDataType, populationData, rainfallData, environmentalData, customThresholds);
    };

    const onEachFeature = (feature: any, layer: L.Layer) => {
        setupFeatureInteractions(
            feature,
            layer,
            currentDataType,
            populationData,
            rainfallData,
            environmentalData,
            customThresholds,
            onFeatureClick
        );
    };

    // Determine background class based on data type
    const getBackgroundClass = () => {
        if (currentDataType === DATA_TYPES.RAINFALL) return 'bg-rainfall';
        if (currentDataType === DATA_TYPES.ENVIRONMENTAL) return 'bg-env';
        if (currentDataType === DATA_TYPES.IDP || currentDataType === DATA_TYPES.IDP_RETURNEES) return 'bg-idp';
        return 'bg-population';
    };

    if (!geoJsonData) return null;

    return (
        <div className={`w-full h-full relative overflow-hidden transition-colors duration-1000 ${getBackgroundClass()}`}>
            <div className="absolute inset-0 pointer-events-none z-0 bg-noise opacity-[0.03]"></div>
            <div className="absolute inset-0 pointer-events-none z-0 bg-vignette"></div>

            <style jsx global>{`
                /* --- ANIMATIONS --- */
                @keyframes pulse-glow {
                    0%, 100% { filter: drop-shadow(0 0 2px rgba(34, 211, 238, 0.3)); }
                    50% { filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.6)); }
                }
                
                @keyframes float {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-5px); }
                    100% { transform: translateY(0px); }
                }

                @keyframes drift {
                    0% { background-position: 0% 0%; }
                    50% { background-position: 100% 100%; }
                    100% { background-position: 0% 0%; }
                }

                /* --- DYNAMIC BACKGROUNDS --- */
                .bg-rainfall {
                    background: radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%);
                    background-image: 
                        radial-gradient(at 0% 0%, rgba(14, 165, 233, 0.15) 0px, transparent 50%),
                        radial-gradient(at 100% 100%, rgba(2, 132, 199, 0.1) 0px, transparent 50%);
                }
                
                .bg-env {
                    background: radial-gradient(circle at 50% 50%, #111827 0%, #020617 100%);
                    background-image: 
                        radial-gradient(at 80% 0%, rgba(34, 197, 94, 0.08) 0px, transparent 50%),
                        radial-gradient(at 20% 100%, rgba(16, 185, 129, 0.08) 0px, transparent 50%);
                }

                .bg-idp {
                    background: radial-gradient(circle at 50% 50%, #2a1b1b 0%, #1a0f0f 100%);
                    background-image: 
                        radial-gradient(at 100% 0%, rgba(249, 115, 22, 0.08) 0px, transparent 50%),
                        radial-gradient(at 0% 100%, rgba(234, 88, 12, 0.05) 0px, transparent 50%);
                }

                .bg-population {
                    background: radial-gradient(circle at 50% 50%, #1e2030 0%, #11121c 100%);
                    background-image: 
                        radial-gradient(at 50% 0%, rgba(99, 102, 241, 0.1) 0px, transparent 50%);
                }

                .bg-noise {
                    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
                }

                .bg-vignette {
                    background: radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.6) 100%);
                }

                /* --- LEAFLET OVERRIDES --- */
                .leaflet-container {
                    background: transparent !important;
                    font-family: 'IBM Plex Sans Arabic', sans-serif;
                }

                /* SVG Region Styling */
                @keyframes hover-glow {
    0%, 100% {
        filter: 
            drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))
            drop-shadow(0 0 16px rgba(255, 255, 255, 0.3))
            drop-shadow(0 0 24px rgba(255, 255, 255, 0.2))
            brightness(1.15)
            contrast(1.1);
    }
    50% {
        filter: 
            drop-shadow(0 0 12px rgba(255, 255, 255, 0.7))
            drop-shadow(0 0 24px rgba(255, 255, 255, 0.5))
            drop-shadow(0 0 36px rgba(255, 255, 255, 0.3))
            brightness(1.25)
            contrast(1.15);
    }
}

path.leaflet-interactive {
    transition: 
        stroke 0.3s ease, 
        stroke-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
        fill-opacity 0.3s ease, 
        transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-box: fill-box;
    transform-origin: center;
    outline: none;
    cursor: pointer;
    will-change: filter, transform;
}

path.leaflet-interactive:hover {
    stroke-width: 3px !important;
    stroke: rgba(255, 255, 255, 0.9) !important;
    animation: hover-glow 2.5s ease-in-out infinite;
    transform: scale(1.06);
    z-index: 1000;
}

                /* Active/Focus State */
                path.leaflet-interactive:focus {
                    outline: none;
                }

                /* --- TOOLTIPS --- */
                .leaflet-tooltip {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }

                .leaflet-tooltip-pane {
                    z-index: 1000 !important;
                }

                /* Shared Glassmorphism Base */
                .glass-tooltip {
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border-radius: 16px;
                    padding: 12px;
                    box-shadow: 
                        0 4px 30px rgba(0, 0, 0, 0.1),
                        0 10px 30px -5px rgba(0, 0, 0, 0.8),
                        inset 0 0 0 1px rgba(255, 255, 255, 0.1),
                        inset 0 1px 0 0 rgba(255, 255, 255, 0.2);
                    color: #f8fafc;
                    animation: float 4s ease-in-out infinite;
                }

                .custom-tooltip-rain {
                    /* Container class applied by Leaflet */
                }
                .custom-tooltip-rain .tooltip-content {
                    background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(8, 47, 73, 0.85) 100%);
                    border: 1px solid rgba(56, 189, 248, 0.3);
                    box-shadow: 0 0 20px rgba(14, 165, 233, 0.15);
                }

                .custom-tooltip-env {
                }
                .custom-tooltip-env .tooltip-content {
                    background: linear-gradient(135deg, rgba(2, 6, 23, 0.9) 0%, rgba(6, 78, 59, 0.8) 100%);
                    border: 1px solid rgba(52, 211, 153, 0.3);
                    box-shadow: 0 0 25px rgba(16, 185, 129, 0.2);
                }

                .custom-tooltip {
                }
                .custom-tooltip .tooltip-content {
                    background: linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(31, 41, 55, 0.9) 100%);
                    border: 1px solid rgba(148, 163, 184, 0.2);
                }
                
                /* Triangle Arrow */
                .glass-tooltip::after {
                    content: '';
                    position: absolute;
                    bottom: -6px;
                    left: 50%;
                    transform: translateX(-50%) rotate(45deg);
                    width: 12px;
                    height: 12px;
                    background: inherit;
                    border-right: 1px solid rgba(255,255,255,0.1);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    z-index: -1;
                }

                /* Env Pulse Effect on Map Features */
                .pulsing-region {
                    animation: pulse-glow 3s infinite ease-in-out;
                }

            `}</style>

            <MapContainer
                center={[35.0, 38.5]}
                zoom={7}
                style={{ height: '100%', width: '100%', background: 'transparent' }}
                zoomControl={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                attributionControl={false}
            >
                <MapUpdater geoJsonData={geoJsonData} />
                <GeoJSON
                    key={`${currentDataType}-${currentSourceId}`}
                    data={geoJsonData}
                    style={style}
                    onEachFeature={onEachFeature}
                />
            </MapContainer>
        </div>
    );
}