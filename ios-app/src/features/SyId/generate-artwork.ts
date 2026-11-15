import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { resolveSvgCss } from './svg';
const root = resolve(import.meta.dir, '../../../..');
const inputs = { logo: 'public/syid-assets/materials/logo.ai.svg', pattern: 'public/syid-assets/materials/pattern.svg', flag: 'public/assets/ar.svg', flagProportions: 'public/syid-assets/materials/syrian-flag-proportions.svg', president: 'public/assets/games/president.svg' };
const framed = 'public/syid-assets/icons/governorates/with-frame/';
const all: Record<string, string> = { ...inputs, ...Object.fromEntries(readdirSync(resolve(root, framed)).filter(name => name.endsWith('.svg')).map(name => [name, framed + name])) };
const artwork: Record<string, string> = {};
const provenance: Record<string, { path: string; sha256: string }> = {};
for (const [key, path] of Object.entries(all)) {
  const raw = readFileSync(resolve(root, path), 'utf8');
  const xml = resolveSvgCss(raw);
  if (/<style|\bclass=|\bstyle=/.test(xml)) throw new Error(`Unresolved artwork CSS: ${path}`);
  artwork[key] = xml;
  provenance[key] = { path, sha256: createHash('sha256').update(raw).digest('hex') };
}
const literal = (input: unknown): string => JSON.stringify(input).replace(/[\u2013\u2014]/g, character => `\\u${character.charCodeAt(0).toString(16)}`);
writeFileSync(resolve(import.meta.dir, '../../ui/original-artwork.generated.ts'), '// Generated from original repository artwork by generate-artwork.ts. Do not edit.\nexport const artwork: Record<string, string> = '+literal(artwork)+';\nexport const artworkSources = '+literal(provenance)+';\n');
console.log(`Converted ${Object.keys(artwork).length} original SVG artworks.`);

const geoPath = 'public/assets/population/syria_provinces_opt.geojson';
const geoSource = readFileSync(resolve(root, geoPath), 'utf8');
writeFileSync(resolve(import.meta.dir, 'provinces.generated.ts'), '// Generated from '+geoPath+' by generate-artwork.ts. Do not edit.\nexport function originalProvinces(): unknown { return '+literal(JSON.parse(geoSource))+'; }\nexport const provinceSource = '+literal({ path: geoPath, sha256: createHash('sha256').update(geoSource).digest('hex')})+';\n');

const identityPath = 'resources/js/Pages/SyId/SyidClient.tsx';
const identityRaw = readFileSync(resolve(root, identityPath), 'utf8');
const ast = ts.createSourceFile(identityPath, identityRaw, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function readLiteral(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(value => readLiteral(value as ts.Expression));
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property)) throw new Error('Nonliteral identity property');
    const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;
    if (key === null) throw new Error('Computed identity property');
    return [key, readLiteral(property.initializer)];
  }));
  throw new Error('Nonliteral identity data');
}
const identity: Record<string, unknown> = {};
const wanted: Record<string, string> = { COLOR_PALETTES: 'colorPalettes', POSTER_THEMES: 'posterThemes', HAYYAKUM_WEIGHTS: 'fontWeights', GOVERNORATE_ARTWORK: 'governorateArtwork' };
for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
  if (ts.isIdentifier(declaration.name) && wanted[declaration.name.text] && declaration.initializer) identity[wanted[declaration.name.text]!] = readLiteral(declaration.initializer);
}
if (Object.keys(identity).length !== 4) throw new Error('Missing source identity data');
writeFileSync(resolve(import.meta.dir, 'identity.generated.ts'), '// Generated from '+identityPath+' by generate-artwork.ts. Do not edit.\n'+Object.entries(identity).map(([key,value]) => 'export const '+key+' = '+literal(value)+' as const;').join('\n')+'\nexport const identitySource = '+literal({path:identityPath,sha256:createHash('sha256').update(identityRaw).digest('hex')})+';\n');
