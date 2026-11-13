import { describe, expect, it } from 'vitest';
import { weatherCodeAr, weatherDescriptionAr } from './weather';

// Both tables come from resources/data/weather.json, which SyriaClimateService
// (the stored English wording) and the environmental-data aggregator read too.
describe('the weather vocabulary from resources/data/weather.json', () => {
    it('translates the WMO wording the population endpoint stores', () => {
        expect(weatherDescriptionAr('Clear sky')).toBe('سماء صافية');
        expect(weatherDescriptionAr('Depositing rime fog')).toBe('ضباب متجمد');
        expect(weatherDescriptionAr('thunderstorm with heavy hail')).toBe('عاصفة رعدية');
    });

    it('translates the OpenWeather wordings /api/weather sends', () => {
        expect(weatherDescriptionAr('few clouds')).toBe('غيوم قليلة');
        expect(weatherDescriptionAr('overcast clouds')).toBe('غيوم ملبدة');
        expect(weatherDescriptionAr('haze')).toBe('ضباب خفيف');
    });

    it('passes an unknown description through rather than blanking it', () => {
        expect(weatherDescriptionAr('volcanic ash')).toBe('volcanic ash');
    });

    it('labels a forecast code, and says nothing rather than guessing for an unknown one', () => {
        expect(weatherCodeAr(0)).toBe('صافية');
        expect(weatherCodeAr(63)).toBe('مطر');
        expect(weatherCodeAr(1234)).toBeNull();
    });
});
