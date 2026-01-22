import { DATA_TYPES } from '../../types';
import { getColor } from '../../utils/color-calculator';
import { findPopulation, findRainData } from '../../utils/data-finder';
import { CityData, RainfallData } from '../../types';
import { getCanonicalCityName } from '@/lib/city-name-standardizer';

type DataType = typeof DATA_TYPES[keyof typeof DATA_TYPES];

const ARABIC_TO_ENGLISH_CITY_MAP: { [key: string]: string } = {
    'دمشق': 'Damascus', 'حلب': 'Aleppo', 'ريف دمشق': 'Rif Dimashq', 'حمص': 'Homs',
    'حماة': 'Hama', 'اللاذقية': 'Latakia', 'إدلب': 'Idlib', 'الحسكة': 'Al-Hasakah',
    'دير الزور': 'Deir ez-Zor', 'طرطوس': 'Tartus', 'الرقة': 'Raqqa', 'درعا': 'Daraa',
    'السويداء': 'As-Suwayda', 'القنيطرة': 'Quneitra'
};

function getTemperatureColor(temp: number): string {
    if (temp <= 5) return '#60a5fa';      // Blue-400
    if (temp <= 10) return '#22d3ee';     // Cyan-400
    if (temp <= 15) return '#2dd4bf';     // Teal-400
    if (temp <= 20) return '#4ade80';     // Green-400
    if (temp <= 25) return '#facc15';     // Yellow-400
    if (temp <= 30) return '#fb923c';     // Orange-400
    return '#f87171';                     // Red-400
}

export function getFeatureStyle(
    feature: any,
    currentDataType: DataType,
    populationData: CityData | null,
    rainfallData: RainfallData | undefined,
    environmentalData: any | undefined,
    customThresholds: number[]
) {
    let value = 0;
    
    // Environmental Data Style (Temperature)
    if (currentDataType === DATA_TYPES.ENVIRONMENTAL) {
        if (!environmentalData) {
             return {
                fillColor: '#1e293b',
                weight: 1,
                opacity: 0.5,
                color: '#334155',
                fillOpacity: 0.3,
                className: ''
            };
        }

        const name = feature.properties.province_name || feature.properties.ADM2_AR || feature.properties.ADM1_AR || feature.properties.Name;
        const nameAr = getCanonicalCityName(name);
        const englishName = ARABIC_TO_ENGLISH_CITY_MAP[nameAr] || nameAr;
        const envData = environmentalData.cities?.[nameAr] || environmentalData.cities?.[englishName] || environmentalData.cities?.[name];

        if (envData) {
            const temp = envData.current_conditions?.temperature_celsius || 15;
            return {
                fillColor: getTemperatureColor(temp),
                weight: 1.5,
                opacity: 1,
                color: 'rgba(255,255,255,0.4)', // Semi-transparent white border for glow
                fillOpacity: 0.6, // Lower opacity for glass effect
                className: 'pulsing-region' // CSS animation class
            };
        }

        return {
            fillColor: '#1e293b',
            weight: 1,
            opacity: 0.5,
            color: '#334155',
            fillOpacity: 0.3,
            className: ''
        };
    }

    // Rainfall Data Style
    if (currentDataType === DATA_TYPES.RAINFALL) {
        const rData = findRainData(feature, rainfallData);
        if (rData && rData.length > 0) {
            const target = rData.find((x: any) => x.year === 2024) || rData[rData.length - 1];
            value = target.rainfall;
        }
        
        const baseColor = getColor(value, currentDataType, customThresholds);
        
        return {
            fillColor: baseColor,
            weight: 1.5,
            opacity: 1,
            color: 'rgba(14, 165, 233, 0.4)', // Cyan border
            fillOpacity: 0.7,
            className: ''
        };
    }

    // Population/IDP Data Style
    value = findPopulation(feature.properties.province_name, populationData);
    const fillColor = getColor(value, currentDataType, customThresholds);

    return {
        fillColor: fillColor,
        weight: 1.5,
        opacity: 1,
        color: 'rgba(255,255,255,0.2)', // Subtle border
        fillOpacity: 0.75,
        className: ''
    };
}

export function getHighlightStyle(currentDataType: DataType) {
    if (currentDataType === DATA_TYPES.RAINFALL) {
        return {
            weight: 3,
            color: '#67e8f9', // Cyan-300
            fillOpacity: 0.9,
            fillColor: '#22d3ee'
        };
    }

    if (currentDataType === DATA_TYPES.ENVIRONMENTAL) {
        return {
            weight: 3,
            color: '#ffffff',
            fillOpacity: 0.85,
            dashArray: ''
        };
    }

    // Default Highlight (Population/IDP)
    return {
        weight: 3,
        color: '#ffffff',
        fillOpacity: 0.9
    };
}