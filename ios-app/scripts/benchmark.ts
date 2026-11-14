import { performance } from 'node:perf_hooks';
import { matchesSearch, parseTransitMap } from '../src/domain';
import { deriveLayout, type LayoutMetrics } from '../src/layout';

// Generated GeoJSON has 10,000 route points and 1,000 stops near Damascus.
const routeCount = 100;
const pointsPerRoute = 100;
const stopCount = 1000;
const payload = {
  routes: {
    type: 'FeatureCollection',
    features: Array.from({ length: routeCount }, (_, route) => ({
      type: 'Feature',
      properties: { id: `route-${route}`, nameAr: `خط دمشق ${route}`, colorIndex: route % 8 },
      geometry: {
        type: 'LineString',
        coordinates: Array.from({ length: pointsPerRoute }, (_point, point) => [36.25 + point / 10000, 33.45 + route / 10000])
      }
    }))
  },
  stops: {
    type: 'FeatureCollection',
    features: Array.from({ length: stopCount }, (_, stop) => ({
      type: 'Feature',
      properties: { id: `stop-${stop}`, nameAr: `محطة دمشق ${stop}`, routeIds: [`route-${stop % routeCount}`] },
      geometry: { type: 'Point', coordinates: [36.25 + stop / 100000, 33.45 + stop / 100000] }
    }))
  }
};
const serialized = JSON.stringify(payload);
const names = Array.from({ length: 10_000 }, (_, index) => index % 2 === 0 ? `إِدْلِب ${index}` : `دِمَشْق ${index}`);
const metrics: LayoutMetrics = {
  width: 1000, height: 800, horizontalSizeClass: 'regular', hasHinge: true, verticalBarEdge: 'none',
  safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
  reservedRegions: [{ kind: 'division', x: 490, y: 0, width: 20, height: 800 }]
};
let checksum = 0;

function measure(name: string, iterations: number, operation: () => number): void {
  const coldStart = performance.now();
  checksum += operation();
  const coldMs = performance.now() - coldStart;
  for (let index = 0; index < 5; index++) checksum += operation();
  const timings: number[] = [];
  for (let index = 0; index < iterations; index++) {
    const start = performance.now();
    checksum += operation();
    timings.push(performance.now() - start);
  }
  timings.sort((first, second) => first - second);
  console.log(JSON.stringify({ name, iterations, coldMs, medianMs: timings[Math.floor(timings.length / 2)], p95Ms: timings[Math.floor(timings.length * 0.95)] }));
}

console.log(JSON.stringify({ runtime: Bun.version, platform: process.platform, arch: process.arch, routePoints: routeCount * pointsPerRoute, stops: stopCount, bytes: Buffer.byteLength(serialized, 'utf8') }));
measure('decode transit JSON', 30, () => {
  const result = parseTransitMap(JSON.parse(serialized) as unknown);
  return result.routes.length + result.stops.length;
});
measure('search 10000 Arabic names', 30, () => names.filter(name => matchesSearch(name, 'ادلب')).length);
measure('layout 1000 hinge updates', 30, () => {
  let total = 0;
  for (let index = 0; index < 1000; index++) total += deriveLayout(metrics, 1000, 800).primary.width;
  return total;
});
if (checksum <= 0) throw new Error('Benchmark did not consume its results.');
