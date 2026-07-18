import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  displayEvents,
  eventDetailUrl,
  eventImageUrl,
  fetchF3aliaPage,
  f3aliaProvinceForGovernorate,
  loadF3aliaEvents,
  provinceLabel,
  type F3aliaEvent,
} from './F3aliaEvents.model';

const event = (overrides: Partial<F3aliaEvent> = {}): F3aliaEvent => ({
  address: 'دار الأوبرا',
  attachments: [
    { fileType: 'EVENT_SMALL_IMAGE', fileUrl: 'https://cdn.example/small.jpg' },
    { fileType: 'EVENT_IMAGE', fileUrl: 'https://cdn.example/cover.jpg' },
  ],
  category: { nameAr: 'ثقافة', nameEn: 'Culture' },
  description: 'أمسية ثقافية',
  endDate: null,
  endTime: null,
  eventDate: '2026-07-18',
  eventLink: 'https://app.f3alia.com/events/7',
  eventTime: '18:30',
  id: '7',
  isFree: true,
  isOnline: false,
  name: 'أمسية دمشقية',
  owner: { logoImage: null, organizerName: 'دار الثقافة' },
  province: 'DAMASCUS',
  provinceName: 'Damascus',
  ticketPrice: 0,
  ...overrides,
});

function graphQlResponse(events: readonly F3aliaEvent[], totalElements = events.length) {
  return {
    data: {
      getAllEventsForVisitor: {
        content: events,
        totalElements,
      },
    },
  };
}

function response(payload: unknown, ok = true): Response {
  return {
    json: jest.fn(async () => payload),
    ok,
    status: ok ? 200 : 503,
  } as unknown as Response;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

test('posts the source GraphQL contract with province, date, and bounded size', async () => {
  const fetcher = jest.fn(async () => response(graphQlResponse([event()], 4)));

  await expect(
    fetchF3aliaPage({
      fetcher,
      fromDate: '2026-07-16',
      province: 'DAMASCUS',
      size: 30,
    }),
  ).resolves.toEqual({ events: [event()], totalElements: 4 });

  const calls = fetcher.mock.calls as unknown as [string, RequestInit?][];
  const init = calls[0]?.[1];
  expect(init?.method).toBe('POST');
  expect(JSON.parse(String(init?.body)).variables).toEqual({
    fromDate: '2026-07-16',
    province: 'DAMASCUS',
    size: 30,
  });
});

test('falls back to all Syrian provinces when the selected province is empty', async () => {
  const fetcher = jest
    .fn()
    .mockResolvedValueOnce(response(graphQlResponse([])))
    .mockResolvedValueOnce(response(graphQlResponse([event({ province: 'ALEPPO' })])));

  const result = await loadF3aliaEvents({
    fetcher,
    fromDate: '2026-07-16',
    governorate: 'damascus',
    size: 30,
  });

  expect(result.events[0]?.province).toBe('ALEPPO');
  expect(result.isShowingFallbackEvents).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test('keeps an empty selected province when the caller owns the all-province filter', async () => {
  const fetcher = jest.fn(async () => response(graphQlResponse([])));

  const result = await loadF3aliaEvents({
    fallbackToAll: false,
    fetcher,
    fromDate: '2026-07-16',
    governorate: 'damascus',
    size: 15,
  });

  expect(result.events).toEqual([]);
  expect(result.isShowingFallbackEvents).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test('serves the last valid bounded response when a refresh fails', async () => {
  const successfulFetch = jest.fn(async () => response(graphQlResponse([event()])));
  await loadF3aliaEvents({
    fetcher: successfulFetch,
    fromDate: '2026-07-16',
    governorate: 'damascus',
    size: 30,
  });

  const failingFetch = jest.fn(async () => {
    throw new Error('private upstream body');
  });
  const cached = await loadF3aliaEvents({
    fetcher: failingFetch,
    fromDate: '2026-07-16',
    governorate: 'damascus',
    size: 30,
  });

  expect(cached.cached).toBe(true);
  expect(cached.events).toEqual([event()]);
});

test('keeps fresh events usable when persistent cache storage is unavailable', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(
    new Error('storage unavailable'),
  );
  const fetcher = jest.fn(async () => response(graphQlResponse([event()])));

  await expect(
    loadF3aliaEvents({
      fetcher,
      fromDate: '2026-07-16',
      governorate: 'damascus',
      size: 30,
    }),
  ).resolves.toMatchObject({ cached: false, events: [event()] });
});

test('removes passed events, sorts the next event first, and bounds single mode', () => {
  const events = [
    event({ eventDate: '2026-07-19', eventTime: null, id: 'later' }),
    event({ eventDate: '2026-07-15', id: 'past' }),
    event({ eventDate: '2026-07-18', eventTime: '20:00', id: 'late-time' }),
    event({ eventDate: '2026-07-18', eventTime: '09:00', id: 'early-time' }),
  ];

  expect(displayEvents(events, '2026-07-16', 'grid').map(({ id }) => id)).toEqual([
    'early-time',
    'late-time',
    'later',
  ]);
  expect(displayEvents(events, '2026-07-16', 'single').map(({ id }) => id)).toEqual([
    'early-time',
  ]);
});

test('keeps province names, cover priority, and safe event detail fallbacks', () => {
  expect(f3aliaProvinceForGovernorate('rural-damascus')).toBe('DAMASCUS');
  expect(provinceLabel(event(), 'ar')).toBe('دمشق');
  expect(provinceLabel(event(), 'en')).toBe('Damascus');
  expect(eventImageUrl(event())).toBe('https://cdn.example/cover.jpg');
  expect(eventImageUrl(event({ attachments: [{ fileType: 'EVENT_IMAGE', fileUrl: 'file:///secret' }] }))).toBeNull();
  expect(eventDetailUrl(event({ eventLink: 'javascript:alert(1)' }))).toBe(
    'https://app.f3alia.com/?event_id=7',
  );
});
