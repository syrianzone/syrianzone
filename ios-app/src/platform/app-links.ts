import type { InitialState, NavigationState } from '@react-navigation/native';
import { isEntityId, type City } from '../domain';
import type { RootRoutes } from '../navigation';
import { featureParameters } from './feature-location';
import { canonicalHttpsOrigin, configuredSiteOrigin } from './site-origin';
import { filamentNativeRoutes, websiteRedirects, websiteRoutes } from './website-routes.generated';

type Tab = 'Home' | 'Transit' | 'Places' | 'Saved' | 'Settings';
export type AppLinkTarget = { kind: 'tab'; tab: Tab; params?: Record<string, string> }
  | { kind: 'feature'; section: string; params: Record<string, string> }
  | { kind: 'place'; id: number }
  | { kind: 'transit'; params: RootRoutes['TransitLink'] };
const unsafeKey = new Set(['__proto__', 'constructor', 'prototype', 'section']);
const nativeRoutes = [...websiteRoutes, ...filamentNativeRoutes];
const sourceSections = [...new Set(nativeRoutes.map(route => route.section))];
const boundedId = (value: string): boolean => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
const cityId = (value: string): boolean => /^[a-z0-9][a-z0-9-]{0,127}$/.test(value);
const positive = (value: string, digits = 10): boolean => new RegExp(`^[0-9]{1,${digits}}$`).test(value) && Number(value) > 0;
const sorted = (value: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));

export function parameterIdentity(params: Readonly<Record<string, string>>): string {
  return JSON.stringify(sorted({ ...params }));
}

export function featureRouteId(value: unknown): string {
  if (!value || typeof value !== 'object' || !('section' in value) || typeof value.section !== 'string') throw new Error('القسم غير صالح.');
  return `${value.section}:${parameterIdentity(featureParameters(value))}`;
}

function safeParameters(params: Record<string, string>): Record<string, string> {
  return sorted(featureParameters({ params }));
}

export function targetForSection(section: string, input: Record<string, string> = {}, features: readonly string[] = sourceSections): AppLinkTarget | null {
  let params: Record<string, string>;
  try { params = safeParameters(input); } catch { return null; }
  if (Object.entries(params).some(([key, value]) => /[\u0000-\u001f\u007f]/.test(value) || unsafeKey.has(key))) return null;
  if (params.room && !boundedId(params.room) || params.shareId && !boundedId(params.shareId)) return null;
  if (params.number && !positive(params.number, 9)) return null;
  if (section === 'users_admin' && params.edit && (!positive(params.edit, 16) || !Number.isSafeInteger(Number(params.edit)))) return null;
  if (section === 'place') return positive(params.id ?? '') ? { kind: 'place', id: Number(params.id) } : null;
  if (section === 'home' || section === 'saved' || section === 'settings') return { kind: 'tab', tab: section === 'home' ? 'Home' : section === 'saved' ? 'Saved' : 'Settings' };
  if (section === 'transit') {
    if (!params.cityId) return params.routeId ? null : { kind: 'tab', tab: 'Transit' };
    if (!cityId(params.cityId) || params.routeId && !isEntityId(params.routeId) || params.initialView && !['map', 'list'].includes(params.initialView)) return null;
    return { kind: 'transit', params: { cityId: params.cityId, ...(params.routeId ? { routeId: params.routeId } : {}), initialView: params.initialView === 'map' ? 'map' : 'list' } };
  }
  if (section === 'places' || section === 'mishwar') {
    const { place, guide, ...remaining } = params;
    const normalized = sorted({ ...remaining, ...(place ? { placeId: place } : {}), ...(guide ? { guideId: guide } : {}) });
    if (normalized.placeId && !positive(normalized.placeId) || normalized.guideId && !positive(normalized.guideId)) return null;
    return { kind: 'tab', tab: 'Places', params: normalized };
  }
  return features.includes(section) ? { kind: 'feature', section, params } : null;
}

