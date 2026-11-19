import { describe, expect, test } from 'bun:test';
import { StackRouter } from '@react-navigation/routers';
import inventory from '../../parity/routes-and-shell.json';
import { appPathFromState, appStateFromPath, catalogueDestination, featureRouteId, parseAppLink, resolveTransitLink, targetForSection } from './app-links';
import { websiteRoutes, websiteRedirects, filamentNativeRoutes } from './website-routes.generated';
import { decodeRouteMetadata } from './transit-model';

const features = [...new Set([...websiteRoutes.map(route => route.section), ...filamentNativeRoutes.map(route => route.section), 'account', 'hotel', 'hotels', 'guides'])];
const parse = (path: string) => parseAppLink(path, features);
const state = (path: string) => appStateFromPath(path, features);
const sample = (path: string) => path.replaceAll('{roomCode}', 'room-123').replaceAll('{shareId}', 'shared-123').replaceAll('{routeId}', 'route-123').replaceAll('{number}', '123').replaceAll('{record}', '101').replaceAll('{slug}', 'test-poll').replaceAll('{id}', path.startsWith('/transit/') ? 'damascus' : 'existing-123').replaceAll('{any}', 'old/path');

test('catalogue destinations retain saved filters for registered native screens', () => {
  expect(catalogueDestination('/tierlist/leaderboard?period=week', ['tierlist'])).toMatchObject({
    kind: 'feature', section: 'tierlist', params: { period: 'week' }
  });
  expect(catalogueDestination('/mishwar?category=market', [])).toEqual({ kind: 'tab', tab: 'Places', params: { category: 'market' } });
});

test('catalogue destinations open on the website when the app cannot apply them', () => {
  for (const href of ['/games', '/govtcvs', '/mishwar?guide=207', '/mishwar?category=unknown']) {
    expect(catalogueDestination(href, [], 'https://example.test')).toEqual({ kind: 'website', url: `https://example.test${href}` });
  }
  expect(catalogueDestination('/mishwar', [])).toEqual({ kind: 'tab', tab: 'Places', params: {} });
  expect(() => catalogueDestination('//example.invalid/games', [])).toThrow();
});

test('native child page names are preserved alongside numeric reader pages', () => {
  for (const page of ['overview', 'colors', 'fonts', 'flag', 'icons', 'map']) {
    const target = { kind: 'feature', section: 'syid', params: { page } } as const;
    expect(parse(`/feature/syid?page=${page}`)).toEqual(target);
    expect(targetForSection('syid', { page }, features)).toEqual(target);
  }
  expect(parse('/feature/muslim_quran?page=604')).toEqual({ kind: 'feature', section: 'muslim_quran', params: { page: '604' } });
});

