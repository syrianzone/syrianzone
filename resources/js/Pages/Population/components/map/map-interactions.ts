import L from 'leaflet';
import { DATA_TYPES, DATA_TYPE_CONFIG, CityData, RainfallData } from '../../types';
import { getCanonicalCityName } from '@/Lib/city-name-standardizer';
import { findPopulation, findRainData } from '../../utils/data-finder';
import { generateRainChartHtml, generatePopulationTooltipHtml, generateEnvironmentalTooltipHtml, escapeHtml } from './tooltip-generators';
import { getHighlightStyle, getFeatureStyle } from './map-styles';

type DataType = typeof DATA_TYPES[keyof typeof DATA_TYPES];

const ARABIC_TO_ENGLISH_CITY_MAP: { [key: string]: string } = {
    'دمشق': 'Damascus', 'حلب': 'Aleppo', 'ريف دمشق': 'Rif Dimashq', 'حمص': 'Homs',
    'حماة': 'Hama', 'اللاذقية': 'Latakia', 'إدلب': 'Idlib', 'الحسكة': 'Al-Hasakah',
    'دير الزور': 'Deir ez-Zor', 'طرطوس': 'Tartus', 'الرقة': 'Raqqa', 'درعا': 'Daraa',
    'السويداء': 'As-Suwayda', 'القنيطرة': 'Quneitra'
};

export interface CursorTooltipControls {
    /** Returns the absolutely-positioned tooltip div owned by MapClient (or null). */
    getTip: () => HTMLDivElement | null;
    /** Returns the relatively-positioned map wrapper div (or null). */
    getWrap: () => HTMLDivElement | null;
    onFeatureClick?: (feature: any) => void;
}

function buildTooltipHtml(
    feature: any,
    currentDataType: DataType,
    populationData: CityData | null,
    rainfallData: RainfallData | undefined,
    environmentalData: any | undefined,
): { wrapperClass: string; content: string } | null {
    const name = feature.properties.province_name || feature.properties.ADM2_AR || feature.properties.ADM1_AR || feature.properties.Name;
    const nameAr = getCanonicalCityName(name);

    if (currentDataType === DATA_TYPES.RAINFALL) {
        const rData = findRainData(feature, rainfallData);
        const safeName = escapeHtml(nameAr);
        const content = rData
            ? generateRainChartHtml(nameAr, rData)
            : `<div class="p-2 text-slate-300 text-xs text-right font-sans">لا توجد بيانات مطرية<br/><span class="font-bold text-white">${safeName}</span></div>`;
        return { wrapperClass: 'glass-tooltip custom-tooltip-rain', content };
    }

    if (currentDataType === DATA_TYPES.ENVIRONMENTAL) {
        if (!environmentalData) return null;
        const englishName = ARABIC_TO_ENGLISH_CITY_MAP[nameAr] || nameAr;
        const envData = environmentalData.cities?.[nameAr] || environmentalData.cities?.[englishName] || environmentalData.cities?.[name];
        const safeName = escapeHtml(nameAr);
        const content = envData
            ? generateEnvironmentalTooltipHtml(nameAr, envData)
            : `<div class="p-2 text-slate-300 text-xs text-right font-sans">لا توجد بيانات بيئية<br/><span class="font-bold text-white">${safeName}</span></div>`;
        return { wrapperClass: 'glass-tooltip custom-tooltip-env', content };
    }

    const pop = findPopulation(name, populationData);
    const config = DATA_TYPE_CONFIG[currentDataType];
    return {
        wrapperClass: 'glass-tooltip custom-tooltip',
        content: generatePopulationTooltipHtml(nameAr, pop, config.labelAr),
    };
}

function positionTip(tip: HTMLDivElement, wrap: HTMLDivElement, clientX: number, clientY: number) {
    const rect = wrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    // Center horizontally on the cursor, clamp inside the map; sit above the
    // cursor and flip below it when there is no room on top.
    const tx = Math.min(Math.max(x - w / 2, 8), Math.max(rect.width - w - 8, 8));
    let ty = y - h - 14;
    if (ty < 8) ty = y + 18;
    tip.style.left = `${tx}px`;
    tip.style.top = `${ty}px`;
}

export function hideCursorTooltip(controls: Pick<CursorTooltipControls, 'getTip'>) {
    const tip = controls.getTip();
    if (tip) tip.style.display = 'none';
}

export function setupFeatureInteractions(
    feature: any,
    layer: L.Layer,
    currentDataType: DataType,
    populationData: CityData | null,
    rainfallData: RainfallData | undefined,
    environmentalData: any | undefined,
    customThresholds: number[],
    controls: CursorTooltipControls,
) {
    const { getTip, getWrap, onFeatureClick } = controls;

    // Mouse events
    const l = layer as L.Path; // Cast to access setStyle/bringToFront

    l.on({
        mouseover: (e: any) => {
            const highlightStyle = getHighlightStyle(currentDataType);
            l.setStyle(highlightStyle);

            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                l.bringToFront();
            }

            const built = buildTooltipHtml(feature, currentDataType, populationData, rainfallData, environmentalData);
            const tip = getTip();
            const wrap = getWrap();
            if (!built || !tip || !wrap) return;
            tip.innerHTML = `<div class="${built.wrapperClass}"><div class="tooltip-content rounded-xl p-3">${built.content}</div></div>`;
            tip.style.display = 'block';
            const evt = e.originalEvent as MouseEvent | undefined;
            if (evt) positionTip(tip, wrap, evt.clientX, evt.clientY);
        },
        mousemove: (e: any) => {
            const tip = getTip();
            const wrap = getWrap();
            const evt = e.originalEvent as MouseEvent | undefined;
            if (!tip || !wrap || !evt || tip.style.display === 'none') return;
            positionTip(tip, wrap, evt.clientX, evt.clientY);
        },
        mouseout: () => {
            const style = getFeatureStyle(feature, currentDataType, populationData, rainfallData, environmentalData, customThresholds);
            l.setStyle(style);
            hideCursorTooltip({ getTip });
        },
        click: () => {
            if (onFeatureClick) {
                onFeatureClick(feature);
            }
        }
    });
}
