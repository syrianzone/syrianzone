import { describe, expect, it } from 'vitest';
import { FOLLOW_LOCATION, configCity, prayerWidget, type PrayerConfig } from './index';
import { defaultConfig } from '../../_lib/doc';

/**
 * "One setting everywhere" is the point of Domain/location: a prayer tile that
 * nobody has configured follows the site location, and only a stored city of its
 * own overrides it. These tests pin both halves, because the field default is
 * what every new and seeded board stores.
 */
describe('the prayer tile location', () => {
  it('stores no city for a new or seeded tile', () => {
    const seeded = defaultConfig(prayerWidget) as PrayerConfig;

    expect(seeded.governorate).toBe(FOLLOW_LOCATION);
    expect(configCity(seeded)).toBeNull();
  });

  it('keeps a city a stored document names', () => {
    expect(configCity({ governorate: 'homs' })).toBe('homs');
  });

  it('follows the site location for an absent or unknown city', () => {
    expect(configCity({})).toBeNull();
    expect(configCity({ governorate: FOLLOW_LOCATION })).toBeNull();
    expect(configCity({ governorate: 'atlantis' })).toBeNull();
  });

  it('offers the follow choice in the settings select', () => {
    const field = prayerWidget.fields.find((f) => f.key === 'governorate');
    if (field?.type !== 'select') throw new Error('the prayer tile lost its governorate select');

    expect(field.default).toBe(FOLLOW_LOCATION);
    expect(field.options[0]).toEqual({ value: FOLLOW_LOCATION, label: 'حسب موقعي' });
    expect(field.options.map((o) => o.value)).toContain('damascus');
  });
});
