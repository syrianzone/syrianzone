import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';

export const GOVERNORATES_EN_TO_AR: Readonly<Record<string, string>> = {
  Aleppo: 'حلب',
  'Al Ḥasakah': 'الحسكة',
  'Ar Raqqah': 'الرقة',
  'As Suwayda': 'السويداء',
  Damascus: 'دمشق',
  'Dar`a': 'درعا',
  'Dayr Az Zawr': 'دير الزور',
  Hamah: 'حماة',
  Homs: 'حمص',
  Idlib: 'إدلب',
  Lattakia: 'اللاذقية',
  Quneitra: 'القنيطرة',
  'Rif Dimashq': 'ريف دمشق',
  Tartus: 'طرطوس',
};

const governorateVariations: Readonly<Record<string, string>> = {
  'Al Hasakah': 'Al Ḥasakah',
  'Ar Raqqa': 'Ar Raqqah',
  Daraa: 'Dar`a',
  "Dara'a": 'Dar`a',
  'Deir Ezzor': 'Dayr Az Zawr',
  'Deir ez-Zor': 'Dayr Az Zawr',
  Hama: 'Hamah',
  Hasakah: 'Al Ḥasakah',
  Idleb: 'Idlib',
  Latakia: 'Lattakia',
  Raqqa: 'Ar Raqqah',
  'Rural Damascus': 'Rif Dimashq',
  Tartous: 'Tartus',
};

type BoundaryFeature = Feature<MultiPolygon | Polygon>;
type BoundaryInput = BoundaryFeature | FeatureCollection<MultiPolygon | Polygon>;

export function getGovernorateNameAr(name: string): string {
  if (!name || /[\u0600-\u06ff]/.test(name)) {
    return name;
  }
  const key = governorateVariations[name] ?? name;
  return GOVERNORATES_EN_TO_AR[key] ?? name;
}

function featuresFrom(input: BoundaryInput): readonly BoundaryFeature[] {
  return input.type === 'FeatureCollection' ? input.features : [input];
}

function ringsFrom(feature: BoundaryFeature): readonly Position[][] {
  if (feature.geometry.type === 'Polygon') {
    return feature.geometry.coordinates;
  }
  return feature.geometry.coordinates.flat();
}

export function geoJsonToSVG(geojson: BoundaryInput | null | undefined): string {
  if (!geojson) {
    return '';
  }
  const features = featuresFrom(geojson);
  const points = features.flatMap((feature) => ringsFrom(feature).flat());
  if (points.length === 0) {
    return '';
  }

  const longitudes = points.map((point) => point[0]).filter(Number.isFinite) as number[];
  const latitudes = points.map((point) => point[1]).filter(Number.isFinite) as number[];
  if (longitudes.length === 0 || latitudes.length === 0) {
    return '';
  }
  const rawMinX = Math.min(...longitudes);
  const rawMaxX = Math.max(...longitudes);
  const rawMinY = Math.min(...latitudes);
  const rawMaxY = Math.max(...latitudes);
  const width = Math.max(rawMaxX - rawMinX, 0.000001);
  const height = Math.max(rawMaxY - rawMinY, 0.000001);
  const minX = rawMinX - width * 0.05;
  const maxY = rawMaxY + height * 0.05;
  const finalWidth = width * 1.1;
  const finalHeight = height * 1.1;
  const project = (point: Position) => {
    const longitude = point[0] ?? 0;
    const latitude = point[1] ?? 0;
    return `${(longitude - minX).toFixed(6)},${(maxY - latitude).toFixed(6)}`;
  };

  const paths = features
    .flatMap(ringsFrom)
    .map((ring) =>
      ring
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${project(point)}`)
        .join(' '),
    )
    .filter(Boolean)
    .map(
      (path) =>
        `<path d="${path} Z" fill="#428177" stroke="#0D1117" stroke-width="${(
          finalWidth / 500
        ).toFixed(6)}" />`,
    )
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${finalWidth} ${finalHeight}" width="1200" height="auto">\n${paths}\n</svg>`;
}

export const featureToSVG = geoJsonToSVG;

/*
PORT STATUS
  source:     resources/js/Lib/geo-utils.ts (142 lines)
  confidence: high
  todos:      0
  notes:      Typed GeoJSON projection preserves Arabic names and portable SVG export without browser globals.
*/
