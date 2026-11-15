import { expect, test } from 'bun:test';
import { ageGroupOf, decodeHousePage, mergeRoster, parseHouseCSV, seatPoints } from './model';

test('House fallback preserves exact source roster and merges only absent social links', () => {
  const bundled = mergeRoster([]);
  expect(bundled.length).toBeGreaterThan(200);
  const social = bundled.find(member => member.facebook_url || member.twitter_url)!;
  expect(mergeRoster([{ ...social, facebook_url: '', twitter_url: '' }])[0]?.facebook_url).toBe(social.facebook_url);
  expect(mergeRoster([{ ...social, facebook_url: 'https://example.com/new' }])[0]?.facebook_url).toBe('https://example.com/new');
  expect(() => decodeHousePage({ members2026: [{ name_ar: '' }] })).toThrow();
});
test('House age buckets use birth year and preserve missing bucket', () => {
  expect(ageGroupOf({ birth_year: '2000' }, 2026)).toBe('lt30');
  expect(ageGroupOf({ birth_year: '1980' }, 2026)).toBe('40s');
  expect(ageGroupOf({ birth_year: '' }, 2026)).toBe('غير محدد');
});
test('parliament seat layout generates exactly one finite seat per member', () => {
  for (const count of [0, 1, 10, 206, 300]) {
    const seats = seatPoints(count);
    expect(seats).toHaveLength(count);
    expect(seats.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  }
});
test('House CSV preserves quoted names, Arabic normalized search fields and dynamic columns', () => {
  const result = parseHouseCSV('\uFEFFName,Sex,BirthYear,Place,AppealStatus,Extra\r\n"أَحمد, الأول",ذكر,1980,دمشق,مطعون,"سطر أول\nسطر ثان"', 2026);
  expect(result.rows[0]?.Name).toBe('أَحمد, الأول');
  expect(result.rows[0]?.__nameNorm).toContain('احمد');
  expect(result.rows[0]?.__ageGroup).toBe('40s');
  expect(result.rows[0]?.__appealStatus).toBe('مطعون');
  expect(result.rows[0]?.Extra).toBe('سطر أول\nسطر ثان');
  expect(result.headers).toContain('Extra');
});
test('House rejects HTML, missing source identity, oversized or invalid CSV', () => {
  for (const text of ['<!DOCTYPE html><html>error</html>', 'Organisation,City\nfoo,bar', 'Name,Place\n"unterminated,دمشق']) expect(() => parseHouseCSV(text)).toThrow();
});

test('parliament wedges preserve each active member exactly once and every group total', async () => {
  const { hemicycleSeats, groupKey } = await import('./model');
  const members = mergeRoster([]).filter(member => (member.status || 'active') === 'active');
  for (const dimension of ['selection', 'governorate', 'gender', 'age', 'social'] as const) {
    const seats = hemicycleSeats(members, dimension);
    expect(seats).toHaveLength(members.length);
    expect(new Set(seats.map(seat => seat.member.name_ar)).size).toBe(new Set(members.map(member => member.name_ar)).size);
    for (const group of new Set(members.map(member => groupKey(member, dimension)))) expect(seats.filter(seat => seat.group === group)).toHaveLength(members.filter(member => groupKey(member, dimension) === group).length);
  }
});
