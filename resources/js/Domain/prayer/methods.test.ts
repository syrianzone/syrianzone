import { describe, expect, it } from 'vitest';
import prayerData from '../../../data/prayer.json';
import {
  DEFAULT_PRAYER_METHOD,
  isAcceptedPrayerMethod,
  PRAYER_METHODS,
} from './methods';

/**
 * The method table is `resources/data/prayer.json`, which `PrayerController`
 * validates against. These tests pin the two halves of that one list: the picker
 * offers the file's `methods`, and a stored id the picker does not offer is
 * still a real choice (not "absent" data the login sync would overwrite).
 */

describe('prayer calculation methods', () => {
  it('offers the methods of the data file, in its order', () => {
    expect(PRAYER_METHODS.map((method) => method.id)).toEqual(prayerData.methods.map((row) => row.id));
    expect(PRAYER_METHODS.map((method) => method.nameAr)).toEqual(prayerData.methods.map((row) => row.name_ar));
  });

  it('takes the default from the data file', () => {
    expect(DEFAULT_PRAYER_METHOD).toBe(prayerData.default_method);
  });

  it('keeps an unlisted id the endpoint accepts', () => {
    for (const id of prayerData.unlisted_method_ids) {
      expect(isAcceptedPrayerMethod(id), `method ${id}`).toBe(true);
      expect(PRAYER_METHODS.some((method) => method.id === id), `method ${id} is not offered`).toBe(false);
    }
  });

  it('still rejects an id the endpoint rejects', () => {
    expect(isAcceptedPrayerMethod(6)).toBe(false);
  });
});
