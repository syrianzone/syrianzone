import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonical, decodePrayerHomeContext, sourceHomeTransition } from './prayer-home-context';
const hash = async (value: string) => createHash('sha256').update(value).digest('hex');

test('actual PHP armed context matches native Home hydration with Arabic governorate and link text', async () => {
  const result = spawnSync('php', [fileURLToPath(new URL('./context-vector.php', import.meta.url))], { encoding: 'utf8' });
  expect(result.status).toBe(0); expect(result.stderr).toBe('');
  const value = JSON.parse(result.stdout) as { context: unknown; settings101: Record<string, unknown> };
  const context = decodePrayerHomeContext(value.context);
  expect(value.settings101.eventsGovernorate).toBe('دمشق');
  const first = await sourceHomeTransition(null, value.settings101, hash);
  expect(first.seedAccount).toBe(false); expect(first.appearance).toBe('dark'); expect(first.hash).toBe(context.home101);
  expect(first.value.customLinks[0]?.name).toBe('رابط سوري');
  const second = await sourceHomeTransition(JSON.stringify(first.value), {}, hash);
  expect(second.seedAccount).toBe(true); expect(second.hash).toBe(context.home102); expect(context.seed102).toBe(true);
  expect(canonical(second.value)).toBe(canonical(first.value));
});
test('normalizing legacy link text or URL refuses before the Source app can write a different seed', async () => {
  const base = { theme: 'dark', showWeather: true, showPrayerTimes: true, showEvents: true, eventsGovernorate: 'دمشق' };
  for (const link of [{ id: 'x', label: 'رابط', url: 'https://example.invalid/', icon: '' },
    { id: 'x', name: ' رابط ', url: 'https://example.invalid/', icon: '' }, { id: 'x', name: 'رابط', url: 'https://example.invalid', icon: '' }]) {
    await expect(sourceHomeTransition(null, { ...base, customLinks: [link] }, hash)).rejects.toThrow();
  }
});
test('context appearance metadata requires exact strings without scalar or container coercion', () => {
  const context = { version: 2, home101: 'a'.repeat(64), home102: 'a'.repeat(64), appearance101: 'dark', appearance102: 'light', seed102: false };
  for (const value of [['dark'], { toString: () => 'dark' }, 1, true, null]) {
    expect(() => decodePrayerHomeContext({ ...context, appearance101: value })).toThrow();
    expect(() => decodePrayerHomeContext({ ...context, appearance102: value })).toThrow();
  }
});
test('nonempty102 without Home fields retains prior local Home without a theme or seed write', async () => {
  const result = spawnSync('php', [fileURLToPath(new URL('./context-vector.php', import.meta.url)), '--nonempty-other'], { encoding: 'utf8' });
  expect(result.status).toBe(0); expect(result.stderr).toBe('');
  const value = JSON.parse(result.stdout) as { context: unknown; settings101: Record<string, unknown>; settings102: Record<string, unknown> };
  const context = decodePrayerHomeContext(value.context), first = await sourceHomeTransition(null, value.settings101, hash);
  const second = await sourceHomeTransition(JSON.stringify(first.value), value.settings102, hash);
  expect(context.seed102).toBe(false); expect(second.seedAccount).toBe(false); expect(second.appearance).toBeNull();
  expect(second.hash).toBe(context.home102); expect(second.hash).toBe(context.home101);
  expect(canonical(second.value)).toBe(canonical(first.value));
});
