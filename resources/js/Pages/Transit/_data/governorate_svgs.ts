export interface GovernorateSvgData {
  viewBox: string;
  path: string;
}

/**
 * Lazy-loaded governorate SVG data.
 * Each SVG file is individually code-split (~2-5 KB after Douglas-Peucker
 * optimisation) and loaded on demand via import.meta.glob.
 */
const svgModules = import.meta.glob('./governorates/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

/** filename → GOVERNORATE_SVGS key */
const FILE_TO_KEY: Record<string, string> = {
  'homs':          'homs',
  'rif-dimashq':   'rif dimashq',
  'as-suwayda':    'as suwayda',
  'quneitra':      'quneitra',
  'daraa':         'dar`a',
  'aleppo':        'aleppo',
  'hamah':         'hamah',
  'idlib':         'idlib',
  'damascus':      'damascus',
  'tartus':        'tartus',
  'lattakia':      'lattakia',
  'hasakah':       'al \u1e24asakah',
  'deir-ez-zor':   'dayr az zawr',
  'raqqa':         'ar raqqah',
};

function parseSvg(raw: string): GovernorateSvgData {
  const vbMatch = raw.match(/viewBox="([^"]+)"/);
  const dMatch = raw.match(/d="([^"]+)"/);
  return {
    viewBox: vbMatch?.[1] ?? '0 0 0 0',
    path: dMatch?.[1] ?? '',
  };
}

export const GOVERNORATE_SVGS: Record<string, GovernorateSvgData> = {};

for (const [importPath, raw] of Object.entries(svgModules)) {
  const fileName = importPath.split('/').pop()?.replace('.svg', '') ?? '';
  const key = FILE_TO_KEY[fileName];
  if (key) {
    GOVERNORATE_SVGS[key] = parseSvg(raw);
  }
}
