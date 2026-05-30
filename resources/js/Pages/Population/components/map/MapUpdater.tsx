"use client";

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface MapUpdaterProps {
    geoJsonData: any;
}

export default function MapUpdater({ geoJsonData }: MapUpdaterProps) {
    const map = useMap();

    useEffect(() => {
        if (geoJsonData) {
            const layer = L.geoJSON(geoJsonData);
            if (layer.getLayers().length > 0) {
                map.fitBounds(layer.getBounds(), { padding: [20, 20] });
            }
        }
    }, [geoJsonData, map]);

    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }, [map]);

    return null;
}