import { isSafeExternalUrl, resolveWebsiteDeepLink } from './linking';

describe('external links', () => {
  test.each([
    'https://syrian.zone',
    'http://localhost:8000',
    'mailto:hello@example.com',
    'tel:+963123456',
  ])('allows %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(true);
  });

  test.each([
    'javascript:alert(1)',
    'data:text/html,bad',
    'https://safe.example\njavascript:bad',
    '/relative',
  ])('rejects %s', (url) => {
    expect(isSafeExternalUrl(url)).toBe(false);
  });
});

describe('website deep links', () => {
  test.each([
    ['https://syrian.zone/tierlist', '/feature/tierlist'],
    ['https://syrian.zone/mishwar', '/feature/places'],
    ['https://syrian.zone/syrian-contributors', '/feature/contributors'],
    ['https://www.syrian.zone/roznama/', '/feature/roznama'],
    ['http://syrian.zone/board', '/board'],
    ['https://syrian.zone', '/'],
    ['https://syrian.zone/transit/studio', '/transit/studio'],
  ])('rewrites %s to %s', (url, route) => {
    expect(resolveWebsiteDeepLink(url)).toBe(route);
  });

  test('passes transit city links through with their ids intact', () => {
    expect(resolveWebsiteDeepLink('https://syrian.zone/transit/city/3/map')).toBe(
      '/transit/city/3/map',
    );
  });

  test('keeps the query string and fragment of a shared link', () => {
    expect(resolveWebsiteDeepLink('https://syrian.zone/polls?slug=cabinet#top')).toBe(
      '/feature/polls?slug=cabinet#top',
    );
  });

  test.each([
    'syrianzone://feature/tierlist',
    'https://syrian.zone/tierlist/leaderboard',
    'https://evil.example/tierlist',
    'https://notsyrian.zone/tierlist',
  ])('leaves %s untouched', (url) => {
    expect(resolveWebsiteDeepLink(url)).toBeNull();
  });
});
