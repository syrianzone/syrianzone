import type {
  LatLng,
  PlaceCategory,
  PlaceFeatureCollection,
} from './_lib/types';
import { apiOrigin } from '@/lib/env';

const COORD_TOKEN = String.raw`([NSEW])?\s*([+-]?\d{1,3}(?:[.,]\d+)?)\s*°?\s*([NSEW])?`;
const COORD_RE = new RegExp(
  String.raw`^\s*${COORD_TOKEN}\s*(?:[,;]\s*|\s+)${COORD_TOKEN}\s*$`,
  'i',
);

export function parseLatLng(query: string): LatLng | null {
  const match = COORD_RE.exec(query);
  if (!match) {
    return null;
  }
  const [, pre1, num1, suffix1, pre2, num2, suffix2] = match as (
    | string
    | undefined
  )[];
  // Stryker disable next-line all: the regex requires both numeric captures; this guard protects future regex changes.
  if (!num1 || !num2) {
    return null;
  }

  const hasCommaDecimal = /\d,\d/.test(num1) || /\d,\d/.test(num2);
  const hasMarker = match[0].includes('°') || Boolean(pre1 || suffix1 || pre2 || suffix2);
  if (hasCommaDecimal && !hasMarker) {
    return null;
  }

  const parseToken = (
    prefix: string | undefined,
    suffix: string | undefined,
    raw: string,
  ) => {
    if (prefix && suffix) {
      return null;
    }
    const letter = (prefix ?? suffix)?.toUpperCase() ?? null;
    if (letter && /[+-]/.test(raw)) {
      return null;
    }
    let value = Number(raw.replace(',', '.'));
    if (letter === 'S' || letter === 'W') {
      value = -value;
    }
    return { letter, value };
  };
  const first = parseToken(pre1, suffix1, num1);
  const second = parseToken(pre2, suffix2, num2);
  if (!first || !second) {
    return null;
  }

  const axis = (letter: string | null) => {
    if (letter === 'N' || letter === 'S') {
      return 'lat';
    }
    if (letter === 'E' || letter === 'W') {
      return 'lng';
    }
    return null;
  };
  const firstAxis = axis(first.letter);
  const secondAxis = axis(second.letter);
  if (firstAxis && firstAxis === secondAxis) {
    return null;
  }

  const swap = firstAxis === 'lng' || secondAxis === 'lat';
  const lat = swap ? second.value : first.value;
  const lng = swap ? first.value : second.value;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

export function isPointInSyria(point: LatLng): boolean {
  return point.lat >= 32 && point.lat <= 37.5 && point.lng >= 35.5 && point.lng <= 42.5;
}

export function isGeoSuggestionQuery(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.length >= 2 && parseLatLng(trimmed) === null;
}

export function placeShareUrl(id: number): string {
  const url = new URL('/mishwar', `${apiOrigin}/`);
  url.searchParams.set('place', String(id));
  return url.toString();
}

export function googleMapsUrl(point: LatLng): string {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', `${point.lat},${point.lng}`);
  return url.toString();
}

export function filterPlaceFeatures(data: PlaceFeatureCollection | null | undefined, category: PlaceCategory | null, query: string): PlaceFeatureCollection {
  const search = parseLatLng(query) ? '' : query.trim();
  return {
    features: (data?.features ?? []).filter((feature) => (category === null || feature.properties.category === category) && (!search || feature.properties.name.includes(search))),
    type: 'FeatureCollection',
  };
}
