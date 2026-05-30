import { CityData, RainfallData } from '../types';
import { getCanonicalCityName, normalizeForMatching } from '@/Lib/city-name-standardizer';
import { PROVINCE_TO_PCODE } from '../constants/province-mappings';

export function findPopulation(provinceName: string, populationData: CityData | null): number {
    if (!populationData) return 0;

    const canonicalName = getCanonicalCityName(provinceName);
    
    if (populationData[canonicalName]) {
        return populationData[canonicalName];
    }

    const normalized = normalizeForMatching(provinceName);
    for (const [city, value] of Object.entries(populationData)) {
        if (normalizeForMatching(city) === normalized) {
            return value;
        }
    }

    return 0;
}

export function findRainData(feature: any, rainData: RainfallData | undefined) {
    if (!rainData) return null;

    const props = feature.properties;

    // 1. Try Direct P-Code Match
    const codeKeys = ['ADM1_PCODE', 'ADM2_PCODE', 'admin1Pcode', 'admin2Pcode', 'code', 'id', 'PCODE'];
    for (const key of codeKeys) {
        if (props[key] && rainData[props[key]]) {
            return rainData[props[key]];
        }
    }

    // 2. Try Name Match
    const nameKeys = ['province_name', 'ADM1_EN', 'ADM1_AR', 'name', 'Name', 'NAME', 'admin1Name_en'];
        for (const key of nameKeys) {
            if (props[key]) {
                const rawName = props[key];
                const normalized = normalizeForMatching(rawName);

                const mappedCode = PROVINCE_TO_PCODE[normalized];
                if (mappedCode && rainData[mappedCode]) {
                    return rainData[mappedCode];
                }
            }
        }

    return null;
}