describe('audited website routes', () => {
  test('the generated table covers every audited page and redirect', () => {
    expect(websiteRoutes.map<string>(route => route.path)).toEqual(inventory.pageRoutes.map(route => route.uri));
    expect(websiteRedirects.map<string>(route => route.path)).toEqual(inventory.redirectAliases.map(route => route.uri));
    expect(filamentNativeRoutes.map<string>(route => route.path)).toEqual(inventory.filamentRoutes.filter(route => 'nativeTarget' in route).map(route => route.uri));
    for (const route of [...websiteRoutes, ...websiteRedirects, ...filamentNativeRoutes]) expect(parse(sample(route.path)), route.path).not.toBeNull();
  });

  test('UserResource aliases require positive safe IDs', () => {
    expect(parse('/superadmin/users')).toEqual({ kind: 'feature', section: 'users_admin', params: {} });
    expect(parse('/superadmin/users/create')).toEqual({ kind: 'feature', section: 'users_admin', params: { create: '1' } });
    expect(parse('/superadmin/users/101/edit')).toEqual({ kind: 'feature', section: 'users_admin', params: { edit: '101' } });
    for (const path of ['/superadmin/users/0/edit', '/superadmin/users/abc/edit', '/superadmin/users/9007199254740992/edit']) expect(parse(path)).toBeNull();
  });

  test('Filament login and panel aliases select the native password form and dashboard', () => {
    const login = { kind: 'feature', section: 'account', params: { mode: 'superadmin' } } as const;
    for (const path of ['/superadmin/login', 'https://syrian.zone/superadmin/login', 'syrianzone://superadmin/login', '/superadmin/login?mode=google']) {
      expect(parse(path), path).toEqual(login);
    }
    expect(parse('/superadmin')).toEqual({ kind: 'feature', section: 'dashboard', params: {} });
    expect(state('/superadmin/login')?.routes).toEqual([
      { name: 'Main' },
      { name: 'Feature', params: { section: 'account', params: { mode: 'superadmin' } } },
    ]);
    expect(appPathFromState(state('/superadmin/login')!)).toBe('/superadmin/login');
  });

  test('website game, account and native tab aliases select their actual screens', () => {
    for (const section of ['2048', 'solitare', 'tarneeb', 'trix']) expect(parse(`/games/${section}`)).toEqual({ kind: 'feature', section, params: {} });
    expect(parse('/syrian-contributors')).toEqual({ kind: 'feature', section: 'contributors', params: {} });
    expect(parse('/transit/studio?city=damascus&edit=draft-1&editKind=draft')).toEqual({ kind: 'feature', section: 'transit_studio', params: { city: 'damascus', edit: 'draft-1', editKind: 'draft' } });
    expect(parse('/transit/admin')).toEqual({ kind: 'feature', section: 'transit_admin', params: {} });
    expect(parse('/home')).toEqual({ kind: 'tab', tab: 'Home' });
    expect(parse('/saved')).toEqual({ kind: 'tab', tab: 'Saved' });
    expect(parse('/settings')).toEqual({ kind: 'tab', tab: 'Settings' });
    expect(parse('/account')).toEqual({ kind: 'feature', section: 'account', params: {} });
  });

  test('room and Places query aliases preserve the source parameter contract', () => {
    expect(parse('/guesswho/room/room-123')).toEqual({ kind: 'feature', section: 'guesswho', params: { room: 'room-123' } });
    expect(parse('/mishwar?place=201&guide=101&view=grid&q=دمشق')).toEqual({ kind: 'tab', tab: 'Places', params: { guideId: '101', placeId: '201', q: 'دمشق', view: 'grid' } });
    expect(parse('/places?place=201')).toEqual(parse('/mishwar?place=201'));
    expect(parse('/place/201')).toEqual({ kind: 'place', id: 201 });
  });

  test('polls, Compass and Promises select the audited child screens', () => {
    expect(parse('/polls/test-poll/leaderboard?status=former')).toEqual({ kind: 'feature', section: 'tierlist', params: { poll: 'test-poll', status: 'former', view: 'leaderboard' } });
    expect(parse('/compass/stats')).toEqual({ kind: 'feature', section: 'compass', params: { view: 'stats' } });
    expect(parse('/compass/s/share-123')).toEqual({ kind: 'feature', section: 'compass', params: { shareId: 'share-123' } });
    expect(parse('/promises/123?from=%2Fpromises%3Fstate%3Dopen')).toEqual({ kind: 'feature', section: 'promises', params: { from: '/promises?state=open', number: '123' } });
    expect(parse('/admin/promises/existing-123/edit')).toEqual({ kind: 'feature', section: 'promises', params: { id: 'existing-123', view: 'admin-edit' } });
    expect(parse('/admin/polls/existing-123/edit')).toEqual({ kind: 'feature', section: 'dashboard', params: { 'edit-poll': 'existing-123' } });
    expect(parse('/promises?state[]=open&state[]=fulfilled&sort=newest')).toEqual({ kind: 'feature', section: 'promises', params: { sort: 'newest', url: '/promises?sort=newest&state%5B%5D=open&state%5B%5D=fulfilled' } });
  });

  test('transit URLs carry bounded IDs and initial views without serialized cities', () => {
    expect(parse('/transit/city/damascus?route=route-1&view=list')).toEqual({ kind: 'transit', params: { cityId: 'damascus', routeId: 'route-1', initialView: 'list' } });
    expect(parse('/transit/city/damascus/map')).toEqual({ kind: 'transit', params: { cityId: 'damascus', initialView: 'list' } });
    expect(parse('/transit/city/damascus/map?view=map')).toEqual({ kind: 'transit', params: { cityId: 'damascus', initialView: 'map' } });
    expect(parse('/transit/city/damascus/route/route-2')).toEqual({ kind: 'transit', params: { cityId: 'damascus', routeId: 'route-2', initialView: 'list' } });
    expect(state('/transit/city/damascus/map')?.routes.map(route => route.name)).toEqual(['Main', 'TransitLink']);
    // Published route metadata uses the domain EntityId contract, not city slugs.
    const published = decodeRouteMetadata([{ id: 'Route_A-42', cityId: 'damascus', nameAr: 'خط تجريبي' }])[0]!;
    for (const id of [String(published.id), '_legacy_route', '42']) {
      expect(targetForSection('transit', { cityId: 'damascus', routeId: id }, features)).toEqual({ kind: 'transit', params: { cityId: 'damascus', routeId: id, initialView: 'list' } });
      expect(parse(`/transit/city/damascus?route=${id}`)).toEqual(parse(`/transit/city/damascus/route/${id}`));
    }
  });
});

