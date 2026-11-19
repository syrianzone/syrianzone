import { isCoordinate, type Coordinate } from '../domain';
import { finiteNumber } from './validation';
import facts from '../../../resources/data/syria.json';

export function decodeCoordinate(latitude: unknown, longitude: unknown): Coordinate {
  const point = { latitude: finiteNumber(latitude), longitude: finiteNumber(longitude) };
  if (!isCoordinate(point)) throw new Error('الإحداثيات غير صالحة.');
  return point;
}
export function inSyria(point: Coordinate): boolean { return isCoordinate(point) && point.latitude >= facts.bbox.lat_min && point.latitude <= facts.bbox.lat_max && point.longitude >= facts.bbox.lng_min && point.longitude <= facts.bbox.lng_max; }

const COORD_TOKEN = String.raw`([NSEW])?\s*([+-]?\d{1,3}(?:[.,]\d+)?)\s*°?\s*([NSEW])?`;
const COORD_RE = new RegExp(String.raw`^\s*${COORD_TOKEN}\s*(?:[,;]\s*|\s+)${COORD_TOKEN}\s*$`, 'i');
export function parseCoordinates(query: string): Coordinate | null {
  const match = COORD_RE.exec(query);
  if (!match) return null;
  const [, pre1, num1, suf1, pre2, num2, suf2] = match;
  if (num1 === undefined || num2 === undefined) return null;
  const hasComma = /\d,\d/.test(num1) || /\d,\d/.test(num2);
  if (hasComma && !match[0].includes('°') && !(pre1 || suf1 || pre2 || suf2)) return null;
  const token = (pre: string | undefined, suf: string | undefined, raw: string) => {
    if (pre && suf) return null;
    const letter = (pre ?? suf)?.toUpperCase() ?? null;
    if (letter && /[+-]/.test(raw)) return null;
    let value = Number(raw.replace(',', '.'));
    if (letter === 'S' || letter === 'W') value = -value;
    return { value, letter };
  };
  const first = token(pre1, suf1, num1), second = token(pre2, suf2, num2);
  if (!first || !second) return null;
  const axis = (letter: string | null) => letter === 'N' || letter === 'S' ? 'lat' : letter === 'E' || letter === 'W' ? 'lng' : null;
  const a = axis(first.letter), b = axis(second.letter);
  if (a && b && a === b) return null;
  const point = a === 'lng' || b === 'lat' ? { latitude: second.value, longitude: first.value } : { latitude: first.value, longitude: second.value };
  return isCoordinate(point) ? point : null;
}