function parts(input: string, origin: string): { path: string; query: URLSearchParams } | null {
  if (input.length > 12288 || /[\u0000-\u001f\u007f\\]/.test(input)) return null;
  let local = input;
  if (local.startsWith('syrianzone://')) local = local.slice('syrianzone://'.length);
  else if (/^[a-z][a-z0-9+.-]*:/i.test(local)) {
    const absolute = /^(https:\/\/[^/?#]+)([^?#]*)(\?[^#]*)?(?:#.*)?$/.exec(local);
    if (!absolute) return null;
    try { if (!['https://syrian.zone', canonicalHttpsOrigin(origin)].includes(canonicalHttpsOrigin(absolute[1]!))) return null; } catch { return null; }
    local = `${absolute[2] || '/'}${absolute[3] ?? ''}`;
  }
  if (local.startsWith('//')) return null;
  local = local.split('#', 1)[0] ?? '';
  const mark = local.indexOf('?');
  const encodedPath = mark < 0 ? local : local.slice(0, mark);
  const queryText = mark < 0 ? '' : local.slice(mark + 1);
  if (encodedPath.length > 2048 || queryText.length > 8192) return null;
  let path: string;
  try {
    path = `/${encodedPath.replace(/^\//, '').replace(/\/$/, '')}`;
    const decoded = decodeURIComponent(path);
    if (decoded.includes('\\') || /[\u0000-\u001f\u007f]/.test(decoded) || decoded.split('/').some(segment => segment === '.' || segment === '..') || /%2f/i.test(path)) return null;
    path = decoded;
    if (/%(?![0-9a-f]{2})/i.test(queryText)) return null;
    for (const component of queryText.split('&')) for (const part of component.split('=')) decodeURIComponent(part.replaceAll('+', ' '));
  } catch { return null; }
  const query = new URLSearchParams(queryText);
  if ([...query].length > 32 || [...query].some(([key, value]) => key.length > 80 || value.length > 4096 || /[\u0000-\u001f\u007f]/.test(key + value) || unsafeKey.has(key))) return null;
  return { path, query };
}

function match(pattern: string, path: string): Record<string, string> | null {
  const expected = pattern.split('/'), actual = path.split('/');
  const wildcard = expected.at(-1) === '{any}';
  if (!wildcard && expected.length !== actual.length || wildcard && actual.length < expected.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < expected.length; index++) {
    const part = expected[index]!, value = actual[index] ?? '';
    const name = /^\{([a-zA-Z]+)\}$/.exec(part)?.[1];
    if (!name) { if (part !== value) return null; continue; }
    if (name === 'any') { if (actual.slice(index).some(segment => !boundedId(segment))) return null; params.any = actual.slice(index).join('/'); break; }
    if (name === 'number' ? !positive(value, 9) : name === 'routeId' ? !isEntityId(value) : pattern.startsWith('/transit/') && name === 'id' ? !cityId(value) : !boundedId(value)) return null;
    params[name] = value;
  }
  return params;
}

function substitutions(value: string, params: Record<string, string>): string {
  return value.replace(/\{([a-zA-Z]+)\}/g, (_all, key: string) => params[key] ?? '');
}

export function parseAppLink(input: string, features: readonly string[] = sourceSections, origin = configuredSiteOrigin): AppLinkTarget | null {
  const parsed = parts(input, origin);
  if (!parsed) return null;
  let { path, query } = parsed;
  for (const alias of websiteRedirects) {
    const values = match(alias.path, path);
    if (!values) continue;
    const destination = substitutions(alias.destination, values);
    const redirected = parts(destination, origin);
    if (!redirected) return null;
    path = redirected.path;
    query = alias.preserveQuery ? query : redirected.query;
    break;
  }
  const promiseFilters = path === '/promises';
  const queryParams: Record<string, string> = {};
  for (const [key, value] of query) {
    if (key === 'params' && path.startsWith('/feature/')) { queryParams.params = value; continue; }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(key)) {
      if (promiseFilters && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}\[(?:[0-9]{1,3})?\]$/.test(key)) continue;
      return null;
    }
    if (Object.hasOwn(queryParams, key) && !promiseFilters) return null;
    queryParams[key] = value;
  }
  if (promiseFilters && query.size) { query.sort(); queryParams.url = `/promises?${query}`; }
  if (['/', '/home', '/saved', '/settings'].includes(path)) return targetForSection(path === '/' ? 'home' : path.slice(1), {}, features);
  if (path === '/account') return targetForSection('account', queryParams, features);
  const place = match('/place/{id}', path);
  if (place) return targetForSection('place', { id: place.id! }, features);
  const custom = match('/feature/{section}', path);
  if (custom) {
    let normalized: Record<string, string>;
    try { normalized = featureParameters({ section: custom.section, ...queryParams }); } catch { return null; }
    return targetForSection(custom.section!, normalized, features);
  }
  for (const route of nativeRoutes) {
    const values = match(route.path, path);
    if (!values) continue;
    const params = { ...queryParams, ...Object.fromEntries(Object.entries(route.params).map(([key, value]) => [key, substitutions(value, values)])) };
    if (route.section === 'transit' && params.cityId) {
      if (params.route) params.routeId = params.route;
      params.initialView = params.view === 'map' ? 'map' : 'list';
      delete params.route; delete params.view;
    }
    return targetForSection(route.section, params, features);
  }
  return null;
}

export function catalogueDestination(href: string, features: readonly string[], origin = configuredSiteOrigin): AppLinkTarget | { kind: 'website'; url: string } {
  const url = new URL(href, origin);
  if (url.origin !== origin || url.username || url.password) throw new Error('الرابط غير صالح.');
  const target = parseAppLink(href, features, origin);
  // The native Places tab cannot apply catalogue query filters.
  if (target?.kind === 'tab' && target.tab === 'Places' && Object.keys(target.params ?? {}).length) return { kind: 'website', url: url.href };
  return target ?? { kind: 'website', url: url.href };
}

