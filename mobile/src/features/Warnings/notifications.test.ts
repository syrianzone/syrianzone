import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WarningsPayload } from './api';
import type { WarningItem } from './model';
import {
  createWarningsChecker,
  WARNINGS_CURSOR_KEY,
  warningsChecker,
} from './notifications';

function item(id: number, publishedAt: string): WarningItem {
  return {
    description: '',
    id: String(id),
    link: `https://example.test/${id}.xml`,
    published_at: publishedAt,
    source: { color: '#ef4444', name: 'Feed', slug: 'feed' },
    title: `Warning ${id}`,
  };
}

function payload(items: WarningItem[]): WarningsPayload {
  return { fetched_at: '2026-09-03T12:00:00+00:00', items, stale: false };
}

function harness(items: WarningItem[], cursor: string | null) {
  const store = { cursor };
  const fetch = jest.fn(async () => payload(items));
  const writeCursor = jest.fn(async (value: string) => {
    store.cursor = value;
  });
  const checker = createWarningsChecker({
    fetch,
    readCursor: async () => store.cursor,
    writeCursor,
  });
  return { checker, fetch, store, writeCursor };
}

const day1 = item(1, '2026-09-01T10:00:00+00:00');
const day2 = item(2, '2026-09-02T10:00:00+00:00');
const day3 = item(3, '2026-09-03T10:00:00+00:00');

test('declares the emergency warnings checker contract', () => {
  expect(warningsChecker).toMatchObject({
    channelId: 'alerts',
    id: 'emergency-warnings',
    settingKey: 'emergencyWarnings',
  });
});

test('first run stores the cursor and sends nothing', async () => {
  const { checker, store, writeCursor } = harness([day2, day1], null);

  await expect(checker.run()).resolves.toEqual([]);
  expect(writeCursor).toHaveBeenCalledTimes(1);
  expect(store.cursor).toBe('2026-09-02T10:00:00+00:00');
});

test('later runs notify only items newer than the cursor and advance it', async () => {
  const { checker, store } = harness(
    [day1, day3, day2],
    '2026-09-01T10:00:00Z',
  );

  await expect(checker.run()).resolves.toEqual([
    {
      body: 'Warning 3',
      data: { feature: 'warnings', url: 'https://example.test/3.xml' },
      id: 'warning-3',
      title: 'تنبيه طوارئ',
    },
    {
      body: 'Warning 2',
      data: { feature: 'warnings', url: 'https://example.test/2.xml' },
      id: 'warning-2',
      title: 'تنبيه طوارئ',
    },
  ]);
  expect(store.cursor).toBe('2026-09-03T10:00:00+00:00');
});

test('returns nothing and keeps the cursor when nothing changed', async () => {
  const { checker, writeCursor } = harness(
    [day2, day1],
    '2026-09-02T10:00:00+00:00',
  );

  await expect(checker.run()).resolves.toEqual([]);
  expect(writeCursor).not.toHaveBeenCalled();
});

test('caps a burst at the five newest warnings', async () => {
  const burst = Array.from({ length: 8 }, (_, index) =>
    item(index + 10, `2026-09-03T${String(index).padStart(2, '0')}:00:00Z`),
  );
  const { checker } = harness(burst, '2026-09-02T00:00:00Z');

  const payloads = await checker.run();

  expect(payloads.map((entry) => entry.id)).toEqual([
    'warning-17', 'warning-16', 'warning-15', 'warning-14', 'warning-13',
  ]);
});

test('treats an unreadable cursor like a first run', async () => {
  const { checker, store } = harness([day1], 'garbage');

  await expect(checker.run()).resolves.toEqual([]);
  expect(store.cursor).toBe('2026-09-01T10:00:00+00:00');
});

test('skips the cursor entirely when the source is empty', async () => {
  const { checker, writeCursor } = harness([], null);

  await expect(checker.run()).resolves.toEqual([]);
  expect(writeCursor).not.toHaveBeenCalled();
});

test('persists the cursor in preferences by default', async () => {
  const checker = createWarningsChecker({ fetch: async () => payload([day1]) });

  await checker.run();

  expect(await AsyncStorage.getItem(WARNINGS_CURSOR_KEY)).toBe(
    '2026-09-01T10:00:00+00:00',
  );
});
