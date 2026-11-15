export const prayerTimesFixtureLabel = 'LOCAL SYNTHETIC PRAYER TIMES';
export interface PrayerTimesFixtureRead { date: string; timezone: 'Asia/Damascus'; governorate: 'damascus'; method: 3 }
const origin = 'https://127.0.0.1:9443';
// Fixed synthetic clocks from tests/Feature/PrayerTimezoneApiTest.php.
// This adapter proves DTO consumers, not the external provider or prayer accuracy.
const timings = Object.freeze({ Fajr: '05:00', Sunrise: '06:15', Dhuhr: '12:00', Asr: '15:00', Maghrib: '18:00', Isha: '19:30' });
const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Damascus', calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit' });
function damascusDay(now: Date): string {
  if (!Number.isFinite(now.getTime())) throw new Error('The local prayer fixture requires the actual civil day.');
  const parts = Object.fromEntries(calendar.formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Fixture entry only. Other requests retain their original transport behavior.
// The optional clock argument is a pure host-test seam, never a system clock change.
export function createPrayerTimesFixture(transport: typeof fetch, onRead?: (metadata: PrayerTimesFixtureRead) => void,
  now: () => Date = () => new Date()): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    let url: URL, headers: Headers;
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      url = new URL(raw);
      headers = new Headers(init?.headers ?? request?.headers);
    } catch { return transport(input, init); }
    if (raw.split(/[?#]/, 1)[0] !== `${origin}/api/v1/prayer-times` || url.origin !== origin || url.username || url.password || url.href.includes('#') || url.pathname !== '/api/v1/prayer-times'
      || (init?.method ?? request?.method ?? 'GET').toUpperCase() !== 'GET'
      || init?.body != null || request?.body != null || init?.signal?.aborted || request?.signal.aborted
      || (init?.credentials ?? request?.credentials) !== 'omit' || (init?.redirect ?? request?.redirect) !== 'error'
      || headers.get('Accept') !== 'application/json' || [...headers.keys()].some(name => !['accept', 'user-agent'].includes(name)))
      return transport(input, init);
    const keys = [...url.searchParams.keys()];
    if (keys.length !== 3 || new Set(keys).size !== 3 || keys.some(key => !['governorate', 'method', 'date'].includes(key))
      || url.searchParams.get('governorate') !== 'damascus' || url.searchParams.get('method') !== '3') return transport(input, init);
    const date = damascusDay(now());
    if (url.searchParams.get('date') !== date) return transport(input, init);
    const metadata: PrayerTimesFixtureRead = Object.freeze({ date, timezone: 'Asia/Damascus', governorate: 'damascus', method: 3 });
    const response = new Response(JSON.stringify({ ...metadata, latitude: 33.5138, longitude: 36.2765,
      timings, hijri: null, fixture: prayerTimesFixtureLabel }), {
      status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Native-Fixture': prayerTimesFixtureLabel }
    });
    Object.defineProperty(response, 'url', { value: url.href });
    onRead?.(metadata);
    return response;
  }) as typeof fetch;
}
