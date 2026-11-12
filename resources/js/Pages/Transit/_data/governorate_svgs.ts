export interface GovernorateSvgData {
  viewBox: string;
  path: string;
}

/**
 * Governorate outline SVG data, keyed by the file basename. Each SVG is
 * individually code-split (~2-5 KB after Douglas-Peucker optimisation) and
 * loaded on demand via import.meta.glob. The basename for a governorate is
 * `transitSvg` in resources/data/governorates.json, the same field
 * `GovernorateIconService` reads on the server.
 */
const svgModules = import.meta.glob('./governorates/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

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
  GOVERNORATE_SVGS[fileName] = parseSvg(raw);
}
