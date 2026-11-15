import { expect, test } from 'bun:test';
import { hydrateHomePreferences } from './hydrate';
import { defaultPreferences } from './model';

test('mirrors account links and toggles locally so signing out preserves them', async () => {
  let saved = defaultPreferences;
  const result = await hydrateHomePreferences(defaultPreferences, { showWeather: false, theme: 'dark', customLinks: [{ id: 'a', name: 'سوريا', url: 'https://example.com', icon: '🌍' }] }, async value => { saved = value; });
  expect(result.appearance).toBe('dark');
  expect((await hydrateHomePreferences(saved, null, async () => { throw new Error('guest read must not overwrite'); })).value.customLinks[0]?.name).toBe('سوريا');
  expect(saved.showWeather).toBe(false);
});
test('seeds empty accounts from device preferences and keeps website-only themes local', async () => {
  expect((await hydrateHomePreferences(defaultPreferences, {}, async () => undefined)).seedAccount).toBe(true);
  expect((await hydrateHomePreferences(defaultPreferences, { theme: 'website-only' }, async () => undefined)).appearance).toBeNull();
});
