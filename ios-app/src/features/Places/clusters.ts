import Supercluster from 'supercluster';
import type { MapPin } from '../../MapView';
import type { Coordinate } from '../../domain';

const EXTENT = 512;
let indexGeneration = 0;
export function sourceZoomForViewport(longitudeDelta: number, width: number): number {
  if (!Number.isFinite(longitudeDelta) || longitudeDelta <= 0 || !Number.isFinite(width) || width <= 0) return 0;
  return Math.max(0, Math.min(24, Math.log2(360 * width / (longitudeDelta * EXTENT))));
}
const mercatorY = (latitude: number): number => { const sine = Math.sin(Math.max(-85.05112878, Math.min(85.05112878, latitude)) * Math.PI / 180); return 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI); };
export function nativeExpansionZoom(sourceZoom: number, width: number, height: number, latitude: number): number {
  if (width <= 0 || height <= 0 || ![sourceZoom, width, height, latitude].every(Number.isFinite)) throw new Error('أبعاد الخريطة غير صالحة.');
  const desiredLongitudeSpan = Math.min(360, 360 * width / (EXTENT * 2 ** sourceZoom));
  // Expo MapUtils requests equal latitude/longitude degree spans. Fit that region to the actual native viewport before converting back to its zoom convention.
  let low = 0, high = desiredLongitudeSpan;
  for (let iteration = 0; iteration < 40; iteration++) {
    const inputSpan = (low + high) / 2;
    const projectedLatitudeSpan = mercatorY(latitude - inputSpan / 2) - mercatorY(latitude + inputSpan / 2);
    const fittedLongitudeSpan = Math.max(inputSpan, projectedLatitudeSpan * 360 * width / height);
    if (fittedLongitudeSpan > desiredLongitudeSpan) high = inputSpan; else low = inputSpan;
  }
  return Math.max(0, Math.min(24, Math.log2(360 / Math.max(low, 1e-8)) + 1e-6));
}
export function createPinIndex(source: 'place' | 'hotel', pins: readonly MapPin[]) {
  const index = new Supercluster<{ pin: MapPin }, Record<string, never>>({ radius: 25, maxZoom: 10, extent: EXTENT });
  index.load(pins.map(pin => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [pin.coordinate.longitude, pin.coordinate.latitude] }, properties: { pin } })));
  const prefix = `cluster:${source}:${++indexGeneration}:`, centers = new Map<string, Coordinate>();
  return {
    query(bounds: [number, number, number, number], zoom: number): MapPin[] {
      centers.clear();
      return index.getClusters(bounds, Math.floor(zoom)).map(feature => {
        if (!('cluster' in feature.properties)) return feature.properties.pin;
        const properties = feature.properties, id = `${prefix}${properties.cluster_id}`, coordinate = { longitude: feature.geometry.coordinates[0]!, latitude: feature.geometry.coordinates[1]! };
        centers.set(id, coordinate);
        return { id, name: `${properties.point_count} ${source === 'place' ? 'مكان' : 'فندق'}`, coordinate, monogram: String(properties.point_count_abbreviated), color: source === 'hotel' ? '#c05621' : 'hsl(105,12%,38%)' };
      });
    },
    expand(id: string, width: number, height: number): { coordinates: Coordinate; zoom: number; sourceZoom: number } | null {
      const coordinates = centers.get(id);
      if (!id.startsWith(prefix) || !coordinates) return null;
      const clusterId = Number(id.slice(prefix.length));
      try { const sourceZoom = index.getClusterExpansionZoom(clusterId); return { coordinates, sourceZoom, zoom: nativeExpansionZoom(sourceZoom, width, height, coordinates.latitude) }; }
      catch { return null; }
    }
  };
}
// PORT STATUS: source resources/js/Pages/Places/_components/PinLayer.tsx; confidence medium; todos 1 native expansion camera calibration verification.