describe('cold and consecutive links', () => {
  test('cold features have Main below and canonical nested params', () => {
    const cold = state('/feature/phonebook?q=ألف&page=1');
    expect(cold?.index).toBe(1);
    expect(cold?.routes).toEqual([{ name: 'Main' }, { name: 'Feature', params: { section: 'phonebook', params: { page: '1', q: 'ألف' } } }]);
    expect(parse('syrianzone://games/2048')).toEqual(parse('/games/2048'));
    expect(parse('syrianzone://')).toEqual(parse('/'));
    expect(parse('https://syrian.zone/guesswho/room/room-123')).toEqual(parse('/guesswho/room/room-123'));
  });

  test('canonical URL serialization round-trips parameters without city objects', () => {
    for (const link of ['/phonebook?q=ألف&page=2', '/guesswho/room/room-123', '/mishwar?guide=101&place=201&view=grid', '/transit/city/damascus/route/r-1', '/compass/stats', '/compass/s/shared-123', '/promises/123', '/admin/promises/existing-123/edit', '/polls/test-poll/leaderboard', '/superadmin/login', '/superadmin']) {
      const encoded = appPathFromState(state(link)!);
      expect(parse(encoded), encoded).toEqual(parse(link));
    }
    const city = { id: 'damascus', name: 'Damascus', nameAr: 'دمشق', coordinates: null, routeCount: 2, comingSoon: false };
    const path = appPathFromState({ routes: [{ name: 'Main' }, { name: 'TransitCity', params: { city, routeId: 'r-1', initialView: 'map' } }] });
    expect(path).toBe('/transit/city/damascus?route=r-1&view=map');
    expect(path).not.toContain('city=');
    expect(path).not.toContain('Damascus');
  });

  test('consecutive parameterized links create distinct feature instances', () => {
    const router = StackRouter({ initialRouteName: 'Main' });
    const options = { routeNames: ['Main', 'Feature', 'Place', 'TransitLink', 'TransitCity'], routeParamList: {}, routeGetIdList: { Feature: ({ params }: { params?: object }) => featureRouteId(params) } };
    let current = router.getRehydratedState({ routes: state('/feature/phonebook?q=first&page=1')!.routes, stale: true }, options);
    const first = current.routes.at(-1)!;
    for (const link of ['/feature/phonebook?q=second&page=2', '/guesswho/room/room-a', '/guesswho/room/room-b']) {
      const next = state(link)!.routes.at(-1)!;
      const changed = router.getStateForAction(current, { type: 'NAVIGATE', payload: { name: next.name, ...(next.params ? { params: next.params } : {}) } }, options)!;
      current = router.getRehydratedState(changed, options);
      expect(current.routes.at(-1)?.params).toEqual(next.params);
    }
    expect(current.routes[1]?.key).toBe(first.key);
    expect(new Set(current.routes.map(route => route.key)).size).toBe(current.routes.length);
    expect(featureRouteId({ section: 'phonebook', params: { q: 'same', page: '2' } })).toBe(featureRouteId({ section: 'phonebook', params: { page: '2', q: 'same' } }));
    expect(featureRouteId({ section: 'muslim_quran', page: '2' })).not.toBe(featureRouteId({ section: 'muslim_quran', page: '3' }));
  });

  test('transit city data resolves only from real city records', () => {
    const city = { id: 'damascus', name: 'Damascus', nameAr: 'دمشق', coordinates: null, routeCount: 2, comingSoon: false };
    expect(resolveTransitLink({ cityId: 'damascus', routeId: 'r-1', initialView: 'map' }, [city])).toEqual({ city, routeId: 'r-1', initialView: 'map' });
    expect(() => resolveTransitLink({ cityId: 'aleppo' }, [city])).toThrow();
    expect(() => resolveTransitLink({ cityId: 'damascus' }, [{ ...city, comingSoon: true }])).toThrow();
    expect(targetForSection('transit', { cityId: 'damascus', routeId: 'r-1' }, features)).toEqual({ kind: 'transit', params: { cityId: 'damascus', routeId: 'r-1', initialView: 'list' } });
  });
});

test('malformed paths, foreign origins, ambiguous queries and oversized data never navigate', () => {
  for (const path of ['https://evil.invalid/games/2048', 'http://syrian.zone/games/2048', 'https://syrian.zone@evil.invalid/games', '//evil.invalid/games', '/games/../games/2048', '/games/%2e%2e/2048', '/games%2f2048', '/games\\2048', '/games/%zz', '/unknown', '/feature/unknown', '/place/0', '/place/12345678901234567890', '/mishwar?place=-1', '/mishwar?guide=0', '/feature/phonebook?q=%00', '/feature/phonebook?q=%zz', '/feature/phonebook?q=a&q=b', '/feature/phonebook?__proto__=x', '/feature/phonebook?section=admin', '/transit/city/DAMASCUS', '/promises/1234567890', '/feature/phonebook?q=' + 'x'.repeat(4097)]) expect(parse(path), path).toBeNull();
});