export function stateForTarget(target: AppLinkTarget): InitialState {
  if (target.kind === 'tab') return { index: 0, routes: [{ name: 'Main', state: { index: 0, routes: [{ name: target.tab, ...(target.params ? { params: target.params } : {}) }] } }] };
  if (target.kind === 'feature') return { index: 1, routes: [{ name: 'Main' }, { name: 'Feature', params: { section: target.section, params: target.params } }] };
  if (target.kind === 'place') return { index: 1, routes: [{ name: 'Main' }, { name: 'Place', params: { id: target.id } }] };
  return { index: 1, routes: [{ name: 'Main', state: { index: 0, routes: [{ name: 'Transit' }] } }, { name: 'TransitLink', params: target.params }] };
}

export function appStateFromPath(path: string, features: readonly string[] = sourceSections, origin = configuredSiteOrigin): InitialState | undefined {
  const target = parseAppLink(path, features, origin);
  return target ? stateForTarget(target) : undefined;
}

const withQuery = (path: string, params: Record<string, string>): string => {
  const query = new URLSearchParams(sorted(params)).toString();
  return `${path}${query ? `?${query}` : ''}`;
};

// TransitCity stores a resolved city for rendering. URLs contain only its ID.
export function appPathFromState(state: NavigationState | InitialState): string {
  const route = state.routes[state.index ?? state.routes.length - 1];
  if (!route) return '/';
  const raw = (route.params ?? {}) as Record<string, unknown>;
  if (route.name === 'Main') {
    const tab = route.state?.routes[route.state.index ?? route.state.routes.length - 1];
    const name = tab?.name ?? raw.screen;
    const params = (tab?.params ?? raw.params ?? {}) as Record<string, string>;
    if (name === 'Places') {
      const target = targetForSection('places', params);
      if (target?.kind !== 'tab') return '/mishwar';
      const { placeId, guideId, ...rest } = target.params ?? {};
      return withQuery('/mishwar', { ...rest, ...(placeId ? { place: placeId } : {}), ...(guideId ? { guide: guideId } : {}) });
    }
    return name === 'Transit' ? '/transit' : name === 'Saved' ? '/saved' : name === 'Settings' ? '/settings' : '/';
  }
  if (route.name === 'Place') return positive(String(raw.id)) ? withQuery('/mishwar', { place: String(raw.id) }) : '/';
  if (route.name === 'TransitLink' || route.name === 'TransitCity') {
    const city = raw.city && typeof raw.city === 'object' ? raw.city as Record<string, unknown> : null;
    const target = targetForSection('transit', { cityId: String(raw.cityId ?? city?.id ?? ''), ...(typeof raw.routeId === 'string' ? { routeId: raw.routeId } : {}), ...(typeof raw.initialView === 'string' ? { initialView: raw.initialView } : {}) });
    if (target?.kind !== 'transit') return '/transit';
    return withQuery(`/transit/city/${target.params.cityId}`, { ...(target.params.routeId ? { route: target.params.routeId } : {}), ...(target.params.initialView === 'map' ? { view: 'map' } : {}) });
  }
  if (route.name !== 'Feature' || typeof raw.section !== 'string' || !boundedId(raw.section)) return '/';
  let params: Record<string, string>;
  try { params = featureParameters(raw); } catch { return '/'; }
  if (raw.section === 'promises' && params.url) {
    const list = parts(params.url, configuredSiteOrigin);
    if (list?.path === '/promises') { list.query.sort(); return `/promises${list.query.size ? `?${list.query}` : ''}`; }
  }
  let selected: { path: string; rest: Record<string, string>; score: number } | null = null;
  for (const candidate of nativeRoutes) {
    if (candidate.section !== raw.section) continue;
    const rest = { ...params }, values: Record<string, string> = {};
    let valid = true, score = 0;
    for (const [key, expected] of Object.entries(candidate.params)) {
      const placeholder = /^\{([a-zA-Z]+)\}$/.exec(expected)?.[1];
      if (placeholder ? !params[key] || !boundedId(params[key]!) : params[key] !== expected) { valid = false; break; }
      if (placeholder) values[placeholder] = params[key]!;
      delete rest[key]; score++;
    }
    if (valid && (!selected || score > selected.score)) selected = { path: substitutions(candidate.path, values), rest, score };
  }
  return selected ? withQuery(selected.path, selected.rest) : withQuery(`/feature/${raw.section}`, params);
}

export function resolveTransitLink(params: RootRoutes['TransitLink'], cities: readonly City[]): RootRoutes['TransitCity'] {
  const valid = targetForSection('transit', { cityId: params.cityId, ...(params.routeId ? { routeId: params.routeId } : {}), ...(params.initialView ? { initialView: params.initialView } : {}) });
  const city = cities.find(item => String(item.id) === params.cityId);
  if (valid?.kind !== 'transit' || !city || city.comingSoon) throw new Error('لا تتوفر خطوط لهذه المدينة حالياً.');
  return { city, ...(valid.params.routeId ? { routeId: valid.params.routeId } : {}), initialView: valid.params.initialView ?? 'list' };
}
