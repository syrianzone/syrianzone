import { describe, expect, it } from 'vitest';
import { DATA_TYPES, DATA_TYPE_CONFIG, TEMPERATURE_BANDS } from './data-config';
import { buildLegend, getColor, getTemperatureColor } from '../utils/color-calculator';

/**
 * The atlas legend used to be a second hand-written copy of the numbers in
 * `data-config.ts`, and it drifted: the IDP top band said "أكثر من ٥٠٠ ألف"
 * while the map only starts its top colour above one million. These tests pin
 * the legend to the same bands the fill colours use.
 */
describe('population atlas legend and classification', () => {
    it('draws every value-type legend from its own thresholds', () => {
        for (const type of [
            DATA_TYPES.POPULATION,
            DATA_TYPES.IDP,
            DATA_TYPES.IDP_RETURNEES,
            DATA_TYPES.RAINFALL,
        ] as const) {
            const config = DATA_TYPE_CONFIG[type];
            expect(config.kind).toBe('value');
            if (config.kind !== 'value') continue;

            const [, lowEdge, highEdge] = config.thresholds;
            const legend = buildLegend(type, config.thresholds);
            expect(legend).toHaveLength(4);
            expect(legend[0]).toEqual({ label: 'لا توجد بيانات', color: config.colors.none });

            const unit = type === DATA_TYPES.RAINFALL ? ' مم' : '';
            // The legend names the exact edge each colour starts or ends at.
            expect(legend[1].label).toContain(lowEdge >= 1_000 ? 'ألف' : String(lowEdge));
            expect(legend[2].label).toContain(unit.trim() ? 'مم' : '–');
            expect(legend[3].label.startsWith('أكثر من')).toBe(true);

            // …and the classifier agrees with those labels at both edges.
            expect(getColor(0, type, config.thresholds)).toBe(config.colors.none);
            expect(getColor(1, type, config.thresholds)).toBe(config.colors.low);
            expect(getColor(lowEdge, type, config.thresholds)).toBe(config.colors.low);
            expect(getColor(lowEdge + 1, type, config.thresholds)).toBe(config.colors.medium);
            expect(getColor(highEdge, type, config.thresholds)).toBe(config.colors.medium);
            expect(getColor(highEdge + 1, type, config.thresholds)).toBe(config.colors.high);

            expect(legend.map((entry) => entry.color)).toEqual([
                config.colors.none,
                config.colors.low,
                config.colors.medium,
                config.colors.high,
            ]);
        }
    });

    it('follows replaced (data-driven) thresholds in both the fill and the legend', () => {
        const dynamic = [0, 123_456, 789_012];
        const legend = buildLegend(DATA_TYPES.IDP, dynamic);
        expect(legend[1].label).toBe('حتى 123 ألف');
        expect(legend[2].label).toBe('123 ألف – 789 ألف');
        expect(legend[3].label).toBe('أكثر من 789 ألف');
        expect(getColor(123_456, DATA_TYPES.IDP, dynamic)).toBe(legend[1].color);
        expect(getColor(123_457, DATA_TYPES.IDP, dynamic)).toBe(legend[2].color);
        expect(getColor(789_013, DATA_TYPES.IDP, dynamic)).toBe(legend[3].color);
    });

    it('draws the environmental legend from the same temperature bands it fills', () => {
        const config = DATA_TYPE_CONFIG[DATA_TYPES.ENVIRONMENTAL];
        expect(config.kind).toBe('bands');
        const legend = buildLegend(DATA_TYPES.ENVIRONMENTAL, config.thresholds);

        expect(legend.map((entry) => entry.color)).toEqual([
            config.colors.none,
            ...TEMPERATURE_BANDS.map((band) => band.color),
        ]);
        expect(legend.map((entry) => entry.label)).toEqual([
            'لا توجد بيانات',
            ...TEMPERATURE_BANDS.map((band) => band.label),
        ]);

        for (const band of TEMPERATURE_BANDS) {
            expect(getTemperatureColor(-100)).toBe(TEMPERATURE_BANDS[0].color);
            if (band.max !== null) {
                expect(getTemperatureColor(band.max)).toBe(
                    band.maxInclusive ? band.color : TEMPERATURE_BANDS[TEMPERATURE_BANDS.indexOf(band) + 1].color,
                );
            }
        }
        expect(getTemperatureColor(41)).toBe(TEMPERATURE_BANDS[TEMPERATURE_BANDS.length - 1].color);
    });
});
