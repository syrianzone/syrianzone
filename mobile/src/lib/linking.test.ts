import { isSafeExternalUrl } from './linking';

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
