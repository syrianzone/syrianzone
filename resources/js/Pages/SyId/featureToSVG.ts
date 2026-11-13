import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { geometryPositions, positionsBounds } from '@/Components/map/geo';

/**
 * One province (or the whole country) as a standalone SVG, cropped to the
 * bounding box of what it draws. The fill and stroke are the SyId page's
 * "Forest" palette rather than theme tokens: the file is downloaded and used
 * outside the app, where the themes do not exist.
 */
export function featureToSVG(geojson: Feature | FeatureCollection): string {
  const features = geojson.type === 'FeatureCollection' ? geojson.features : [geojson];
  const bounds = positionsBounds(features.flatMap((feature) => geometryPositions(feature.geometry)));
  if (!bounds) return '';

  const [[west, south], [east, north]] = bounds;
  const paddingX = (east - west) * 0.05;
  const paddingY = (north - south) * 0.05;
  const minX = west - paddingX;
  const maxY = north + paddingY;
  const finalWidth = east + paddingX - minX;
  const finalHeight = maxY - (south - paddingY);

  const project = (lon: number, lat: number) => {
    const x = lon - minX;
    const y = maxY - lat; // Flip Y: maxY becomes 0
    return `${x.toFixed(6)},${y.toFixed(6)}`;
  };

  const ringsOf = (geometry: Geometry | null): Position[][] => {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') return geometry.coordinates;
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
    return [];
  };

  let svgPaths = '';

  for (const feature of features) {
    let pathData = '';
    for (const ring of ringsOf(feature.geometry)) {
      pathData += ring.map((pt, i) => (i === 0 ? 'M' : 'L') + project(pt[0], pt[1])).join(' ') + ' Z ';
    }

    if (pathData) {
      svgPaths += `<path d="${pathData.trim()}" fill="#428177" stroke="#0D1117" stroke-width="${(finalWidth / 500).toFixed(6)}" />\n`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${finalWidth} ${finalHeight}" width="1200" height="auto">
${svgPaths}</svg>`;
}
