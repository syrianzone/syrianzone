import { expect, test } from 'bun:test';
import { parsePageBootstrap, parsePageResponse, resolveSitePath } from './page-protocol';

test('reads documented Inertia bootstrap data without interpreting markup or scripts', () => {
  const html = `<script>throw new Error('never execute')</script><div id="app" data-page="{&quot;component&quot;:&quot;Home&quot;,&quot;version&quot;:&quot;build-123&quot;,&quot;props&quot;:{&quot;label&quot;:&quot;سوريا &amp; الناس&quot;}}"></div>`;
  expect(parsePageBootstrap(html)).toEqual({ component: 'Home', version: 'build-123', props: { label: 'سوريا & الناس' } });
  expect(() => parsePageBootstrap('<html>Sign in</html>')).toThrow();
  expect(() => parsePageBootstrap('<div id="app" data-page="{}"></div>')).toThrow();
});

test('validates expected page component instead of accepting an authentication redirect', () => {
  expect(parsePageResponse({ component: 'Promises/Index', props: { promises: [] } }, 'Promises/Index')).toEqual({ promises: [] });
  expect(() => parsePageResponse({ component: 'Auth/Login', props: {} }, 'Promises/Index')).toThrow();
  expect(() => parsePageResponse({ component: 'Promises/Index', props: [] }, 'Promises/Index')).toThrow();
});

test('reads current Inertia JSON script data while preserving literal text and ignoring executable scripts', () => {
  const page = { component: 'Home', version: 'current', props: { label: 'سوريا &amp; الناس', nested: { enabled: true } } };
  const html = `<div id="app"></div><script data-page="app" type="application/json">${JSON.stringify(page)}</script><script>throw new Error('never execute')</script>`;
  expect(parsePageBootstrap(html)).toEqual(page);
  expect(() => parsePageBootstrap(`<script data-page="app" type="text/javascript">${JSON.stringify(page)}</script>`)).toThrow();
  expect(() => parsePageBootstrap(`<script type="application/json" data-page="other">${JSON.stringify(page)}</script>`)).toThrow();
});

test('keeps API and public page paths on the configured HTTPS site', () => {
  const origin = new URL('https://syrian.zone');
  expect(resolveSitePath(origin, 'transit/cities').pathname).toBe('/api/v1/transit/cities');
  expect(resolveSitePath(origin, '/api/polls/best-ministers').pathname).toBe('/api/polls/best-ministers');
  expect(resolveSitePath(origin, '/promises', { q: 'دمشق & حلب', page: 2 }).searchParams.get('q')).toBe('دمشق & حلب');
  for (const path of ['https://other.test/data', '//other.test/data', '/../account', '/%2e%2e/account', '/api\\account']) {
    expect(() => resolveSitePath(origin, path)).toThrow();
  }
});
