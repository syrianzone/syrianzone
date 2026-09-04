import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  decodeHtmlEntities,
  formatRelativeTime,
  isFresh,
  newerThan,
  newestPublishedAt,
  parseJardPage,
} from './model';

const fixture = readFileSync(
  join(__dirname, '__fixtures__/jard-warnings.html'),
  'utf8',
);

function jardPage(rows: unknown[]): string {
  const json = JSON.stringify({ props: { items: { data: rows } } });
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<html><body><div id="app" data-page="${escaped}"></div></body></html>`;
}

function jardRow(id: number, category: string, pubDate: string) {
  return {
    description: 'Body',
    feed: { category, color: '#123456', name: 'Feed', slug: 'feed' },
    id,
    link: `https://example.test/${id}.xml`,
    pub_date: pubDate,
    title: `Item ${id}`,
  };
}

test('parses twenty warnings from the saved jard page newest first', () => {
  const items = parseJardPage(fixture);

  expect(items).toHaveLength(20);
  expect(items[0]).toEqual({
    description:
      'نحذر الأهالي في محافظتي الرقة ودير الزور، ولا سيما القاطنين بالقرب من مجرى نهر الفرات، من الزيادة في كميات المياه الممررة من سد كديران وذلك لاستمرار ك...',
    id: '19901',
    link: 'https://climweb.med.gov.sy/api/cap/a4ac80ab-782a-4a2c-87e8-53d32cab84c3.xml',
    published_at: '2026-09-02T17:56:00.000Z',
    source: {
      color: '#ef4444',
      name: 'أحدث التنبيهات من وزارة الطوارئ وإدارة الكوارث',
      slug: 'climweb_warnings',
    },
    title: 'استمرار ارتفاع منسوب نهر الفرات 2 أيلول 2026',
  });
  const times = items.map((item) => Date.parse(item.published_at));
  expect(times).toEqual([...times].sort((a, b) => b - a));
});

test('drops rows whose feed is not in the warnings category', () => {
  const items = parseJardPage(
    jardPage([
      jardRow(1, 'news', '2026-09-02T10:00:00Z'),
      jardRow(2, 'warnings', '2026-09-01T10:00:00Z'),
      jardRow(3, 'warnings', '2026-09-02T09:00:00Z'),
      { id: 4 },
    ]),
  );

  expect(items.map((item) => item.id)).toEqual(['3', '2']);
  expect(items[0]?.source.color).toBe('#123456');
});

test('throws when the page carries no inertia data', () => {
  expect(() => parseJardPage('<html></html>')).toThrow(
    'No Inertia page data found.',
  );
});

test('decodes blade escaping in a single pass', () => {
  expect(decodeHtmlEntities('&quot;A &amp;amp; B&quot; &#039;&lt;&gt;')).toBe(
    '"A &amp; B" \'<>',
  );
});

test('newerThan keeps only items published after the cursor', () => {
  const items = parseJardPage(
    jardPage([
      jardRow(1, 'warnings', '2026-09-01T10:00:00Z'),
      jardRow(2, 'warnings', '2026-09-02T10:00:00Z'),
      jardRow(3, 'warnings', '2026-09-03T10:00:00Z'),
    ]),
  );

  expect(newerThan(items, '2026-09-02T10:00:00+00:00').map((i) => i.id)).toEqual(['3']);
  expect(newerThan(items, null)).toHaveLength(3);
  expect(newerThan(items, 'garbage')).toHaveLength(3);
  expect(newestPublishedAt(items)).toBe('2026-09-03T10:00:00.000Z');
  expect(newestPublishedAt([])).toBeNull();
});

test('isFresh accepts warnings younger than a day', () => {
  const now = Date.parse('2026-09-03T12:00:00Z');

  expect(isFresh({ published_at: '2026-09-02T12:00:01Z' }, now)).toBe(true);
  expect(isFresh({ published_at: '2026-09-02T12:00:00Z' }, now)).toBe(false);
  expect(isFresh({ published_at: 'nope' }, now)).toBe(false);
});

test('formats relative time in Arabic and English', () => {
  const now = Date.parse('2026-09-03T12:00:00Z');
  const at = (iso: string, locale: 'ar' | 'en') =>
    formatRelativeTime(iso, locale, now);

  expect(at('2026-09-03T11:59:40Z', 'ar')).toBe('الآن');
  expect(at('2026-09-03T11:59:40Z', 'en')).toBe('just now');
  expect(at('2026-09-03T11:59:00Z', 'ar')).toBe('قبل دقيقة');
  expect(at('2026-09-03T11:58:00Z', 'ar')).toBe('قبل دقيقتين');
  expect(at('2026-09-03T11:55:00Z', 'ar')).toBe('قبل 5 دقائق');
  expect(at('2026-09-03T11:45:00Z', 'ar')).toBe('قبل 15 دقيقة');
  expect(at('2026-09-03T11:45:00Z', 'en')).toBe('15 minutes ago');
  expect(at('2026-09-03T09:00:00Z', 'ar')).toBe('قبل 3 ساعات');
  expect(at('2026-09-03T11:00:00Z', 'en')).toBe('1 hour ago');
  expect(at('2026-09-01T12:00:00Z', 'ar')).toBe('قبل يومين');
  expect(at('2026-08-31T12:00:00Z', 'en')).toBe('3 days ago');
  expect(at('2026-07-01T12:00:00Z', 'ar')).toBe('2026-07-01');
  expect(at('nope', 'en')).toBe('');
});
