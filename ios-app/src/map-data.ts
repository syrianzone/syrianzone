import { isCoordinate, type Coordinate } from './domain';

export function cameraForCoordinates(points: readonly Coordinate[]): { coordinates: Coordinate; zoom: number } | null {
  if (points.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const point of points) {
    if (!isCoordinate(point)) throw new Error('إحداثيات غير صالحة.');
    minLat = Math.min(minLat, point.latitude); maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude); maxLng = Math.max(maxLng, point.longitude);
  }
  const span = Math.max(maxLat - minLat, maxLng - minLng, 0.003);
  return { coordinates: { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 }, zoom: Math.max(3, Math.min(15, Math.log2(180 / span) - 1)) };
}

export function directionsUrl(coordinate: Coordinate, name: string): string {
  if (!isCoordinate(coordinate)) throw new Error('إحداثيات غير صالحة.');
  const params = new URLSearchParams({ daddr: `${coordinate.latitude},${coordinate.longitude}`, q: name });
  return `https://maps.apple.com/?${params}`;
}
